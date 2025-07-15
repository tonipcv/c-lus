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
      if (!protocolId) return;
      
      logger.debug('Carregando status do check-in', { protocolId });
      const data = await dailyCheckinService.getCheckinData(protocolId);
      setHasCheckinToday(data.hasCheckinToday);
      
      logger.info('Status do check-in carregado', { hasCheckinToday: data.hasCheckinToday });
    } catch (error) {
      logger.error('Erro ao carregar status do check-in:', error);
      // Não mostrar erro para o usuário, apenas log
    } finally {
      setLoadingCheckinStatus(false);
    }
  };

  const handleCheckinComplete = (message) => {
    showToast(message, 'success');
    setHasCheckinToday(true);
  };

  const handleSymptomReportComplete = (message) => {
    showToast(message, 'success');
  };

  const handleStartProtocol = async () => {
    if (!assignment) {
      Alert.alert('Error', 'Protocol not found.');
      return;
    }

    try {
      setStartingProtocol(true);
      logger.debug('Starting protocol', { 
        assignmentId: assignment.id,
        startDate: assignment.startDate
      });

      // Use the correct endpoint structure with protocol and prescription IDs
      const response = await apiClient.post(
        `/api/protocols/${assignment.protocol.id}/prescriptions/${assignment.id}/start`
      );
      
      if (response) {
        logger.info('Protocol started successfully', response);
        
        // Update the local protocol data with the response
        if (response.startDate) {
          setProtocol(prevProtocol => ({
            ...prevProtocol,
            startDate: response.startDate,
            status: 'ACTIVE',
            currentDay: 1
          }));
        }
        
        // Reload the full protocol data
        await loadProtocolAssignment();
        
        Alert.alert('Success', 'Protocol started successfully!');
      }
    } catch (error) {
      logger.error('Error starting protocol:', error);
      
      // Handle specific error when protocol is already started
      if (error.response?.status === 400 && error.response?.data?.startDate) {
        const startDate = new Date(error.response.data.startDate).toLocaleDateString();
        Alert.alert(
          'Protocol Already Started',
          `This protocol was already started on ${startDate}.`
        );
        
        // Update local state with the returned start date
        setProtocol(prevProtocol => ({
          ...prevProtocol,
          startDate: error.response.data.startDate,
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
    setStartProtocolModalVisible(false);
    await handleStartProtocol();
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
      const protocolId = protocol?.protocol?.id;
      if (!protocolId) {
        logger.warn('No protocol ID available for loading progress');
        return;
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      logger.debug('Carregando progresso do protocolo', { 
        protocolId,
        date: today
      });
      
      const response = await apiClient.get(`/api/protocols/progress?protocolId=${protocolId}&date=${today}`);
      
      logger.debug('Progress response:', { 
        responseData: response,
        responseLength: response?.length
      });
      
      // Organizar progresso por tarefa ID para fácil acesso
      const progressMap = {};
      if (response && Array.isArray(response)) {
        response.forEach(item => {
          if (item.protocolTask?.id) {
            progressMap[item.protocolTask.id] = {
              ...item,
              protocolTaskId: item.protocolTask.id,
              isCompleted: Boolean(item.isCompleted)
            };
          }
        });

        // Atualizar o estado imediatamente
        setProgress(progressMap);
        
        logger.info('Progresso do protocolo carregado', { 
          totalItems: response.length,
          completedItems: Object.values(progressMap).filter(p => p.isCompleted).length,
          progressMap: progressMap
        });
      } else {
        logger.warn('Resposta de progresso inválida', { response });
      }
    } catch (error) {
      logger.error('Erro ao carregar progresso do protocolo:', error);
    }
  };

  const loadProtocolDetails = async () => {
    try {
      setLoading(true);
      logger.debug('Recarregando detalhes do protocolo');
      
      // Buscar protocolos atualizados
      const response = await apiClient.get('/api/protocols/assignments');
      const updatedProtocol = response.find(p => p.id === protocol?.id);
      
      if (updatedProtocol) {
        setProtocol(updatedProtocol);
        
        // Recalculate today's day index
        if (updatedProtocol.protocol?.days) {
          const todayIndex = getCurrentDayIndex(updatedProtocol);
          setCurrentDayIndex(todayIndex);
        }
        
        // Recarregar progresso usando o protocolo atualizado
        const progressResponse = await apiClient.get(`/api/protocols/prescriptions/${updatedProtocol.id}/progress`);
        
        logger.debug('Progress response on reload:', { 
          responseData: progressResponse,
          responseLength: progressResponse?.length
        });
        
        // Organizar progresso por tarefa ID para fácil acesso
        const progressMap = {};
        if (progressResponse && Array.isArray(progressResponse)) {
          progressResponse.forEach(item => {
            if (item.protocolTaskId) {
              progressMap[item.protocolTaskId] = {
                ...item,
                isCompleted: Boolean(item.isCompleted) // Garantir que seja booleano
              };
            }
          });

          // Atualizar o estado imediatamente
          setProgress(progressMap);
          
          logger.info('Progresso recarregado', { 
            totalItems: progressResponse.length,
            completedItems: Object.values(progressMap).filter(p => p.isCompleted).length
          });
        }
        
        logger.info('Protocolo atualizado com sucesso');
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
      
      // Primeiro carrega os detalhes do protocolo (que já inclui o progresso)
      await loadProtocolDetails();
      
      // Por último carrega o status do check-in
      await loadCheckinStatus();
      
      logger.info('Refresh completo com sucesso');
    } catch (error) {
      logger.error('Erro durante o refresh:', error);
      showToast('Erro ao atualizar. Tente novamente.', 'error');
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
    
    if (day?.sessions && day.sessions.length > 0) {
      // Encontrar a primeira sessão com tarefas
      const sessionWithTasks = day.sessions.find(session => session?.tasks && session.tasks.length > 0);
      if (sessionWithTasks) {
        setCurrentSession(sessionWithTasks);
        setModalVisible(true);
      } else {
        showToast('This day has no available tasks.', 'error');
      }
    } else {
      showToast('This day has no available sessions.', 'error');
    }
  };

  const handleSessionComplete = async (task) => {
    try {
      setCompletingTask(true);
      setCompletingTaskId(task.id);
      
      const isCurrentlyCompleted = isSessionCompleted(task.id);
      
      logger.debug('Alternando status da tarefa', { 
        taskId: task.id, 
        currentStatus: isCurrentlyCompleted ? 'completed' : 'pending' 
      });
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const requestData = {
        protocolTaskId: task.id,
        date: today,
        notes: `Task "${task.title}" ${isCurrentlyCompleted ? 'unmarked' : 'completed'} by patient`
      };
      
      logger.debug('Enviando request de progresso:', requestData);
      
      const response = await apiClient.post('/api/protocols/progress', requestData);
      
      logger.debug('Task completion response:', response);
      
      if (response) {
        // Update local progress state immediately based on response
        setProgress(prevProgress => ({
          ...prevProgress,
          [task.id]: {
            ...response,
            protocolTaskId: task.id,
            isCompleted: Boolean(response.isCompleted)
          }
        }));
        
        // Show appropriate message based on the response
        showToast(response.isCompleted ? 'Success!' : 'Task unmarked!', 'success');
        
        // Also reload progress to ensure consistency
        await loadProtocolProgress();
      }
      
    } catch (error) {
      logger.error('Erro ao alterar status da tarefa:', error);
      const action = isCurrentlyCompleted ? 'unmark' : 'mark';
      showToast(`Unable to ${action} the task. Please try again.`, 'error');
    } finally {
      setCompletingTask(false);
      setCompletingTaskId(null);
    }
  };

  const isSessionCompleted = (taskId) => {
    if (!taskId || !progress) {
      logger.debug('isSessionCompleted: Missing taskId or progress', { taskId, hasProgress: !!progress });
      return false;
    }
    
    const taskProgress = progress[taskId];
    const isCompleted = taskProgress?.isCompleted === true;
    
    logger.debug('isSessionCompleted check:', {
      taskId,
      taskProgress,
      isCompleted,
      progressKeys: Object.keys(progress)
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
                <Icon name="close" size={24} color="#cccccc" />
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
              if (progress[task.id]?.completed) {
                completedTasks++;
              }
            });
          }
        });
      }
    });

    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { percentage, completed: completedTasks, total: totalTasks };
  };

  const loadProtocolAssignment = async () => {
    try {
      setLoading(true);
      logger.debug('Carregando atribuições de protocolo', { protocolId });
      
      // Verificar conectividade primeiro
      const isNetworkConnected = await isConnected();
      if (!isNetworkConnected) {
        logger.error('Sem conexão com a internet');
        throw new Error('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
      }

      // Verificar autenticação
      const token = await getToken();
      if (!token) {
        logger.error('Token não encontrado');
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }

      // Verificar validade do token
      const isValid = await isTokenValid();
      if (!isValid) {
        logger.error('Token inválido ou expirado');
        throw new Error('Sua sessão expirou. Por favor, faça login novamente.');
      }
      
      // Primeiro, buscar todas as atribuições
      const response = await apiClient.get('/api/protocols/assignments');
      
      logger.debug('Resposta da API:', {
        responseType: typeof response,
        isArray: Array.isArray(response),
        length: Array.isArray(response) ? response.length : 'N/A',
        data: response
      });

      const assignments = Array.isArray(response) ? response : [];
      
      // Encontrar a atribuição específica para este protocolo
      const currentAssignment = assignments.find(a => a.id === protocolId);
      
      if (currentAssignment) {
        logger.debug('Protocolo encontrado:', {
          id: currentAssignment.id,
          status: currentAssignment.status,
          startDate: currentAssignment.startDate,
          currentDay: currentAssignment.currentDay
        });
        
        setAssignment(currentAssignment);
        setProtocol(currentAssignment);
        
        // Carregar o progresso do protocolo usando o currentAssignment
        logger.debug('Carregando progresso com assignment:', { assignmentId: currentAssignment.id });
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const progressResponse = await apiClient.get(`/api/protocols/progress?protocolId=${currentAssignment.protocol.id}&date=${today}`);
        
        logger.debug('Progress response:', { 
          responseData: progressResponse,
          responseLength: progressResponse?.length
        });
        
        // Organizar progresso por tarefa ID para fácil acesso
        const progressMap = {};
        if (progressResponse && Array.isArray(progressResponse)) {
          progressResponse.forEach(item => {
            if (item.protocolTask?.id) {
              progressMap[item.protocolTask.id] = {
                ...item,
                isCompleted: Boolean(item.isCompleted)
              };
            }
          });

          // Atualizar o estado imediatamente
          setProgress(progressMap);
          
          logger.info('Progresso do protocolo carregado', { 
            totalItems: progressResponse.length,
            completedItems: Object.values(progressMap).filter(p => p.isCompleted).length,
            progressMap: progressMap
          });
        } else {
          logger.warn('Resposta de progresso inválida', { response: progressResponse });
        }
        
        logger.info('Atribuição de protocolo carregada com sucesso', { 
          assignmentId: currentAssignment.id,
          status: currentAssignment.status,
          startDate: currentAssignment.startDate,
          currentDay: currentAssignment.currentDay
        });
      } else {
        logger.warn('Atribuição de protocolo não encontrada', { 
          protocolId,
          availableAssignments: assignments.map(a => a.id)
        });
        Alert.alert('Aviso', 'Protocolo não encontrado ou não atribuído.');
      }
    } catch (error) {
      logger.error('Erro ao carregar atribuição de protocolo:', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Determinar mensagem de erro apropriada
      let errorMessage = 'Não foi possível carregar o protocolo. Tente novamente mais tarde.';
      
      if (error.message.includes('conexão')) {
        errorMessage = 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
      } else if (error.message.includes('sessão')) {
        errorMessage = 'Sua sessão expirou. Por favor, faça login novamente.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Protocolo não encontrado.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProtocolAssignment();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#61aed0" />
        <Text style={styles.loadingText}>Loading protocol...</Text>
      </View>
    );
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
      <StatusBar style="light" backgroundColor="#151515" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backIconButton}
        >
          <Icon name="arrow-left" size={24} color="#ffffff" />
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
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#61aed0']}
            tintColor="#61aed0"
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
                <Icon name="calendar" size={16} color="#666666" />
                <Text style={styles.detailText}>
                  {protocol?.status === 'ACTIVE' && protocol?.startDate ? 
                    `Started on ${formatSimpleDate(protocol.startDate)}` :
                    'Not started yet'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Icon name="clock" size={16} color="#666666" />
                <Text style={styles.detailText}>
                  {protocol?.status === 'ACTIVE' ?
                    `Day ${protocol?.currentDay || 1} of ${protocol?.protocol?.duration || 0}` :
                    `Duration: ${protocol?.protocol?.duration || 0} days`}
                </Text>
              </View>

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
            <Text style={styles.progressTitle}>Protocol Progress</Text>
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
                Day {protocol?.currentDay || 1} of {protocol?.protocol?.duration || 0}
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
              color={hasCheckinToday ? "#4ade80" : "#61aed0"} 
            />
            <Text style={[
              styles.checkinButtonText,
              hasCheckinToday && styles.checkinButtonTextCompleted
            ]}>
              {loadingCheckinStatus ? 'Loading...' : 
               hasCheckinToday ? 'Check-in Completed ✓' : 'Daily Check-in'}
            </Text>
          </View>
          {!hasCheckinToday && (
            <Icon name="chevron-right" size={20} color="#61aed0" />
          )}
        </TouchableOpacity>

        <View style={styles.daysSection}>
          <Text style={styles.sectionTitle}>Protocol Schedule</Text>
          
          {/* Days Navigation */}
          {protocol?.protocol?.days && protocol.protocol.days.length > 0 && (
            <>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.daysNavigation}
              >
                {protocol.protocol.days.map((day, index) => (
                  <TouchableOpacity
                    key={day.id}
                    style={[
                      styles.dayNavButton,
                      currentDayIndex === index && styles.dayNavButtonActive
                    ]}
                    onPress={() => setCurrentDayIndex(index)}
                  >
                    <Text style={[
                      styles.dayNavButtonText,
                      currentDayIndex === index && styles.dayNavButtonTextActive
                    ]}>
                      Day {day.dayNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Today's Day Fixed View */}
              <View style={styles.currentDaySection}>
                <View style={styles.todayHeader}>
                  <Text style={styles.todayTitle}>
                    Day {protocol?.protocol?.days[currentDayIndex]?.dayNumber || 1}
                  </Text>
                  <Text style={styles.todayDate}>
                    {protocol?.startDate ? 
                      formatDate(protocol, protocol.protocol.days[currentDayIndex]?.dayNumber) :
                      'Not started yet'}
                  </Text>
                  <Text style={styles.todaySubtitle}>
                    {protocol?.startDate ? 
                      `(Based on start date: ${formatSimpleDate(protocol.startDate)})` :
                      '(Protocol not started yet)'}
                  </Text>
                </View>
                
                {protocol?.protocol?.days[currentDayIndex] && renderExpandedDayView(protocol.protocol.days[currentDayIndex])}
              </View>
            </>
          )}
        </View>

        {/* Symptom Report Button at the end */}
        <View style={styles.symptomReportSection}>
          <TouchableOpacity
            style={styles.symptomReportButton}
            onPress={() => setSymptomReportModalVisible(true)}
          >
            <View style={styles.symptomReportButtonContent}>
              <Icon 
                name="medical-bag" 
                size={18} 
                color="#cccccc" 
              />
              <Text style={styles.symptomReportButtonText}>
                Report Symptoms
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
                <Icon name="close" size={24} color="#cccccc" />
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
    backgroundColor: '#151515',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#151515',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#cccccc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#151515',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#61aed0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#151515',
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
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
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 2,
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
    backgroundColor: '#0a0a0a',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#202020',
  },
  protocolImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  protocolContent: {
    padding: 16,
  },
  protocolDescription: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
    marginBottom: 16,
  },
  protocolDetails: {
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#cccccc',
    marginLeft: 8,
  },
  daysSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  currentDaySection: {
    padding: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#202020',
  },
  todayHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  todayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  todayDate: {
    fontSize: 14,
    color: '#cccccc',
  },
  todaySubtitle: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 4,
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
    color: '#ffffff',
  },
  expandedDayProgress: {
    fontSize: 14,
    color: '#cccccc',
  },
  expandedDayDescription: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
    marginBottom: 16,
  },
  expandedProgressContainer: {
    marginBottom: 16,
  },
  expandedProgressBackground: {
    height: 4,
    backgroundColor: '#252525',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  expandedTaskItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#0a0a0a',
  },
  expandedTaskItemCompleted: {
    backgroundColor: '#1a2e25',
    borderColor: '#7dd3b0',
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
    color: '#ffffff',
  },
  expandedTaskTitleCompleted: {
    color: '#7dd3b0',
  },
  expandedTaskSession: {
    fontSize: 14,
    color: '#cccccc',
  },
  expandedTaskDescription: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 2,
  },
  expandedTaskDescriptionCompleted: {
    color: '#7dd3b0',
  },
  expandedTaskStatus: {
    marginLeft: 12,
  },
  checkinButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#202020',
  },
  checkinButtonCompleted: {
    backgroundColor: '#1a2e25',
    borderColor: '#7dd3b0',
  },
  checkinButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkinButtonText: {
    fontSize: 16,
    color: '#61aed0',
    fontWeight: '600',
    marginLeft: 12,
  },
  checkinButtonTextCompleted: {
    color: '#7dd3b0',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
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
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  sessionDescription: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
    marginBottom: 16,
  },
  sessionNavigation: {
    marginBottom: 16,
  },
  sessionNavigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  sessionNavButton: {
    padding: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 8,
    backgroundColor: '#151515',
  },
  sessionNavButtonActive: {
    backgroundColor: '#1a3a5a',
    borderColor: '#61aed0',
  },
  sessionNavButtonText: {
    fontSize: 14,
    color: '#cccccc',
  },
  sessionNavButtonTextActive: {
    color: '#61aed0',
    fontWeight: '600',
  },
  tasksSection: {
    marginBottom: 16,
  },
  tasksSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  taskCard: {
    backgroundColor: '#151515',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#252525',
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
    color: '#ffffff',
  },
  taskTitleCompleted: {
    color: '#4ade80',
  },
  taskDescription: {
    fontSize: 14,
    color: '#cccccc',
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
    color: '#7dd3b0',
  },
  taskNotes: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 4,
  },
  taskDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  taskDetailText: {
    fontSize: 14,
    color: '#cccccc',
    marginLeft: 8,
  },
  completeTaskButton: {
    padding: 8,
  },
  noTasksText: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
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
    shadowOpacity: 0.25,
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
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
  },
  symptomReportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 8,
  },
  symptomReportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symptomReportButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#cccccc',
    marginLeft: 8,
  },
  symptomReportSection: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  sessionGroup: {
    marginBottom: 16,
  },
  sessionCategoryHeader: {
    fontSize: 16,
    fontWeight: '500',
    color: '#61aed0',
    marginBottom: 8,
  },
  daysNavigation: {
    marginBottom: 16,
  },
  dayNavButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
  },
  dayNavButtonActive: {
    backgroundColor: '#1a3a5a',
    borderColor: '#61aed0',
  },
  dayNavButtonText: {
    fontSize: 14,
    color: '#cccccc',
  },
  dayNavButtonTextActive: {
    color: '#61aed0',
    fontWeight: '600',
  },
  progressSection: {
    backgroundColor: '#0a0a0a',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#202020',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#252525',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#61aed0',
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
    color: '#cccccc',
  },
  logoContainer: {
    backgroundColor: '#151515',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#202020',
  },
  logo: {
    width: 24,
    height: 24,
  },
  startProtocolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#61aed0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  startProtocolButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  confirmModalContent: {
    backgroundColor: '#151515',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#202020',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  confirmModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  confirmModalIcon: {
    marginBottom: 16,
  },
  confirmModalText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  confirmModalSubtext: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 20,
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
    borderColor: '#252525',
  },
  cancelButtonText: {
    color: '#cccccc',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#61aed0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
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
    backgroundColor: '#151515',
    padding: 20,
    borderRadius: 8,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
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
  cancelButton: {
    backgroundColor: '#ff3b30',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ProtocolScreen; 