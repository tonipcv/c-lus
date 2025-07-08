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
  KeyboardAvoidingView,
  Platform,
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
            placeholderTextColor="#cccccc"
            multiline
          />
        );

      case 'SCALE':
        return (
          <View style={styles.scaleContainer}>
            <Text style={styles.scaleDescription}>
              {response ? `Selected level: ${response}/10` : 'Select a level from 1 to 10'}
            </Text>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabelText}>Mild</Text>
              <Text style={styles.scaleLabelText}>Severe</Text>
            </View>
            <View style={styles.scaleButtonsContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.scaleButton,
                    response === value.toString() && styles.scaleButtonSelected,
                    value <= 3 && styles.scaleButtonMild,
                    value > 3 && value <= 6 && styles.scaleButtonModerate,
                    value > 6 && value <= 8 && styles.scaleButtonSevere,
                    value > 8 && styles.scaleButtonVerySevere,
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {hasCheckinToday ? 'Edit Check-in' : 'Daily Check-in'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#cccccc" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0088FE" />
              <Text style={styles.loadingText}>Loading check-in questions...</Text>
            </View>
          ) : questions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="clipboard-text-outline" size={64} color="#cccccc" />
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
              <ScrollView 
                style={styles.content} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
              >
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
      </KeyboardAvoidingView>
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
    backgroundColor: '#151515',
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
    borderBottomColor: '#252525',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
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
    color: '#cccccc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#cccccc',
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
    backgroundColor: '#252525',
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
    color: '#cccccc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  questionContainer: {
    paddingVertical: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 20,
    lineHeight: 24,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#252525',
  },
  scaleContainer: {
    width: '100%',
    paddingVertical: 16,
  },
  scaleDescription: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  scaleLabelText: {
    fontSize: 14,
    color: '#cccccc',
  },
  scaleButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  scaleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  scaleButtonMild: {
    borderColor: '#10B981',
  },
  scaleButtonModerate: {
    borderColor: '#FBBF24',
  },
  scaleButtonSevere: {
    borderColor: '#F97316',
  },
  scaleButtonVerySevere: {
    borderColor: '#EF4444',
  },
  scaleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cccccc',
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
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
  },
  yesNoButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  yesNoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cccccc',
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
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
  },
  multipleChoiceButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  multipleChoiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cccccc',
  },
  multipleChoiceButtonTextSelected: {
    color: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a1a',
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
    borderTopColor: '#252525',
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
    color: '#666666',
  },
  nextButton: {
    backgroundColor: '#0088FE',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#252525',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonTextDisabled: {
    color: '#666666',
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
    backgroundColor: '#252525',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DailyCheckinModal; 