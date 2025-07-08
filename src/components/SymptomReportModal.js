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
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import symptomReportsService from '../services/symptomReportsService';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('SymptomReportModal');
const { width, height } = Dimensions.get('window');

const SymptomReportModal = ({ visible, onClose, protocolId, protocolName, currentDay, onComplete }) => {
  const [title, setTitle] = useState('Symptom Report');
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setTitle('Symptom Report');
      setDescription('');
      setSymptoms('');
      setSeverity(5);
      setError('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      // Validation
      if (!symptoms.trim()) {
        setError('Please describe your symptoms');
        return;
      }

      if (symptoms.trim().length < 10) {
        setError('Please provide more details about your symptoms (at least 10 characters)');
        return;
      }

      const reportData = {
        protocolId,
        dayNumber: currentDay,
        title: title.trim() || 'Symptom Report',
        symptoms: symptoms.trim(),
        severity,
        isNow: true,
        ...(description.trim() && { description: description.trim() })
      };

      logger.debug('Submetendo relatório de sintomas', { 
        protocolId, 
        dayNumber: currentDay, 
        severity 
      });

      const response = await symptomReportsService.createSymptomReport(reportData);
      
      logger.info('Relatório de sintomas criado com sucesso');
      onComplete?.(response.message || 'Symptom report submitted successfully!');
      onClose();
    } catch (error) {
      logger.error('Erro ao submeter relatório de sintomas:', error);
      setError(error.message || 'Failed to submit symptom report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSeverityScale = () => {
    return (
      <View style={styles.severityContainer}>
        <Text style={styles.severityLabel}>
          Severity Level: {severity}/10
        </Text>
        <Text style={styles.severityDescription}>
          {severity <= 3 ? 'Mild' : severity <= 6 ? 'Moderate' : severity <= 8 ? 'Severe' : 'Very Severe'}
        </Text>
        
        <View style={styles.severityScale}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.severityButton,
                severity === value && styles.severityButtonSelected,
                value <= 3 && styles.severityButtonMild,
                value > 3 && value <= 6 && styles.severityButtonModerate,
                value > 6 && value <= 8 && styles.severityButtonSevere,
                value > 8 && styles.severityButtonVerySevere,
              ]}
              onPress={() => setSeverity(value)}
            >
              <Text style={[
                styles.severityButtonText,
                severity === value && styles.severityButtonTextSelected
              ]}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.severityLabels}>
          <Text style={styles.severityLabelText}>Mild</Text>
          <Text style={styles.severityLabelText}>Very Severe</Text>
        </View>
      </View>
    );
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
            <View style={styles.headerInfo}>
              <Text style={styles.title}>Report Symptoms</Text>
              <Text style={styles.subtitle}>
                {protocolName} • Day {currentDay}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Report Title</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter report title..."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Symptoms Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Symptoms Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={symptoms}
                onChangeText={setSymptoms}
                placeholder="Describe your symptoms in detail..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {symptoms.length} characters
              </Text>
            </View>

            {/* Severity Scale */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Severity Level</Text>
              {renderSeverityScale()}
            </View>

            {/* Additional Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Additional Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Any additional information..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={20} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!symptoms.trim() || isSubmitting) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!symptoms.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
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
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
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
    borderWidth: 1,
    borderColor: '#252525',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#cccccc',
    textAlign: 'right',
    marginTop: 4,
  },
  severityContainer: {
    width: '100%',
    paddingVertical: 16,
  },
  severityLabel: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  severityDescription: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 16,
  },
  severityScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  severityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityButtonSelected: {
    backgroundColor: '#0088FE',
    borderColor: '#0088FE',
  },
  severityButtonMild: {
    borderColor: '#10B981',
  },
  severityButtonModerate: {
    borderColor: '#FBBF24',
  },
  severityButtonSevere: {
    borderColor: '#F97316',
  },
  severityButtonVerySevere: {
    borderColor: '#EF4444',
  },
  severityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cccccc',
  },
  severityButtonTextSelected: {
    color: '#FFFFFF',
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  severityLabelText: {
    fontSize: 14,
    color: '#cccccc',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#0088FE',
    fontSize: 16,
    fontWeight: '600',
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

export default SymptomReportModal; 