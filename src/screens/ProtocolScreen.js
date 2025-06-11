import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';

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

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (initialProtocol) {
      setProtocol(initialProtocol);
      loadProtocolProgress();
      setLoading(false);
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
        logger.info('Protocolo atualizado com sucesso');
      }
      
      // Recarregar progresso também
      await loadProtocolProgress();
    } catch (error) {
      logger.error('Erro ao recarregar protocolo:', error);
      Alert.alert('Error', 'Unable to update the protocol.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProtocolDetails();
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

  const handleDayPress = (day) => {
    setSelectedDay(day);
    if (day.sessions && day.sessions.length > 0) {
      // Encontrar a primeira sessão com tarefas
      const sessionWithTasks = day.sessions.find(session => session.tasks && session.tasks.length > 0);
      if (sessionWithTasks) {
        setCurrentSession(sessionWithTasks);
        setModalVisible(true);
      } else {
        Alert.alert('Notice', 'This day has no available tasks.');
      }
    } else {
      Alert.alert('Notice', 'This day has no available sessions.');
    }
  };

  const handleSessionComplete = async (task) => {
    try {
      setCompletingTask(true);
      
      const isCurrentlyCompleted = isSessionCompleted(task.id);
      
      if (isCurrentlyCompleted) {
        // Desmarcar tarefa - fazer DELETE
        logger.debug('Desmarcando tarefa', { taskId: task.id });
        
        const progressItem = getSessionProgress(task.id);
        if (progressItem && progressItem.id) {
          await apiClient.delete(`/api/protocols/progress/${progressItem.id}`);
          Alert.alert('Task unmarked! ✅', 'The task has been removed from your completed list.');
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
        Alert.alert('Success! 🎉', 'Task marked as complete!');
      }
      
      // Recarregar progresso
      await loadProtocolProgress();
      
    } catch (error) {
      logger.error('Erro ao alterar status da tarefa:', error);
      const action = isSessionCompleted(task.id) ? 'unmark' : 'mark';
      Alert.alert('Error', `Unable to ${action} the task. Please try again.`);
    } finally {
      setCompletingTask(false);
    }
  };

  const isSessionCompleted = (taskId) => {
    return progress[taskId] !== undefined;
  };

  const getSessionProgress = (taskId) => {
    return progress[taskId] || null;
  };

  const renderDayCard = (day, index) => {
    // Calcular progresso baseado nas tarefas, não nas sessões
    const allTasks = [];
    day.sessions?.forEach(session => {
      if (session.tasks) {
        allTasks.push(...session.tasks);
      }
    });
    
    const completedTasks = allTasks.filter(task => isSessionCompleted(task.id)).length;
    const totalTasks = allTasks.length;
    const isCompleted = totalTasks > 0 && completedTasks === totalTasks;
    const isCurrent = day.dayNumber === (protocol?.currentDay || 1);
    const hasProgress = completedTasks > 0;
    
    return (
      <TouchableOpacity
        key={day.id}
        style={[
          styles.dayCard,
          isCompleted && styles.dayCardCompleted,
          isCurrent && styles.dayCardCurrent,
          hasProgress && !isCompleted && styles.dayCardInProgress,
        ]}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.7}
      >
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={[
              styles.dayTitle,
              isCompleted && styles.dayTitleCompleted,
              isCurrent && styles.dayTitleCurrent,
            ]}>
              Day {day.dayNumber}
            </Text>
            <Text style={[
              styles.daySubtitle,
              isCompleted && styles.daySubtitleCompleted,
            ]}>
              {day.title}
            </Text>
          </View>
          
          <View style={styles.dayStatus}>
            {isCompleted && (
              <Icon name="check-circle" size={24} color="#10B981" />
            )}
            {hasProgress && !isCompleted && (
              <Icon name="progress-clock" size={24} color="#F59E0B" />
            )}
            {isCurrent && !hasProgress && (
              <Icon name="play-circle" size={24} color="#0088FE" />
            )}
            {!hasProgress && !isCurrent && (
              <Icon name="circle-outline" size={24} color="#9CA3AF" />
            )}
          </View>
        </View>

        {day.description && (
          <Text style={[
            styles.dayDescription,
            isCompleted && styles.dayDescriptionCompleted,
          ]} numberOfLines={2}>
            {day.description}
          </Text>
        )}

        <View style={styles.dayFooter}>
          <View style={styles.sessionCount}>
            <Icon name="play" size={14} color="#6B7280" />
            <Text style={styles.sessionCountText}>
              {completedTasks}/{totalTasks} tasks • {day.sessions?.length || 0} sessions
            </Text>
          </View>
          
          {isCompleted && (
            <Text style={styles.completedDayBadge}>Complete</Text>
          )}
          {hasProgress && !isCompleted && (
            <Text style={styles.progressDayBadge}>In Progress</Text>
          )}
          {isCurrent && !hasProgress && (
            <Text style={styles.currentDayBadge}>Current</Text>
          )}
        </View>

        {/* Barra de progresso */}
        {totalTasks > 0 && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${(completedTasks / totalTasks) * 100}%`,
                    backgroundColor: isCompleted ? '#10B981' : '#0088FE'
                  }
                ]} 
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
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
                                disabled={completingTask}
                              >
                                {completingTask ? (
                                  <ActivityIndicator size="small" color="#10B981" />
                                ) : (
                                  <Icon name="check-circle" size={24} color="#10B981" />
                                )}
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.completeTaskButton}
                                onPress={() => handleSessionComplete(task)}
                                disabled={completingTask}
                              >
                                {completingTask ? (
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
        </Animated.View>

        <View style={styles.daysSection}>
          <Text style={styles.sectionTitle}>Protocol Schedule</Text>
          
          <View style={styles.daysList}>
            {protocol.protocol.days?.map((day, index) => renderDayCard(day, index))}
          </View>
        </View>
      </ScrollView>

      {renderSessionModal()}
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
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  daysList: {
    gap: 12,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  dayCardCurrent: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0088FE',
  },
  dayCardInProgress: {
    backgroundColor: '#FFF3E0',
    borderColor: '#F59E0B',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dayInfo: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayTitleCompleted: {
    color: '#10B981',
  },
  dayTitleCurrent: {
    color: '#0088FE',
  },
  daySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  daySubtitleCompleted: {
    color: '#059669',
  },
  dayStatus: {
    marginLeft: 12,
  },
  dayDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  dayDescriptionCompleted: {
    color: '#059669',
  },
  dayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionCountText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  currentDayBadge: {
    backgroundColor: '#0088FE',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  completedDayBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  progressDayBadge: {
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0088FE',
    borderRadius: 2,
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
});

export default ProtocolScreen; 