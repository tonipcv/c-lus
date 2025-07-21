import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  Modal,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';
import { isConnected } from '../utils/connectivityUtils';
import { getToken, isTokenValid } from '../utils/jwtUtils';
import DailyCheckinModal from '../components/DailyCheckinModal';
import SymptomReportModal from '../components/SymptomReportModal';
import dailyCheckinService from '../services/dailyCheckinService';
import LoadingSpinner from '../components/LoadingSpinner';

const logger = createLogger('ProtocolScreen');
const { width, height } = Dimensions.get('window');

const ProtocolScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { protocolId } = route.params;

  const [protocol, setProtocol] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [progress, setProgress] = useState({});
  const [completingTask, setCompletingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [autoOpenedCurrentDay, setAutoOpenedCurrentDay] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState('success'); // 'success' or 'error'
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [hasCheckinToday, setHasCheckinToday] = useState(false);
  const [loadingCheckinStatus, setLoadingCheckinStatus] = useState(false);
  const [symptomReportModalVisible, setSymptomReportModalVisible] = useState(false);
  const [startProtocolModalVisible, setStartProtocolModalVisible] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [startingProtocol, setStartingProtocol] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [referralModalVisible, setReferralModalVisible] = useState(false);
  const [referralForm, setReferralForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [submittingReferral, setSubmittingReferral] = useState(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  const getCurrentDayIndex = (protocolData = protocol) => {
    if (!protocolData?.protocol?.days) return 0;
    if (!protocolData?.currentDay) return 0;
    
    // Usar o currentDay do protocolo
    const currentDayIndex = protocolData.protocol.days.findIndex(
      day => day.dayNumber === protocolData.currentDay
    );
    
    logger.debug('Calculando índice do dia atual:', {
      currentDay: protocolData.currentDay,
      foundIndex: currentDayIndex
    });
    
    return currentDayIndex !== -1 ? currentDayIndex : 0;
  };

  // Função para calcular o dia atual baseado na data de início
  const getTodayDayNumber = () => {
    if (!protocol?.startDate) return 1;
    
    const startDate = new Date(protocol.startDate);
    const today = new Date();
    
    // Resetar as horas para comparar apenas as datas
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const todayDayNumber = Math.max(1, diffDays + 1);
    
    logger.debug('Calculating today day number:', {
      startDate: protocol.startDate,
      startDateObj: startDate.toISOString(),
      todayObj: today.toISOString(),
      diffTime,
      diffDays,
      todayDayNumber
    });
    
    return todayDayNumber;
  };

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setToastVisible(false);
    });
  };

  const loadCheckinStatus = async () => {
    try {
      setLoadingCheckinStatus(true);
      logger.debug('Verificando status do check-in');

      // Verificar status do check-in
      const response = await apiClient.get(`/api/protocols/assignments/${protocolId}/checkin/status`);

      logger.debug('Resposta do status do check-in:', response);
      setHasCheckinToday(response?.hasCheckinToday || false);

      logger.info('Status do check-in carregado', { hasCheckinToday: response?.hasCheckinToday });
    } catch (error) {
      logger.error('Erro ao carregar status do check-in:', error);
      // Não mostrar erro para o usuário pois não é crítico
    } finally {
      setLoadingCheckinStatus(false);
    }
  };

  const handleCheckinComplete = async () => {
    try {
      logger.debug('Check-in concluído, recarregando dados');
      
      // Recarregar protocolo e progresso
      await loadProtocolDetails();
      
      // Recarregar status do check-in
      await loadCheckinStatus();
      
      // Fechar modal
      setCheckinModalVisible(false);
      
      logger.info('Dados atualizados após check-in');
      showToast('Check-in completed successfully!', 'success');
    } catch (error) {
      logger.error('Erro ao atualizar dados após check-in:', error);
      showToast('Unable to update data after check-in.', 'error');
    }
  };

  const handleSymptomReportComplete = async () => {
    try {
      logger.debug('Relatório de sintomas concluído, recarregando dados');
      
      // Recarregar protocolo e progresso
      await loadProtocolDetails();
      
      // Fechar modal
      setSymptomReportModalVisible(false);
      
      logger.info('Dados atualizados após relatório de sintomas');
      showToast('Symptom report completed successfully!', 'success');
    } catch (error) {
      logger.error('Erro ao atualizar dados após relatório de sintomas:', error);
      showToast('Unable to update data after symptom report.', 'error');
    }
  };

  const handleStartProtocol = async () => {
    if (!protocol) {
      Alert.alert('Error', 'Protocol not found.');
      return;
    }

    try {
      setStartingProtocol(true);
      logger.debug('Starting protocol', { 
        prescriptionId: protocol.id,
        startDate: protocol.startDate
      });

      // Use the new endpoint structure
      const response = await apiClient.post(`/api/v2/patients/prescriptions/${protocol.id}/start`);
      
      if (response.success) {
        logger.info('Protocol started successfully', response);
        
        // Update the local protocol data with the response
        if (response.prescription?.actual_start_date) {
          setProtocol(prevProtocol => ({
            ...prevProtocol,
            startDate: response.prescription.actual_start_date,
            status: 'ACTIVE',
            currentDay: 1
          }));
        }
        
        // Reload the full protocol data with all necessary information
        const queryParams = new URLSearchParams({
          include_days: 'true',
          include_progress: 'true',
          include_metrics: 'true'
        });
        
        await loadProtocolAssignment();
        
        Alert.alert('Success', 'Protocol started successfully!');
      }
    } catch (error) {
      logger.error('Error starting protocol:', error);
      
      // Handle specific error when protocol is already started
      if (error.response?.status === 400 && error.response?.data?.actual_start_date) {
        const startDate = new Date(error.response.data.actual_start_date).toLocaleDateString();
        Alert.alert(
          'Protocol Already Started',
          `This protocol was already started on ${startDate}.`
        );
        
        // Update local state with the returned start date
        setProtocol(prevProtocol => ({
          ...prevProtocol,
          startDate: error.response.data.actual_start_date,
          status: error.response.data.status || 'ACTIVE',
          currentDay: 1
        }));
        
        // Reload to get the latest data
        await loadProtocolAssignment();
      } else {
        Alert.alert(
          'Error',
          'Could not start the protocol. Please try again later or contact support if the issue persists.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setStartingProtocol(false);
    }
  };

  const handleStartProtocolPress = () => {
    setStartProtocolModalVisible(true);
  };

  const handleStartProtocolConfirm = async () => {
    try {
      setStartingProtocol(true);
      logger.debug('Iniciando protocolo');

      // Iniciar protocolo
      await apiClient.post(`/api/protocols/assignments/${protocolId}/start`);

      // Recarregar protocolo e progresso
      await loadProtocolDetails();

      // Fechar modal
      setStartProtocolModalVisible(false);

      logger.info('Protocolo iniciado com sucesso');
      showToast('Protocol started successfully!', 'success');
    } catch (error) {
      logger.error('Erro ao iniciar protocolo:', error);
      showToast('Unable to start protocol. Please try again.', 'error');
    } finally {
      setStartingProtocol(false);
    }
  };

  useEffect(() => {
    if (protocolId) {
      logger.debug('Protocol ID received:', { protocolId });
      loadProtocolAssignment();
      loadCheckinStatus();
      setLoading(false);
    }
  }, [protocolId]);
      
  // Efeito separado para atualizar o currentDayIndex quando o protocol mudar
  useEffect(() => {
    if (protocol?.protocol?.days) {
      const todayIndex = getCurrentDayIndex(protocol);
        setCurrentDayIndex(todayIndex);
      }
  }, [protocol]);

  // Efeito para recarregar o progresso quando o protocolo mudar
  useEffect(() => {
    if (protocol?.protocol?.id) {
      loadProtocolProgress();
    }
  }, [protocol?.protocol?.id]);

  useEffect(() => {
    if (!loading && protocol) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [loading, protocol, fadeAnim, slideAnim]);

  const loadProtocolProgress = async () => {
    try {
      if (!protocol?.id) {
        logger.warn('Nenhum ID de protocolo disponível para carregar progresso');
        return;
      }

      logger.debug('Carregando progresso do protocolo', { 
        protocolId: protocol.id
      });

      // Build query parameters
      const queryParams = new URLSearchParams({
        include_progress: 'true'
      });

      // Add date range for progress
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      queryParams.append('start_date', thirtyDaysAgo.toISOString().split('T')[0]);
      queryParams.append('end_date', today.toISOString().split('T')[0]);

      const response = await apiClient.get(
        `/api/v2/patients/prescriptions/${protocol.id}?${queryParams.toString()}`
      );

      if (response.success) {
        const prescription = response.prescription;
        const progressMap = {};

        // Map progress data
        prescription.progress?.forEach(item => {
          if (item.protocolTask?.id) {
            progressMap[item.protocolTask.id] = {
              progressId: item.id,
              taskId: item.protocolTask.id,
              isCompleted: item.status === 'COMPLETED',
              completedAt: item.completedAt,
              notes: item.notes,
              dayNumber: item.dayNumber,
              scheduledDate: item.scheduledDate,
              status: item.status
            };
          }
        });

        setProgress(progressMap);
        logger.info('Progresso do protocolo carregado', { 
          totalItems: prescription.progress?.length || 0,
          completedItems: Object.values(progressMap).filter(p => p.isCompleted).length,
          progressMap
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar progresso do protocolo:', error);
      showToast('Não foi possível carregar o progresso.', 'error');
    }
  };

  const loadProtocolDetails = async () => {
    try {
      setLoading(true);
      logger.debug('Recarregando detalhes do protocolo');
      
      // Buscar protocolo atualizado usando o endpoint correto
      const updatedProtocol = await apiClient.get(`/api/protocols/assignments/${protocolId}`);
      
      if (updatedProtocol) {
        setProtocol(updatedProtocol);
        
        // Recalcular índice do dia atual
        if (updatedProtocol.protocol?.days) {
          const todayIndex = getCurrentDayIndex(updatedProtocol);
          setCurrentDayIndex(todayIndex);
        }
        
        // Recarregar progresso usando o endpoint correto
        if (updatedProtocol.protocolId && updatedProtocol.prescription?.id) {
          const progressResponse = await apiClient.get(
            `/api/protocols/${updatedProtocol.protocolId}/prescriptions/${updatedProtocol.prescription.id}/progress`
          );
          
          logger.debug('Progress response on reload:', { 
            adherenceRate: progressResponse.adherenceRate,
            completedTasks: progressResponse.completedTasks,
            totalTasks: progressResponse.totalTasks,
            currentDay: progressResponse.currentDay,
            streakDays: progressResponse.streakDays
          });

          // Atualizar o estado de progresso mantendo a estrutura existente
          const progressMap = {};
          if (updatedProtocol.protocol?.days) {
            updatedProtocol.protocol.days.forEach(day => {
              day.sessions?.forEach(session => {
                session.tasks?.forEach(task => {
                  progressMap[task.id] = {
                    taskId: task.id,
                    isCompleted: false // Valor padrão
                  };
                });
              });
            });
          }

          // Atualizar com os dados do progresso
          setProgress(progressMap);

          logger.info('Protocolo atualizado com sucesso', {
            hasProgress: Object.keys(progressMap).length > 0
          });
        }
      }
    } catch (error) {
      logger.error('Erro ao recarregar protocolo:', error);
      showToast('Unable to update the protocol.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      logger.debug('Iniciando refresh manual');
      
      // Recarregar protocolo e progresso
      await loadProtocolDetails();
      
      // Recarregar status do check-in
      await loadCheckinStatus();
      
      logger.info('Refresh manual concluído com sucesso');
    } catch (error) {
      logger.error('Erro durante refresh manual:', error);
      showToast('Unable to refresh data.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const formatSimpleDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatDate = (prescription, dayNumber) => {
    if (!protocol?.startDate || !dayNumber) return '';
    
    // Calcular a data a partir do startDate do protocolo
    const date = new Date(protocol.startDate);
    date.setDate(date.getDate() + dayNumber - 1);
    
    // Remover as horas/minutos/segundos para comparação apenas da data
    date.setHours(0, 0, 0, 0);
    
    // Retornar a data formatada
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#7dd3b0';  // Softer green
      case 'INACTIVE': return '#6B7280';
      case 'UNAVAILABLE': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ACTIVE': return 'Active';
      case 'INACTIVE': return 'Inactive';
      case 'UNAVAILABLE': return 'Unavailable';
      default: return 'Unknown';
    }
  };

  const getProtocolImage = (protocolData) => {
    // Use the protocol's cover image if available
    if (protocolData.coverImage) {
      return protocolData.coverImage;
    }
    
    // Fallback to dynamic image selection based on protocol name
    const name = protocolData.name?.toLowerCase() || '';
    
    if (name.includes('crosslinking') || name.includes('cxl')) {
      return 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=200&fit=crop&crop=center';
    } else if (name.includes('laser') || name.includes('treatment')) {
      return 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&h=200&fit=crop&crop=center';
    } else if (name.includes('therapy') || name.includes('rehabilitation')) {
      return 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=200&fit=crop&crop=center';
    } else if (name.includes('medication') || name.includes('drug')) {
      return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=200&fit=crop&crop=center';
    } else if (name.includes('weight') || name.includes('metabolic')) {
      return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop&crop=center';
    } else if (name.includes('anti-aging') || name.includes('facial')) {
      return 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=200&fit=crop&crop=center';
    } else {
      // Default medical image
      return 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=200&fit=crop&crop=center';
    }
  };

  const handleDayPress = (day) => {
    if (!protocol?.protocol?.days) return;
    
    const dayIndex = protocol.protocol.days.findIndex(d => d.id === day.id);
    if (dayIndex === -1) return;
    
    setCurrentDayIndex(dayIndex);
    setSelectedDay(day);
    
    logger.debug('Day selected:', { 
      dayNumber: day.dayNumber, 
      dayTitle: day.title,
      dayIndex 
    });
  };

  const isSessionCompleted = (taskId) => {
    if (!taskId || !progress) {
      logger.debug('isSessionCompleted: taskId ou progress ausente', { 
        taskId, 
        hasProgress: !!progress 
      });
      return false;
    }
    
    const taskProgress = progress[taskId];
    const isCompleted = taskProgress?.status === 'COMPLETED';
    
    logger.debug('Verificando status da tarefa:', {
      taskId,
      status: taskProgress?.status,
      isCompleted,
      progressId: taskProgress?.progressId
    });
    
    return isCompleted;
  };

  const getSessionProgress = (taskId) => {
    return progress[taskId] || null;
  };

  const renderExpandedDayView = (day) => {
    if (!day) return null;

    // Group tasks by session
    const tasksBySession = {};
    if (day?.sessions) {
      day.sessions.forEach(session => {
        if (session?.tasks && session.tasks.length > 0) {
        tasksBySession[session.id] = {
            sessionTitle: session.title || '',
          sessionNumber: session.sessionNumber,
          tasks: session.tasks.map(task => ({
            ...task,
              sessionTitle: session.title || '',
            sessionNumber: session.sessionNumber
          }))
        };
      }
    });
    }

    // Get all tasks for progress calculation
    const allTasks = Object.values(tasksBySession).flatMap(session => session.tasks);
    const completedTasks = allTasks.filter(task => isSessionCompleted(task.id)).length;
    const totalTasks = allTasks.length;
    const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return (
      <>
        <View style={styles.expandedDayHeader}>
          <Text style={styles.expandedDayTitle}>{day.title || ''}</Text>
          <Text style={styles.expandedDayProgress}>
            {completedTasks}/{totalTasks} tasks completed
          </Text>
        </View>

        {day.description && (
          <Text style={styles.expandedDayDescription}>{day.description}</Text>
        )}

        {/* Progress Bar */}
        <View style={styles.expandedProgressContainer}>
          <View style={styles.expandedProgressBackground}>
            <View 
              style={[
                styles.expandedProgressFill, 
                { 
                  width: `${progressPercentage}%`,
                  backgroundColor: progressPercentage === 100 ? '#4ade80' : '#61aed0'
                }
              ]} 
            />
          </View>
        </View>

        {/* Tasks List grouped by Session */}
        <View style={styles.expandedTasksList}>
          <Text style={styles.expandedTasksTitle}>Today's Tasks:</Text>
          
          {Object.keys(tasksBySession).length > 0 ? (
            Object.values(tasksBySession).map((sessionGroup, sessionIndex) => (
              <View key={sessionIndex} style={styles.sessionGroup}>
                {/* Session Category Header */}
                <Text style={styles.sessionCategoryHeader}>
                  {sessionGroup.sessionTitle}
                </Text>
                
                {/* Tasks for this session */}
                {sessionGroup.tasks.map((task, taskIndex) => {
                  const isCompleted = isSessionCompleted(task.id);
                  
                  return (
                    <TouchableOpacity
                      key={task.id}
                      style={[
                        styles.expandedTaskItem,
                        isCompleted && styles.expandedTaskItemCompleted
                      ]}
                      onPress={() => handleSessionComplete(task)}
                      disabled={completingTask && task.id === completingTaskId}
                    >
                      <View style={styles.expandedTaskContent}>
                        <View style={styles.expandedTaskInfo}>
                          <Text style={[
                            styles.expandedTaskTitle,
                            isCompleted && styles.expandedTaskTitleCompleted
                          ]}>
                            {task.title || ''}
                          </Text>
                          {task.description && (
                            <Text style={[
                              styles.expandedTaskDescription,
                              isCompleted && styles.expandedTaskDescriptionCompleted
                            ]}>
                              {task.description}
                            </Text>
                          )}
                        </View>
                        
                        <View style={styles.expandedTaskStatus}>
                          {completingTask && task.id === completingTaskId ? (
                            <ActivityIndicator size="small" color="#61aed0" />
                          ) : (
                            <Icon 
                              name={isCompleted ? "check-circle" : "circle-outline"} 
                              size={24} 
                              color={isCompleted ? "#4ade80" : "#61aed0"} 
                            />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          ) : (
            <Text style={styles.noTasksText}>No tasks for this day.</Text>
          )}
        </View>
      </>
    );
  };

  const renderSessionModal = () => {
    if (!currentSession || !selectedDay) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Day {selectedDay?.dayNumber || ''} - {currentSession?.title || ''}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#7F8589" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sessionTitle}>{currentSession?.title || ''}</Text>
              
              {currentSession?.description && (
                <Text style={styles.sessionDescription}>
                  {currentSession.description}
                </Text>
              )}

              {/* Navegação entre sessões */}
              {selectedDay?.sessions && selectedDay.sessions.length > 1 && (
                <View style={styles.sessionNavigation}>
                  <Text style={styles.sessionNavigationTitle}>Other sessions of the day:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedDay.sessions.map((session, index) => (
                      <TouchableOpacity
                        key={session?.id}
                        style={[
                          styles.sessionNavButton,
                          currentSession?.id === session?.id && styles.sessionNavButtonActive
                        ]}
                        onPress={() => setCurrentSession(session)}
                      >
                        <Text style={[
                          styles.sessionNavButtonText,
                          currentSession?.id === session?.id && styles.sessionNavButtonTextActive
                        ]}>
                          Session {session?.sessionNumber || (index + 1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Lista de tarefas */}
              <View style={styles.tasksSection}>
                <Text style={styles.tasksSectionTitle}>Tasks for this session:</Text>
                
                {currentSession?.tasks && currentSession.tasks.length > 0 ? (
                  currentSession.tasks.map((task, index) => {
                    const taskProgress = getSessionProgress(task?.id);
                    const isCompleted = isSessionCompleted(task?.id);
                    
                    return (
                      <View key={task?.id} style={styles.taskCard}>
                        <View style={styles.taskHeader}>
                          <View style={styles.taskInfo}>
                            <Text style={[
                              styles.taskTitle,
                              isCompleted && styles.taskTitleCompleted
                            ]}>
                              {task?.title || ''}
                            </Text>
                            {task?.description && (
                              <Text style={[
                                styles.taskDescription,
                                isCompleted && styles.taskDescriptionCompleted
                              ]}>
                                {task.description}
                              </Text>
                            )}
                          </View>
                          
                          <View style={styles.taskStatus}>
                            {isCompleted ? (
                              <TouchableOpacity
                                style={styles.completeTaskButton}
                                onPress={() => handleSessionComplete(task)}
                                disabled={completingTask && task?.id === completingTaskId}
                              >
                                {completingTask && task?.id === completingTaskId ? (
                                  <ActivityIndicator size="small" color="#4ade80" />
                                ) : (
                                  <Icon name="check-circle" size={24} color="#4ade80" />
                                )}
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.completeTaskButton}
                                onPress={() => handleSessionComplete(task)}
                                disabled={completingTask && task?.id === completingTaskId}
                              >
                                {completingTask && task?.id === completingTaskId ? (
                                  <ActivityIndicator size="small" color="#61aed0" />
                                ) : (
                                  <Icon name="circle-outline" size={24} color="#61aed0" />
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {isCompleted && taskProgress && (
                          <View style={styles.taskCompletedInfo}>
                            <Text style={styles.taskCompletedText}>
                              Completed on {taskProgress?.date ? new Date(taskProgress.date).toLocaleDateString('en-US') : ''}
                            </Text>
                            {taskProgress?.notes && (
                              <Text style={styles.taskNotes}>
                                {taskProgress.notes}
                              </Text>
                            )}
                          </View>
                        )}

                        {task?.duration && (
                          <View style={styles.taskDetail}>
                            <Icon name="clock" size={14} color="#cccccc" />
                            <Text style={styles.taskDetailText}>
                              Duration: {task.duration} minutes
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noTasksText}>This session has no tasks.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const calculateOverallProgress = () => {
    if (!protocol?.protocol?.days) {
      return { percentage: 0, completed: 0, total: 0 };
    }
    
    let totalTasks = 0;
    let completedTasks = 0;
    
    protocol.protocol.days.forEach(day => {
      if (day.sessions) {
        day.sessions.forEach(session => {
        if (session.tasks) {
          session.tasks.forEach(task => {
              totalTasks++;
              // Verificar se a tarefa está marcada como completa no estado progress
              if (progress[task.id]?.isCompleted === true) {
              completedTasks++;
            }
          });
        }
      });
      }
    });
    
    logger.debug('Calculando progresso geral:', {
      totalTasks,
      completedTasks,
      progressKeys: Object.keys(progress),
      progressValues: Object.values(progress).map(p => ({ 
        taskId: p.protocolTaskId, 
        isCompleted: p.isCompleted 
      }))
    });
    
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { percentage, completed: completedTasks, total: totalTasks };
  };

  const loadProtocolAssignment = async () => {
    try {
      if (protocolId) {
        logger.debug('Protocol ID received:', { protocolId });
        setLoading(true);

        // Check connectivity first
        const isNetworkConnected = await isConnected();
        if (!isNetworkConnected) {
          logger.error('No internet connection');
          throw new Error('No internet connection. Please check your connection and try again.');
        }

        // Check authentication
        const token = await getToken();
        if (!token) {
          logger.error('Token not found');
          throw new Error('Session expired. Please login again.');
        }

        // Check token validity
        const isValid = await isTokenValid();
        if (!isValid) {
          logger.error('Invalid or expired token');
          throw new Error('Your session has expired. Please login again.');
        }

        // Build query parameters based on what we need
        const queryParams = new URLSearchParams({
          include_days: 'true', // We need days for the protocol structure
          include_progress: 'true', // We need progress for task completion status
          include_metrics: 'true', // We need metrics for adherence rate and other stats
        });

        // If we have a selected day, add it to the query
        if (selectedDay?.dayNumber) {
          queryParams.append('day', selectedDay.dayNumber.toString());
        }

        // If we're looking at a specific date range (e.g., for progress)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        queryParams.append('start_date', thirtyDaysAgo.toISOString().split('T')[0]);
        queryParams.append('end_date', today.toISOString().split('T')[0]);

        // 1. Fetch protocol data using the optimized endpoint
        logger.debug('Fetching protocol data with filters', { 
          protocolId,
          queryParams: queryParams.toString()
        });

        const response = await apiClient.get(
          `/api/v2/patients/prescriptions/${protocolId}?${queryParams.toString()}`
        );

        if (!response.success) {
          throw new Error('Protocol not found or invalid response');
        }

        const prescription = response.prescription;

        logger.debug('API Response:', {
          id: prescription.id,
          protocolId: prescription.protocol_id,
          status: prescription.status,
          currentDay: prescription.current_day,
          hasProgress: !!prescription.progress?.length,
          hasMetrics: !!prescription.metrics,
          daysCount: prescription.protocol?.days?.length
        });

        // Map the prescription to match the expected format
        const mappedProtocol = {
          id: prescription.id,
          protocol: {
            id: prescription.protocol_id,
            name: prescription.protocol.name,
            description: prescription.protocol.description,
            duration: prescription.protocol.duration,
            coverImage: prescription.protocol.cover_image,
            doctor: prescription.protocol.doctor,
            days: prescription.protocol.days || []
          },
          status: prescription.status,
          startDate: prescription.actual_start_date,
          currentDay: prescription.current_day,
          adherenceRate: prescription.metrics?.adherence_rate || 0,
          progress: prescription.progress || [],
          plannedStartDate: prescription.planned_start_date,
          plannedEndDate: prescription.planned_end_date,
          actualEndDate: prescription.actual_end_date,
          pausedAt: prescription.paused_at,
          pauseReason: prescription.pause_reason,
          abandonedAt: prescription.abandoned_at,
          abandonReason: prescription.abandon_reason,
          metrics: prescription.metrics || {}
        };

        // Update states with protocol data
        setProtocol(mappedProtocol);

        // Map progress data if we have days
        if (mappedProtocol.protocol.days) {
          const progressMap = {};
          mappedProtocol.protocol.days.forEach(day => {
            day.sessions?.forEach(session => {
              session.tasks?.forEach(task => {
                const taskProgress = prescription.progress?.find(p => 
                  p.dayNumber === day.dayNumber && 
                  p.status === 'COMPLETED'
                );
                
                progressMap[task.id] = {
                  taskId: task.id,
                  isCompleted: !!taskProgress,
                  progressId: taskProgress?.id // Store the progress ID
                };
              });
            });
          });

          // Update progress state
          setProgress(progressMap);

          logger.info('Protocol loading completed successfully', {
            protocolId: mappedProtocol.id,
            hasProgress: Object.keys(progressMap).length > 0,
            adherenceRate: mappedProtocol.adherenceRate
          });
        }

        // Load check-in status
        await loadCheckinStatus();
      } else {
        logger.warn('No protocol ID provided');
        Alert.alert('Error', 'No protocol ID provided');
      }
    } catch (error) {
      logger.error('Error loading protocol:', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      // Determine appropriate error message
      let errorMessage = 'Could not load the protocol. Please try again later.';
      
      if (error.message.includes('connection')) {
        errorMessage = 'No internet connection. Please check your connection and try again.';
      } else if (error.message.includes('session')) {
        errorMessage = 'Your session has expired. Please login again.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Protocol not found.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProtocolAssignment();
  }, []);

  const handleSubmitReferral = async () => {
    try {
      if (!referralForm.name || !referralForm.email) {
        Alert.alert('Aviso', 'Por favor, preencha o nome e email.');
        return;
      }

      if (!protocol?.id) {
        logger.error('Protocol ID not available for referral', { 
          hasProtocol: !!protocol,
          protocolId: protocol?.id 
        });
        Alert.alert('Erro', 'Dados do protocolo não disponíveis. Tente novamente.');
        return;
      }

      setSubmittingReferral(true);
      logger.debug('Enviando indicação', { 
        name: referralForm.name,
        email: referralForm.email,
        prescriptionId: protocol.id,
        protocolData: {
          id: protocol.id,
          protocolId: protocol.protocol?.id,
          name: protocol.protocol?.name
        }
      });

      // Use the correct endpoint and data structure
      const requestData = {
        prescriptionId: protocol.id,
        notes: referralForm.notes || 'Indicação feita pelo paciente via app',
        indicatedPatient: {
          name: referralForm.name,
          email: referralForm.email,
          phone: referralForm.phone || '' // Send empty string instead of null
        }
      };

      logger.debug('Request data for referral:', requestData);

      const response = await apiClient.post('/api/v2/patients/referrals', requestData);

      logger.debug('Referral API response:', response);

      if (response.success) {
        // Fechar modal e limpar form
        setReferralModalVisible(false);
        setReferralForm({
          name: '',
          email: '',
          phone: '',
          notes: ''
        });

        logger.info('Indicação enviada com sucesso', response);
        showToast('Referral sent successfully!', 'success');
      } else {
        throw new Error(response.message || 'Failed to send referral');
      }
    } catch (error) {
      logger.error('Erro ao enviar indicação:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        prescriptionId: protocol?.id
      });
      
      let errorMessage = 'Unable to send referral. Please try again.';
      
      if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid data provided.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Protocol not found.';
      } else if (error.response?.status === 422) {
        errorMessage = error.response.data?.message || 'Validation error.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setSubmittingReferral(false);
    }
  };

  const handleTaskComplete = async (taskId, isCompleted) => {
    try {
      if (!protocol?.prescription?.id) {
        logger.warn('Dados insuficientes para completar tarefa', {
          hasPrescriptionId: !!protocol?.prescription?.id
        });
        return;
      }

      setCompletingTask(true);
      setCompletingTaskId(taskId);

      logger.debug('Atualizando status da tarefa', { 
        taskId,
        isCompleted,
        prescriptionId: protocol.prescription.id
      });

      // Atualizar status da tarefa na API
      await apiClient.post(`/api/protocols/prescriptions/${protocol.prescription.id}/tasks/${taskId}/complete`, {
        isCompleted
      });

      // Recarregar progresso
      await loadProtocolDetails();

      // Atualizar estado local
      setProgress(prev => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          isCompleted
        }
      }));

      logger.info('Tarefa atualizada com sucesso', { 
        taskId, 
        isCompleted,
        hasProgress: true
      });
      
      showToast(isCompleted ? 'Task completed!' : 'Task uncompleted', 'success');
    } catch (error) {
      logger.error('Erro ao atualizar tarefa:', error);
      showToast('Unable to update task status.', 'error');
    } finally {
      setCompletingTask(false);
      setCompletingTaskId(null);
    }
  };

  const handleSessionComplete = async (task) => {
    try {
      setCompletingTask(true);
      setCompletingTaskId(task.id);

      const taskProgress = progress[task.id];

      logger.debug('Atualizando status da tarefa', { 
        taskId: task.id, 
        currentStatus: taskProgress?.status,
        dayNumber: selectedDay?.dayNumber || protocol?.currentDay,
        hasExistingProgress: !!taskProgress?.progressId,
        taskProgress
      });

      let response;

      // If we have existing progress with progressId, use toggle
      if (taskProgress?.progressId) {
        logger.debug('Usando endpoint toggle para progresso existente', {
          progressId: taskProgress.progressId,
          currentStatus: taskProgress.status
        });

        response = await apiClient.post(
          `/api/v2/patients/prescriptions/${protocol.id}/progress/${taskProgress.progressId}/toggle`
        );
      } else {
        // Create new progress
        const today = new Date().toISOString().split('T')[0];
        const requestData = {
          dayNumber: selectedDay?.dayNumber || protocol?.currentDay || 1,
          taskId: task.id,
          status: 'COMPLETED',
          notes: `Tarefa "${task.title}" concluída pelo paciente`,
          scheduledDate: today
        };

        logger.debug('Criando novo progresso:', requestData);

        response = await apiClient.post(
          `/api/v2/patients/prescriptions/${protocol.id}/progress`,
          requestData
        );
      }

      logger.debug('Resposta da API:', response);

      if (response.success) {
        // Update local state with the response
        const newProgress = response.progress;
        
        // Immediately update the local state with the new status
        setProgress(prevProgress => ({
          ...prevProgress,
          [task.id]: {
            progressId: newProgress.id,
            taskId: task.id,
            status: newProgress.status,
            completedAt: newProgress.completedAt,
            notes: newProgress.notes,
            dayNumber: newProgress.dayNumber,
            scheduledDate: newProgress.scheduledDate,
            protocolTaskId: newProgress.protocolTaskId
          }
        }));

        // Show success message using the API's message
        showToast(response.message || 'Task status updated!', 'success');

        logger.debug('Estado do progresso atualizado:', {
          taskId: task.id,
          newStatus: newProgress.status,
          progressId: newProgress.id,
          adherenceRate: response.adherenceRate
        });

        // Update protocol adherence rate if provided
        if (response.adherenceRate !== undefined && protocol) {
          setProtocol(prevProtocol => ({
            ...prevProtocol,
            adherenceRate: response.adherenceRate
          }));
        }
      } else {
        throw new Error('Failed to update task status');
      }
    } catch (error) {
      logger.error('Erro ao atualizar status da tarefa:', error);
      showToast(
        error.response?.data?.message || error.message || 'Failed to update task status',
        'error'
      );
    } finally {
      setCompletingTask(false);
      setCompletingTaskId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!protocol) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Protocol not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backIconButton}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{protocol?.protocol?.name || ''}</Text>
          <Text style={styles.headerSubtitle}>{protocol?.protocol?.doctor?.name || ''}</Text>
        </View>

        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1697F5']}
            tintColor="#1697F5"
          />
        }
      >
        <Animated.View
          style={[
            styles.protocolInfo,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Protocol Image */}
          <Image 
            source={{ uri: getProtocolImage(protocol?.protocol) }}
            style={styles.protocolImage}
            resizeMode="cover"
          />
          
          <View style={styles.protocolContent}>
            <Text style={styles.protocolDescription}>
              {protocol?.protocol?.description || ''}
            </Text>

            <View style={styles.protocolDetails}>
              <View style={styles.detailRow}>
                <Icon name="calendar" size={16} color="#FFFFFF" />
                <Text style={styles.detailText}>
                  {protocol?.status === 'ACTIVE' && protocol?.startDate ? 
                    `Started on ${formatSimpleDate(protocol.startDate)}` :
                    'Not started yet'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Icon name="clock" size={16} color="#FFFFFF" />
                <Text style={styles.detailText}>
                  {protocol?.status === 'ACTIVE' ?
                    `Day ${protocol?.currentDay || 1} of ${protocol?.protocol?.duration || 0}` :
                    `Duration: ${protocol?.protocol?.duration || 0} days`}
                </Text>
              </View>

              {/* Display linked courses if available */}
              {protocol?.protocol?.courses && protocol.protocol.courses.length > 0 && (
                <View style={styles.coursesSection}>
                  <Text style={styles.coursesSectionTitle}>Available Courses</Text>
                  {protocol.protocol.courses.map((course, index) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.courseLink}
                      onPress={() => navigation.navigate('CourseDetail', { 
                        courseId: course.id,
                        courseTitle: course.title
                      })}
                    >
                      <Icon name="play-circle-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.courseLinkText}>{course.title}</Text>
                      <Icon name="chevron-right" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Add Start Protocol Button when not started */}
              {protocol?.status !== 'ACTIVE' && !protocol?.startDate && (
                <TouchableOpacity
                  style={styles.startProtocolButton}
                  onPress={handleStartProtocolPress}
                  disabled={loading || startingProtocol}
                >
                  {loading || startingProtocol ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="play-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.startProtocolButtonText}>Start the protocol now</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Protocol Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Overall Progress</Text>
            <Text style={styles.progressPercentage}>{calculateOverallProgress().percentage}%</Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill,
                  { width: `${calculateOverallProgress().percentage}%` }
                ]} 
              />
            </View>
          </View>
          
          <View style={styles.progressDetails}>
            <View style={styles.progressDetailItem}>
              <Icon name="check-circle" size={16} color="#4ade80" />
              <Text style={styles.progressDetailText}>
                {calculateOverallProgress().completed} of {calculateOverallProgress().total} tasks completed
              </Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Icon name="calendar-clock" size={16} color="#666666" />
              <Text style={styles.progressDetailText}>
                Day {getTodayDayNumber()} of {protocol?.protocol?.duration || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Daily Check-in Button */}
        <TouchableOpacity
          style={[
            styles.checkinButton,
            hasCheckinToday && styles.checkinButtonCompleted
          ]}
          onPress={() => setCheckinModalVisible(true)}
          disabled={loadingCheckinStatus}
        >
          <View style={styles.checkinButtonContent}>
            <Icon 
              name={hasCheckinToday ? "check-circle" : "clipboard-text-outline"} 
              size={20} 
              color={hasCheckinToday ? "#1697F5" : "#FFFFFF"} 
            />
            <Text style={[
              styles.checkinButtonText,
              hasCheckinToday && styles.checkinButtonTextCompleted
            ]}>
              {hasCheckinToday ? 'Check-in Completed ✓' : 'Daily Check-in'}
            </Text>
          </View>
          {!hasCheckinToday && (
            <Icon name="chevron-right" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <View style={styles.daysSection}>
          <Text style={styles.sectionTitle}>Tasks</Text>
          
          {/* Days Navigation - Smaller and Discreet */}
          {protocol?.protocol?.days && protocol.protocol.days.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.daysScrollContainer}
            >
              {protocol.protocol.days.map((day, index) => {
                const isToday = day.dayNumber === getTodayDayNumber();
                const isSelected = selectedDay ? selectedDay.dayNumber === day.dayNumber : isToday;
                
                return (
                  <TouchableOpacity
                    key={day.dayNumber}
                    style={[
                      styles.dayCard,
                      isSelected && styles.dayCardSelected,
                      isToday && styles.dayCardToday
                    ]}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberSelected,
                      isToday && styles.dayNumberToday
                    ]}>
                      {day.dayNumber}
                    </Text>
                    <Text style={[
                      styles.dayLabel,
                      isSelected && styles.dayLabelSelected,
                      isToday && styles.dayLabelToday
                    ]}>
                      {isToday ? 'Today' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          
          {/* Selected Day View */}
          {protocol?.protocol?.days && protocol.protocol.days.length > 0 && (
            <View style={styles.currentDaySection}>
              {(() => {
                const dayToShow = selectedDay || protocol.protocol.days.find(day => day.dayNumber === getTodayDayNumber());
                
                if (!dayToShow) {
                  return (
                    <View style={styles.noTasksContainer}>
                      <Icon name="calendar-blank" size={48} color="#94a3b8" />
                      <Text style={styles.noTasksText}>No tasks available</Text>
                    </View>
                  );
                }
                
                const isToday = dayToShow.dayNumber === getTodayDayNumber();
                
                return (
                  <>
                    <View style={styles.todayHeader}>
                      <Text style={styles.todayTitle}>
                        Day {dayToShow.dayNumber}
                      </Text>
                      <Text style={styles.todayDate}>
                        {protocol?.startDate ? 
                          formatDate(protocol, dayToShow.dayNumber) :
                          'Not started yet'}
                      </Text>
                      {isToday && (
                        <Text style={styles.todaySubtitle}>
                          {protocol?.startDate ? 
                            `(Based on start date: ${formatSimpleDate(protocol.startDate)})` :
                            '(Protocol not started yet)'}
                        </Text>
                      )}
                    </View>
                    
                    {renderExpandedDayView(dayToShow)}
                  </>
                );
              })()}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Navigation */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          <TouchableOpacity
            style={styles.floatingNavButton}
            onPress={() => setSymptomReportModalVisible(true)}
          >
            <Icon name="medical-bag" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.navDivider} />

          <TouchableOpacity
            style={styles.floatingNavButton}
            onPress={() => navigation.navigate('Courses', { 
              protocolId: protocol?.protocol?.id,
              protocolName: protocol?.protocol?.name
            })}
          >
            <Icon name="book-open-variant" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.navDivider} />

          <TouchableOpacity
            style={styles.floatingNavButton}
            onPress={() => setReferralModalVisible(true)}
          >
            <Icon name="account-multiple-plus" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Referral Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={referralModalVisible}
        onRequestClose={() => setReferralModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.referralModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refer Someone</Text>
              <TouchableOpacity
                onPress={() => setReferralModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#7F8589" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.referralModalBody}>
              <Text style={styles.referralModalDescription}>
                Help someone by recommending this protocol. We'll send them an invitation.
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter their name"
                  placeholderTextColor="#94a3b8"
                  value={referralForm.name}
                  onChangeText={(text) => setReferralForm(prev => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter their email"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={referralForm.email}
                  onChangeText={(text) => setReferralForm(prev => ({ ...prev, email: text }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Phone (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter their phone number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={referralForm.phone}
                  onChangeText={(text) => setReferralForm(prev => ({ ...prev, phone: text }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Add a personal note"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={referralForm.notes}
                  onChangeText={(text) => setReferralForm(prev => ({ ...prev, notes: text }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setReferralModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submittingReferral && styles.submitButtonDisabled]}
                onPress={handleSubmitReferral}
                disabled={submittingReferral}
              >
                {submittingReferral ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Send Invitation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderSessionModal()}
      
      {/* Daily Check-in Modal */}
      <DailyCheckinModal
        visible={checkinModalVisible}
        onClose={() => setCheckinModalVisible(false)}
        protocolId={protocol?.protocol?.id}
        onComplete={handleCheckinComplete}
      />
      
      {/* Symptom Report Modal */}
      <SymptomReportModal
        visible={symptomReportModalVisible}
        onClose={() => setSymptomReportModalVisible(false)}
        protocolId={protocol?.protocol?.id}
        protocolName={protocol?.protocol?.name}
        currentDay={protocol?.protocol?.days[currentDayIndex]?.dayNumber || 1}
        onComplete={handleSymptomReportComplete}
      />
      
      {/* Toast Notification */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 0],
                  }),
                },
              ],
            },
            toastType === 'error' ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <Icon 
            name={toastType === 'error' ? 'alert-circle' : 'check-circle'} 
            size={20} 
            color="#FFFFFF" 
          />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Start Protocol Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={startProtocolModalVisible}
        onRequestClose={() => setStartProtocolModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>Start Protocol</Text>
              <TouchableOpacity
                onPress={() => setStartProtocolModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#7F8589" />
              </TouchableOpacity>
            </View>

            <View style={styles.confirmModalBody}>
              <Icon name="calendar-check" size={48} color="#61aed0" style={styles.confirmModalIcon} />
              <Text style={styles.confirmModalText}>
                You are about to start your protocol. The start date will be set to today, and this will be considered as Day 1 of your protocol.
              </Text>
              <Text style={styles.confirmModalSubtext}>
                Make sure you're ready to begin your treatment journey.
              </Text>
            </View>

            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setStartProtocolModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleStartProtocolConfirm}
              >
                <Text style={styles.confirmButtonText}>Start Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showConfirmModal && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Iniciar Protocolo</Text>
            <Text style={styles.modalText}>
              O protocolo começará hoje. Você receberá notificações diárias para acompanhamento.
              Deseja continuar?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleStartProtocol}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16171b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16171b',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16171b',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 24,
    fontFamily: 'ManropeSemiBold',
  },
  backButton: {
    backgroundColor: '#1697F5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeSemiBold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#16171b',
    borderBottomWidth: 1,
    borderBottomColor: '#1d1e24',
  },
  backIconButton: {
    padding: 8,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
    fontFamily: 'ManropeRegular',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  protocolInfo: {
    backgroundColor: '#26272c',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  protocolImage: {
    width: '100%',
    height: 200,
  },
  protocolContent: {
    padding: 16,
  },
  protocolDescription: {
    fontSize: 16,
    color: '#f1f5f9',
    lineHeight: 24,
    marginBottom: 16,
    fontFamily: 'ManropeRegular',
  },
  protocolDetails: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginLeft: 8,
    fontFamily: 'ManropeRegular',
  },
  daysSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#f8fafc',
    marginBottom: 16,
    fontFamily: 'ManropeSemiBold',
  },
  currentDaySection: {
    padding: 16,
    backgroundColor: '#26272c',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  todayHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  todayTitle: {
    fontSize: 20,
    color: '#f8fafc',
    marginBottom: 4,
    fontFamily: 'ManropeBold',
  },
  todayDate: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  todaySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontFamily: 'ManropeRegular',
  },
  expandedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expandedDayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  expandedDayProgress: {
    fontSize: 14,
    color: '#94a3b8',
  },
  expandedDayDescription: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
    marginBottom: 16,
  },
  expandedProgressContainer: {
    marginBottom: 16,
  },
  expandedProgressBackground: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
  },
  expandedProgressFill: {
    height: '100%',
    backgroundColor: '#61aed0',
    borderRadius: 2,
  },
  expandedTasksList: {
    marginBottom: 16,
  },
  expandedTasksTitle: {
    fontSize: 18,
    color: '#1697F5',
    marginBottom: 16,
    fontFamily: 'ManropeSemiBold',
  },
  expandedTaskItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#1d1e24',
  },
  expandedTaskItemCompleted: {
    backgroundColor: '#1e3a2e',
    borderColor: '#4ade80',
  },
  expandedTaskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedTaskInfo: {
    flex: 1,
  },
  expandedTaskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  expandedTaskTitleCompleted: {
    color: '#4ade80',
  },
  expandedTaskSession: {
    fontSize: 14,
    color: '#94a3b8',
  },
  expandedTaskDescription: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 2,
  },
  expandedTaskDescriptionCompleted: {
    color: '#4ade80',
  },
  expandedTaskStatus: {
    marginLeft: 12,
  },
  checkinButton: {
    backgroundColor: '#26272c',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkinButtonCompleted: {
    backgroundColor: '#1e3a2e',
    borderColor: '#4ade80',
  },
  checkinButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkinButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'ManropeMedium',
  },
  checkinButtonTextCompleted: {
    color: '#4ade80',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#26272c',
    borderRadius: 16,
    maxHeight: height * 0.8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1e24',
  },
  modalTitle: {
    fontSize: 18,
    color: '#f8fafc',
    flex: 1,
    fontFamily: 'ManropeSemiBold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: height * 0.5,
  },
  sessionTitle: {
    fontSize: 20,
    color: '#1697F5',
    marginBottom: 12,
    fontFamily: 'ManropeSemiBold',
  },
  sessionDescription: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
    marginBottom: 16,
    fontFamily: 'ManropeRegular',
  },
  sessionNavigation: {
    marginBottom: 16,
  },
  sessionNavigationTitle: {
    fontSize: 16,
    color: '#1697F5',
    marginBottom: 8,
    fontFamily: 'ManropeMedium',
  },
  sessionNavButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#1d1e24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sessionNavButtonActive: {
    backgroundColor: '#1697F5',
  },
  sessionNavButtonText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontFamily: 'ManropeRegular',
  },
  sessionNavButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: 'ManropeMedium',
  },
  tasksSection: {
    marginBottom: 16,
  },
  tasksSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
  },
  taskCard: {
    backgroundColor: '#1d1e24',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  taskTitleCompleted: {
    color: '#4ade80',
  },
  taskDescription: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 2,
  },
  taskDescriptionCompleted: {
    color: '#4ade80',
  },
  taskStatus: {
    marginLeft: 12,
  },
  taskCompletedInfo: {
    marginTop: 8,
  },
  taskCompletedText: {
    fontSize: 14,
    color: '#4ade80',
  },
  taskNotes: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 4,
  },
  taskDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  taskDetailText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginLeft: 8,
  },
  completeTaskButton: {
    padding: 8,
  },
  noTasksText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  noTasksContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  toastError: {
    backgroundColor: '#EF4444',
  },
  toastSuccess: {
    backgroundColor: '#4ade80',
  },
  toastText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
    fontFamily: 'ManropeMedium',
  },
  symptomReportButton: {
    display: 'none',
  },
  symptomReportButtonContent: {
    display: 'none',
  },
  symptomReportButtonText: {
    display: 'none',
  },
  symptomReportSection: {
    display: 'none',
  },
  sessionGroup: {
    marginBottom: 16,
  },
  sessionCategoryHeader: {
    fontSize: 16,
    color: '#1697F5',
    marginBottom: 8,
    fontFamily: 'ManropeSemiBold',
  },
  daysScrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dayCard: {
    backgroundColor: '#26272c',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    minWidth: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayCardSelected: {
    backgroundColor: '#1697F5',
    borderColor: '#1697F5',
  },
  dayCardToday: {
    backgroundColor: '#1e293b',
    borderColor: '#1697F5',
    borderWidth: 2,
  },
  dayNumber: {
    fontSize: 16,
    color: '#f1f5f9',
    fontFamily: 'ManropeBold',
    marginBottom: 2,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    color: '#1697F5',
  },
  dayLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  dayLabelSelected: {
    color: '#FFFFFF',
  },
  dayLabelToday: {
    color: '#1697F5',
  },
  daysNavigation: {
    marginBottom: 16,
  },
  dayNavButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  dayNavButtonActive: {
    backgroundColor: '#1697F5',
  },
  dayNavButtonText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontFamily: 'ManropeRegular',
  },
  dayNavButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: 'ManropeMedium',
  },
  // Progress section styles
  progressSection: {
    backgroundColor: '#26272c',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  progressPercentage: {
    fontSize: 16,
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1697F5',
    borderRadius: 2,
  },
  progressDetails: {
    gap: 8,
  },
  progressDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDetailText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // Removido backgroundColor e borderRadius para deixar transparente
  },
  logo: {
    width: 32,
    height: 32,
  },
  startProtocolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1697F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  startProtocolButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'ManropeSemiBold',
  },
  confirmModalContent: {
    backgroundColor: '#26272c',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1e24',
  },
  confirmModalTitle: {
    fontSize: 20,
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  confirmModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  confirmModalIcon: {
    marginBottom: 16,
  },
  confirmModalText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'ManropeRegular',
  },
  confirmModalSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'ManropeRegular',
  },
  confirmModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#1d1e24',
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontFamily: 'ManropeMedium',
  },
  confirmButton: {
    backgroundColor: '#1697F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeMedium',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#26272c',
    padding: 20,
    borderRadius: 8,
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#f8fafc',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#cbd5e1',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  coursesSection: {
    marginTop: 16,
  },
  coursesSectionTitle: {
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 12,
    fontFamily: 'ManropeSemiBold',
  },
  courseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d1e24',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  courseLinkText: {
    flex: 1,
    fontSize: 14,
    color: '#f1f5f9',
    marginLeft: 8,
    fontFamily: 'ManropeRegular',
  },
  loadingLogo: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  loadingSpinner: {
    transform: [{ scale: 0.8 }],
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#f8fafc',
    backgroundColor: '#1d1e24',
    fontFamily: 'ManropeRegular',
  },
  categoryOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#1d1e24',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1d1e24',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  referralButton: {
    display: 'none',
  },
  referralButtonContent: {
    display: 'none',
  },
  referralButtonText: {
    display: 'none',
  },
  referralModalContent: {
    backgroundColor: '#26272c',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  referralModalBody: {
    padding: 20,
  },
  referralModalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    fontFamily: 'ManropeRegular',
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#f1f5f9',
    marginBottom: 8,
    fontFamily: 'ManropeMedium',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1d1e24',
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#1697F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeMedium',
  },
  floatingNavContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(22, 23, 27, 0.85)', // Mais escuro e transparente
    borderRadius: 50,
    paddingVertical: 8, // Reduzido por não ter mais texto
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.1)', // Borda mais sutil
  },
  floatingNavButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  navDivider: {
    width: 1,
    height: '40%', // Reduzido para ficar mais sutil
    backgroundColor: 'rgba(74, 222, 128, 0.1)', // Mais transparente
    alignSelf: 'center',
  },
});

export default ProtocolScreen; 