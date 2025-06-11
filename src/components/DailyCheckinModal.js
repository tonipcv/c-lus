import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dailyCheckinService from '../services/dailyCheckinService';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('DailyCheckinModal');
const { width, height } = Dimensions.get('window');

const DailyCheckinModal = ({ visible, onClose, protocolId, onComplete }) => {
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [hasCheckinToday, setHasCheckinToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && protocolId) {
      loadCheckinData();
    }
  }, [visible, protocolId]);

  const loadCheckinData = async () => {
    try {
      setIsLoading(true);
      setError('');
      logger.debug('Carregando dados do check-in', { protocolId });
      
      const data = await dailyCheckinService.getCheckinData(protocolId);
      
      setQuestions(data.questions || []);
      setHasCheckinToday(data.hasCheckinToday);
      setResponses(data.existingResponses || {});
      setCurrentQuestionIndex(0);
      
      logger.info('Dados do check-in carregados', { 
        questionsCount: data.questions?.length || 0,
        hasCheckinToday: data.hasCheckinToday 
      });
    } catch (error) {
      logger.error('Erro ao carregar dados do check-in:', error);
      setError('Failed to load check-in questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponseChange = (questionId, answer) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const canProceedToNext = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return false;
    
    const hasResponse = responses[currentQuestion.id];
    return !currentQuestion.isRequired || (hasResponse && hasResponse.trim() !== '');
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      // Validar respostas obrigatórias
      const requiredQuestions = questions.filter(q => q.isRequired);
      const missingResponses = requiredQuestions.filter(q => !responses[q.id]);
      
      if (missingResponses.length > 0) {
        setError('Please answer all required questions');
        return;
      }

      // Preparar dados para envio
      const submitData = Object.entries(responses).map(([questionId, answer]) => ({
        questionId,
        answer
      }));

      logger.debug('Submetendo check-in', { protocolId, responsesCount: submitData.length });
      const result = await dailyCheckinService.submitCheckin(protocolId, submitData);
      
      logger.info('Check-in submetido com sucesso');
      onComplete?.(result.message || 'Check-in completed successfully!');
      onClose();
    } catch (error) {
      logger.error('Erro ao submeter check-in:', error);
      setError('Failed to submit check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    const response = responses[question.id] || '';

    switch (question.type) {
      case 'TEXT':
        return (
          <TextInput
            style={styles.textInput}
            value={response}
            onChangeText={(text) => handleResponseChange(question.id, text)}
            placeholder="Type your answer..."
            placeholderTextColor="#9CA3AF"
            multiline
          />
        );

      case 'SCALE':
        return (
          <View style={styles.scaleContainer}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.scaleButton,
                  response === value.toString() && styles.scaleButtonSelected
                ]}
                onPress={() => handleResponseChange(question.id, value.toString())}
              >
                <Text style={[
                  styles.scaleButtonText,
                  response === value.toString() && styles.scaleButtonTextSelected
                ]}>
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'YES_NO':
        return (
          <View style={styles.yesNoContainer}>
            {['Yes', 'No'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.yesNoButton,
                  response === option && styles.yesNoButtonSelected
                ]}
                onPress={() => handleResponseChange(question.id, option)}
              >
                <Text style={[
                  styles.yesNoButtonText,
                  response === option && styles.yesNoButtonTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'MULTIPLE_CHOICE':
        let options = [];
        try {
          options = JSON.parse(question.options || '[]');
        } catch (e) {
          options = question.options ? question.options.split(',') : [];
        }
        
        return (
          <View style={styles.multipleChoiceContainer}>
            {options.map((option, index) => {
              const optionText = typeof option === 'string' ? option.trim() : option;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.multipleChoiceButton,
                    response === optionText && styles.multipleChoiceButtonSelected
                  ]}
                  onPress={() => handleResponseChange(question.id, optionText)}
                >
                  <Text style={[
                    styles.multipleChoiceButtonText,
                    response === optionText && styles.multipleChoiceButtonTextSelected
                  ]}>
                    {optionText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {hasCheckinToday ? 'Edit Check-in' : 'Daily Check-in'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0088FE" />
              <Text style={styles.loadingText}>Loading check-in questions...</Text>
            </View>
          ) : questions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="clipboard-text-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyText}>No check-in questions available</Text>
            </View>
          ) : (
            <>
              {/* Progress */}
              {questions.length > 1 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {currentQuestionIndex + 1} of {questions.length}
                  </Text>
                </View>
              )}

              {/* Question */}
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.questionContainer}>
                  <Text style={styles.questionText}>
                    {questions[currentQuestionIndex]?.question}
                    {questions[currentQuestionIndex]?.isRequired && (
                      <Text style={styles.required}> *</Text>
                    )}
                  </Text>
                  
                  {renderQuestion(questions[currentQuestionIndex])}
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Icon name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* Navigation */}
              <View style={styles.navigation}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    currentQuestionIndex === 0 && styles.navButtonDisabled
                  ]}
                  onPress={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  <Text style={[
                    styles.navButtonText,
                    currentQuestionIndex === 0 && styles.navButtonTextDisabled
                  ]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                {currentQuestionIndex === questions.length - 1 ? (
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (!canProceedToNext() || isSubmitting) && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={!canProceedToNext() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {hasCheckinToday ? 'Update Check-in' : 'Submit Check-in'}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.nextButton,
                      !canProceedToNext() && styles.nextButtonDisabled
                    ]}
                    onPress={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={!canProceedToNext()}
                  >
                    <Text style={[
                      styles.nextButtonText,
                      !canProceedToNext() && styles.nextButtonTextDisabled
                    ]}>
                      Next
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.9,
    minHeight: height * 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0088FE',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionContainer: {
    paddingVertical: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    lineHeight: 24,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scaleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  scaleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  scaleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  scaleButtonTextSelected: {
    color: '#FFFFFF',
  },
  yesNoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  yesNoButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  yesNoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  yesNoButtonTextSelected: {
    color: '#FFFFFF',
  },
  multipleChoiceContainer: {
    gap: 12,
  },
  multipleChoiceButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  multipleChoiceButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  multipleChoiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  multipleChoiceButtonTextSelected: {
    color: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    color: '#0088FE',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#9CA3AF',
  },
  nextButton: {
    backgroundColor: '#0088FE',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonTextDisabled: {
    color: '#9CA3AF',
  },
  submitButton: {
    backgroundColor: '#0088FE',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DailyCheckinModal; 