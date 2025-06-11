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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';
import DailyCheckinModal from '../components/DailyCheckinModal';
import SymptomReportModal from '../components/SymptomReportModal';
import dailyCheckinService from '../services/dailyCheckinService';

const logger = createLogger('ProtocolScreen');
const { width, height } = Dimensions.get('window');

const ProtocolScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { protocol: initialProtocol } = route.params;

  const [protocol, setProtocol] = useState(initialProtocol);
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

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  const getCurrentDayIndex = (protocolData = protocol) => {
    if (!protocolData?.protocol?.days || !protocolData?.startDate) return 0;
    
    const startDate = new Date(protocolData.startDate);
    const today = new Date();
    
    // Calculate days difference
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because day 1 is the start date
    
    // Find the day that matches today's day number
    const todayDayIndex = protocolData.protocol.days.findIndex(day => day.dayNumber === diffDays);
    
    // If today's day exists, return its index, otherwise return the current day from protocol
    if (todayDayIndex !== -1) {
      return todayDayIndex;
    }
    
    // Fallback to protocol's current day
    const currentDay = protocolData.currentDay || 1;
    const currentDayIndex = protocolData.protocol.days.findIndex(day => day.dayNumber === currentDay);
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
      const protocolId = protocol?.protocol?.id;
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

  useEffect(() => {
    if (initialProtocol) {
      setProtocol(initialProtocol);
      loadProtocolProgress();
      loadCheckinStatus();
      setLoading(false);
      
      // Set current day index to today's day
      if (initialProtocol.protocol?.days) {
        const todayIndex = getCurrentDayIndex(initialProtocol);
        setCurrentDayIndex(todayIndex);
      }
    }
  }, [initialProtocol]);

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
      // Usar o ID do protocolo template, não do assignment
      const protocolId = protocol.protocol?.id || protocol.id;
      logger.debug('Carregando progresso do protocolo', { protocolId });
      
      const response = await apiClient.get(`/api/protocols/progress?protocolId=${protocolId}`);
      
      // Organizar progresso por tarefa ID para fácil acesso
      const progressMap = {};
      if (response && Array.isArray(response)) {
        response.forEach(item => {
          if (item.protocolTaskId) {
            progressMap[item.protocolTaskId] = item;
          }
        });
      }
      
      setProgress(progressMap);
      logger.info('Progresso do protocolo carregado', { totalItems: response?.length || 0 });
    } catch (error) {
      logger.error('Erro ao carregar progresso do protocolo:', error);
      // Não mostrar erro para o usuário, apenas log
    }
  };

  const loadProtocolDetails = async () => {
    try {
      setLoading(true);
      logger.debug('Recarregando detalhes do protocolo');
      
      // Buscar protocolos atualizados
      const response = await apiClient.get('/api/protocols/assignments');
      const updatedProtocol = response.find(p => p.id === protocol.id);
      
      if (updatedProtocol) {
        setProtocol(updatedProtocol);
        
        // Recalculate today's day index
        if (updatedProtocol.protocol?.days) {
          const todayIndex = getCurrentDayIndex(updatedProtocol);
          setCurrentDayIndex(todayIndex);
        }
        
        logger.info('Protocolo atualizado com sucesso');
      }
      
      // Recarregar progresso também
      await loadProtocolProgress();
    } catch (error) {
      logger.error('Erro ao recarregar protocolo:', error);
      showToast('Unable to update the protocol.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProtocolDetails();
    await loadCheckinStatus();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US');
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#10B981';
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
    const dayIndex = protocol.protocol.days.findIndex(d => d.id === day.id);
    setCurrentDayIndex(dayIndex);
    setSelectedDay(day);
    if (day.sessions && day.sessions.length > 0) {
      // Encontrar a primeira sessão com tarefas
      const sessionWithTasks = day.sessions.find(session => session.tasks && session.tasks.length > 0);
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
      
      if (isCurrentlyCompleted) {
        // Desmarcar tarefa - fazer DELETE
        logger.debug('Desmarcando tarefa', { taskId: task.id });
        
        const progressItem = getSessionProgress(task.id);
        if (progressItem && progressItem.id) {
          await apiClient.delete(`/api/protocols/progress/${progressItem.id}`);
          showToast('Task unmarked! ✅', 'success');
        }
      } else {
        // Marcar tarefa como completa - fazer POST
        logger.debug('Marcando tarefa como completa', { taskId: task.id });
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        const requestData = {
          protocolTaskId: task.id,
          date: today,
          notes: `Task "${task.title}" completed by patient`
        };
        
        await apiClient.post('/api/protocols/progress', requestData);
        showToast('Success! 🎉', 'success');
      }
      
      // Recarregar progresso
      await loadProtocolProgress();
      
    } catch (error) {
      logger.error('Erro ao alterar status da tarefa:', error);
      const action = isSessionCompleted(task.id) ? 'unmark' : 'mark';
      showToast(`Unable to ${action} the task. Please try again.`, 'error');
    } finally {
      setCompletingTask(false);
      setCompletingTaskId(null);
    }
  };

  const isSessionCompleted = (taskId) => {
    return progress[taskId] !== undefined;
  };

  const getSessionProgress = (taskId) => {
    return progress[taskId] || null;
  };

  const renderExpandedDayView = (day) => {
    if (!day) return null;

    // Get all tasks from all sessions for this day
    const allTasks = [];
    day.sessions?.forEach(session => {
      if (session.tasks) {
        session.tasks.forEach(task => {
          allTasks.push({
            ...task,
            sessionTitle: session.title,
            sessionNumber: session.sessionNumber
          });
        });
      }
    });

    const completedTasks = allTasks.filter(task => isSessionCompleted(task.id)).length;
    const totalTasks = allTasks.length;
    const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return (
      <>
        <View style={styles.expandedDayHeader}>
          <Text style={styles.expandedDayTitle}>{day.title}</Text>
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
                  backgroundColor: progressPercentage === 100 ? '#10B981' : '#0088FE'
                }
              ]} 
            />
          </View>
        </View>

        {/* Tasks List */}
        <View style={styles.expandedTasksList}>
          <Text style={styles.expandedTasksTitle}>Today's Tasks:</Text>
          
          {allTasks.length > 0 ? (
            allTasks.map((task, index) => {
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
                        {task.title}
                      </Text>
                      <Text style={styles.expandedTaskSession}>
                        {task.sessionTitle}
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
                        <ActivityIndicator size="small" color="#0088FE" />
                      ) : (
                        <Icon 
                          name={isCompleted ? "check-circle" : "circle-outline"} 
                          size={24} 
                          color={isCompleted ? "#10B981" : "#0088FE"} 
                        />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
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
                Day {selectedDay.dayNumber} - {currentSession.title}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sessionTitle}>{currentSession.title}</Text>
              
              {currentSession.description && (
                <Text style={styles.sessionDescription}>
                  {currentSession.description}
                </Text>
              )}

              {/* Navegação entre sessões */}
              {selectedDay.sessions && selectedDay.sessions.length > 1 && (
                <View style={styles.sessionNavigation}>
                  <Text style={styles.sessionNavigationTitle}>Other sessions of the day:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedDay.sessions.map((session, index) => (
                      <TouchableOpacity
                        key={session.id}
                        style={[
                          styles.sessionNavButton,
                          currentSession.id === session.id && styles.sessionNavButtonActive
                        ]}
                        onPress={() => setCurrentSession(session)}
                      >
                        <Text style={[
                          styles.sessionNavButtonText,
                          currentSession.id === session.id && styles.sessionNavButtonTextActive
                        ]}>
                          Session {session.sessionNumber}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Lista de tarefas */}
              <View style={styles.tasksSection}>
                <Text style={styles.tasksSectionTitle}>Tasks for this session:</Text>
                
                {currentSession.tasks && currentSession.tasks.length > 0 ? (
                  currentSession.tasks.map((task, index) => {
                    const taskProgress = getSessionProgress(task.id);
                    const isCompleted = isSessionCompleted(task.id);
                    
                    return (
                      <View key={task.id} style={styles.taskCard}>
                        <View style={styles.taskHeader}>
                          <View style={styles.taskInfo}>
                            <Text style={[
                              styles.taskTitle,
                              isCompleted && styles.taskTitleCompleted
                            ]}>
                              {task.title}
                            </Text>
                            {task.description && (
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
                                disabled={completingTask && task.id === completingTaskId}
                              >
                                {completingTask && task.id === completingTaskId ? (
                                  <ActivityIndicator size="small" color="#10B981" />
                                ) : (
                                  <Icon name="check-circle" size={24} color="#10B981" />
                                )}
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.completeTaskButton}
                                onPress={() => handleSessionComplete(task)}
                                disabled={completingTask && task.id === completingTaskId}
                              >
                                {completingTask && task.id === completingTaskId ? (
                                  <ActivityIndicator size="small" color="#0088FE" />
                                ) : (
                                  <Icon name="circle-outline" size={24} color="#0088FE" />
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {isCompleted && taskProgress && (
                          <View style={styles.taskCompletedInfo}>
                            <Text style={styles.taskCompletedText}>
                              Completed on {new Date(taskProgress.date).toLocaleDateString('en-US')}
                            </Text>
                            {taskProgress.notes && (
                              <Text style={styles.taskNotes}>
                                {taskProgress.notes}
                              </Text>
                            )}
                          </View>
                        )}

                        {task.duration && (
                          <View style={styles.taskDetail}>
                            <Icon name="clock" size={14} color="#6B7280" />
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
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
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backIconButton}
        >
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{protocol.protocol.name}</Text>
          <Text style={styles.headerSubtitle}>
            Dr. {protocol.protocol.doctor.name}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(protocol.status) }]}>
          <Text style={styles.statusText}>{getStatusText(protocol.status)}</Text>
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
            colors={['#0088FE']}
            tintColor="#0088FE"
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
            source={{ uri: getProtocolImage(protocol.protocol) }}
            style={styles.protocolImage}
            resizeMode="cover"
          />
          
          <View style={styles.protocolContent}>
            <Text style={styles.protocolDescription}>
              {protocol.protocol.description}
            </Text>

            <View style={styles.protocolDetails}>
              <View style={styles.detailRow}>
                <Icon name="calendar" size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {formatDate(protocol.startDate)} - {formatDate(protocol.endDate)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Icon name="clock" size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {protocol.protocol.duration} days • Current day: {protocol.currentDay || 1}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.daysSection}>
          <Text style={styles.sectionTitle}>Protocol Schedule</Text>
          
          {/* Today's Day Fixed View */}
          {protocol.protocol.days && protocol.protocol.days.length > 0 && (
            <View style={styles.currentDaySection}>
              <View style={styles.todayHeader}>
                <Text style={styles.todayTitle}>
                  Today - Day {protocol.protocol.days[currentDayIndex]?.dayNumber}
                </Text>
                <Text style={styles.todayDate}>
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
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
                    color={hasCheckinToday ? "#10B981" : "#0088FE"} 
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
                  <Icon name="chevron-right" size={20} color="#0088FE" />
                )}
              </TouchableOpacity>
              
              {/* Symptom Report Button */}
              <TouchableOpacity
                style={styles.symptomReportButton}
                onPress={() => setSymptomReportModalVisible(true)}
              >
                <View style={styles.symptomReportButtonContent}>
                  <Icon 
                    name="medical-bag" 
                    size={20} 
                    color="#EF4444" 
                  />
                  <Text style={styles.symptomReportButtonText}>
                    Report Symptoms
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>
              
              {renderExpandedDayView(protocol.protocol.days[currentDayIndex])}
            </View>
          )}
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
        currentDay={protocol.protocol.days[currentDayIndex]?.dayNumber || 1}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#0088FE',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backIconButton: {
    padding: 8,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
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
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  protocolDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  daysSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  currentDaySection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  todayHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  todayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  todayDate: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#1F2937',
  },
  expandedDayProgress: {
    fontSize: 14,
    color: '#6B7280',
  },
  expandedDayDescription: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  expandedProgressContainer: {
    marginBottom: 16,
  },
  expandedProgressBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  expandedProgressFill: {
    height: '100%',
    backgroundColor: '#0088FE',
    borderRadius: 2,
  },
  expandedTasksList: {
    marginBottom: 16,
  },
  expandedTasksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  expandedTaskItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
  },
  expandedTaskItemCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
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
    color: '#1F2937',
  },
  expandedTaskTitleCompleted: {
    color: '#10B981',
  },
  expandedTaskSession: {
    fontSize: 14,
    color: '#6B7280',
  },
  expandedTaskDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  expandedTaskDescriptionCompleted: {
    color: '#059669',
  },
  expandedTaskStatus: {
    marginLeft: 12,
  },
  checkinButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 16,
  },
  checkinButtonCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  checkinButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  checkinButtonTextCompleted: {
    color: '#10B981',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
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
    color: '#1F2937',
    marginBottom: 12,
  },
  sessionDescription: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  sessionNavigation: {
    marginBottom: 16,
  },
  sessionNavigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  sessionNavButton: {
    padding: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  sessionNavButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0088FE',
  },
  sessionNavButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  sessionNavButtonTextActive: {
    color: '#0088FE',
    fontWeight: '600',
  },
  tasksSection: {
    marginBottom: 16,
  },
  tasksSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#1F2937',
  },
  taskTitleCompleted: {
    color: '#10B981',
  },
  taskDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  taskDescriptionCompleted: {
    color: '#059669',
  },
  taskStatus: {
    marginLeft: 12,
  },
  taskCompletedInfo: {
    marginTop: 8,
  },
  taskCompletedText: {
    fontSize: 14,
    color: '#10B981',
  },
  taskNotes: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  taskDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  taskDetailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  completeTaskButton: {
    padding: 8,
  },
  noTasksText: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#10B981',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 16,
  },
  symptomReportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symptomReportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
});

export default ProtocolScreen; 