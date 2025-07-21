import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import habitService from '../services/habitService';
import { createLogger } from '../utils/logUtils';
import LoadingSpinner from '../components/LoadingSpinner';
const logger = createLogger('HabitsScreen');
const { width, height } = Dimensions.get('window');

const HabitsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Modal states
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(null);
  
  // Form states
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitCategory, setNewHabitCategory] = useState('personal');
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [editHabitCategory, setEditHabitCategory] = useState('personal');
  
  // Loading states
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [updatingHabit, setUpdatingHabit] = useState(false);
  const [deletingHabit, setDeletingHabit] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState({});

  const categories = [
    { id: 'personal', name: 'Personal', color: '#1697F5' },
    { id: 'health', name: 'Health', color: '#4ade80' },
    { id: 'work', name: 'Work', color: '#f59e0b' },
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Adicionar dias do mês anterior para completar a primeira semana
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      });
    }
    
    // Adicionar dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Adicionar dias do próximo mês para completar a última semana
    const remainingDays = 42 - days.length; // 6 semanas * 7 dias
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  const loadHabits = async () => {
    try {
      setLoading(true);
      const month = selectedMonth.toISOString();
      const habitsData = await habitService.getHabits(month);
      setHabits(habitsData);
      logger.info('Hábitos carregados', { count: habitsData.length });
    } catch (error) {
      logger.error('Erro ao carregar hábitos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os hábitos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHabits();
    setRefreshing(false);
  };

  useEffect(() => {
    loadHabits();
  }, [selectedMonth]);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isHabitCompletedOnDate = (habit, date) => {
    return habitService.isHabitCompletedOnDate(habit.progress, formatDate(date));
  };

  const toggleHabitProgress = async (habitId, date) => {
    try {
      setUpdatingProgress(prev => ({ ...prev, [habitId]: true }));
      
      const dateStr = formatDate(date);
      const response = await habitService.updateProgress(habitId, dateStr);
      
      // Atualizar o estado local
      setHabits(prevHabits => 
        prevHabits.map(habit => {
          if (habit.id === habitId) {
            const existingProgress = habit.progress.find(p => p.date === dateStr);
            if (existingProgress) {
              return {
                ...habit,
                progress: habit.progress.map(p => 
                  p.date === dateStr ? { ...p, isChecked: response.isChecked } : p
                )
              };
            } else {
              return {
                ...habit,
                progress: [...habit.progress, { date: dateStr, isChecked: response.isChecked }]
              };
            }
          }
          return habit;
        })
      );
      
      logger.info('Progresso atualizado', { habitId, date: dateStr, isChecked: response.isChecked });
    } catch (error) {
      logger.error('Erro ao atualizar progresso:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o progresso. Tente novamente.');
    } finally {
      setUpdatingProgress(prev => ({ ...prev, [habitId]: false }));
    }
  };

  const createHabit = async () => {
    if (!newHabitTitle.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título para o hábito.');
      return;
    }

    try {
      setCreatingHabit(true);
      const habitData = {
        title: newHabitTitle.trim(),
        category: newHabitCategory
      };
      
      const newHabit = await habitService.createHabit(habitData);
      setHabits(prev => [...prev, newHabit]);
      
      setNewHabitTitle('');
      setNewHabitCategory('personal');
      setAddModalVisible(false);
      
      logger.info('Hábito criado com sucesso', { habitId: newHabit.id });
    } catch (error) {
      logger.error('Erro ao criar hábito:', error);
      Alert.alert('Erro', 'Não foi possível criar o hábito. Tente novamente.');
    } finally {
      setCreatingHabit(false);
    }
  };

  const updateHabit = async () => {
    if (!selectedHabit || !editHabitTitle.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título para o hábito.');
      return;
    }

    try {
      setUpdatingHabit(true);
      const habitData = {
        title: editHabitTitle.trim(),
        category: editHabitCategory
      };
      
      const updatedHabit = await habitService.updateHabit(selectedHabit.id, habitData);
      setHabits(prev => prev.map(h => h.id === selectedHabit.id ? updatedHabit : h));
      
      setEditModalVisible(false);
      setSelectedHabit(null);
      setEditHabitTitle('');
      setEditHabitCategory('personal');
      
      logger.info('Hábito atualizado com sucesso', { habitId: updatedHabit.id });
    } catch (error) {
      logger.error('Erro ao atualizar hábito:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o hábito. Tente novamente.');
    } finally {
      setUpdatingHabit(false);
    }
  };

  const deleteHabit = async () => {
    if (!selectedHabit) return;

    try {
      setDeletingHabit(true);
      await habitService.deleteHabit(selectedHabit.id);
      setHabits(prev => prev.filter(h => h.id !== selectedHabit.id));
      
      setDeleteModalVisible(false);
      setEditModalVisible(false);
      setSelectedHabit(null);
      setEditHabitTitle('');
      setEditHabitCategory('personal');
      
      logger.info('Hábito deletado com sucesso', { habitId: selectedHabit.id });
    } catch (error) {
      logger.error('Erro ao deletar hábito:', error);
      Alert.alert('Erro', 'Não foi possível deletar o hábito. Tente novamente.');
    } finally {
      setDeletingHabit(false);
    }
  };

  const openEditModal = (habit) => {
    setSelectedHabit(habit);
    setEditHabitTitle(habit.title);
    setEditHabitCategory(habit.category);
    setEditModalVisible(true);
  };

  const openDeleteModal = () => {
    setDeleteModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setDeleteModalVisible(false);
    setSelectedHabit(null);
    setEditHabitTitle('');
    setEditHabitCategory('personal');
  };

  const changeMonth = (direction) => {
    const newDate = new Date(selectedMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedMonth(newDate);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Pessoal';
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#1697F5';
  };

  const stats = habitService.calculateStats(habits);
  const days = getDaysInMonth(selectedMonth);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerActions}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={styles.addButton}
            >
              <Icon name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1697F5']}
            tintColor="#1697F5"
          />
        }
      >




        {/* Habits List */}
        <View style={styles.habitsSection}>
          <Text style={styles.sectionTitle}>Your Habits</Text>
          
                      {habits.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="calendar-blank" size={64} color="#1697F5" />
                <Text style={styles.emptyStateTitle}>No habits registered</Text>
                <Text style={styles.emptyStateText}>
                  Start by adding your first habits to track your daily progress.
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => setAddModalVisible(true)}
                >
                  <Text style={styles.emptyStateButtonText}>Add First Habit</Text>
                </TouchableOpacity>
              </View>
            ) : (
            habits.map((habit) => (
              <View key={habit.id} style={styles.habitCard}>
                <View style={styles.habitHeader}>
                  <View style={styles.habitInfo}>
                    <Text style={styles.habitTitle}>{habit.title}</Text>
                  </View>
                  
                  <View style={styles.habitActions}>
                    <TouchableOpacity
                      onPress={() => openEditModal(habit)}
                      style={styles.actionButton}
                    >
                      <Icon name="pencil" size={20} color="#7F8589" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress for current month */}
                <View style={styles.habitProgress}>
                  <View style={styles.progressGrid}>
                    {days.filter(day => day.isCurrentMonth).map((day, index) => {
                      const isCompleted = isHabitCompletedOnDate(habit, day.date);
                      const isUpdating = updatingProgress[habit.id];
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.progressDay,
                            isCompleted && styles.progressDayCompleted,
                            isToday(day.date) && styles.progressDayToday
                          ]}
                          onPress={() => toggleHabitProgress(habit.id, day.date)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <ActivityIndicator size="small" color="#1697F5" />
                          ) : isCompleted ? (
                            <Icon name="check" size={16} color="#83ead4" />
                          ) : (
                            <Text style={styles.progressDayText}>
                              {day.date.getDate()}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Habit Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Habit</Text>
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#7F8589" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Habit name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newHabitTitle}
                  onChangeText={setNewHabitTitle}
                  placeholder="Ex: Meditate 10 minutes"
                  placeholderTextColor="#7F8589"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categorySelector}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        newHabitCategory === category.id && styles.categoryOptionSelected,
                        { borderColor: category.color }
                      ]}
                      onPress={() => setNewHabitCategory(category.id)}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        newHabitCategory === category.id && { color: category.color }
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !newHabitTitle.trim() && styles.confirmButtonDisabled
                ]}
                onPress={createHabit}
                disabled={!newHabitTitle.trim() || creatingHabit}
              >
                {creatingHabit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Habit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Hábito</Text>
              <TouchableOpacity
                onPress={closeEditModal}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#7F8589" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome do hábito</Text>
                <TextInput
                  style={styles.textInput}
                  value={editHabitTitle}
                  onChangeText={setEditHabitTitle}
                  placeholder="Ex: Meditar 10 minutos"
                  placeholderTextColor="#7F8589"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Categoria</Text>
                <View style={styles.categorySelector}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        editHabitCategory === category.id && styles.categoryOptionSelected,
                        { borderColor: category.color }
                      ]}
                      onPress={() => setEditHabitCategory(category.id)}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        editHabitCategory === category.id && { color: category.color }
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={openDeleteModal}
              >
                <Text style={styles.deleteButtonText}>Excluir</Text>
              </TouchableOpacity>
              
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeEditModal}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    !editHabitTitle.trim() && styles.confirmButtonDisabled
                  ]}
                  onPress={updateHabit}
                  disabled={!editHabitTitle.trim() || updatingHabit}
                >
                  {updatingHabit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Icon name="alert-circle" size={48} color="#EF4444" />
              <Text style={styles.confirmModalTitle}>Confirmar Exclusão</Text>
            </View>
            
            <Text style={styles.confirmModalText}>
              Tem certeza que deseja excluir o hábito "{selectedHabit?.title}"? 
              Esta ação não pode ser desfeita.
            </Text>

            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={deleteHabit}
                disabled={deletingHabit}
              >
                {deletingHabit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmButtonText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7F8589',
    fontFamily: 'ManropeRegular',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#16171b',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeSection: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'ManropeBold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
    paddingBottom: 120,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCard: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    color: '#1697F5',
    fontFamily: 'ManropeBold',
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8589',
    marginTop: 4,
    fontFamily: 'ManropeRegular',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  monthButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'ManropeSemiBold',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#7F8589',
    fontFamily: 'ManropeMedium',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 14,
    color: '#18222A',
    fontFamily: 'ManropeRegular',
  },
  dayNumberOtherMonth: {
    color: '#D1D5DB',
  },
  dayNumberToday: {
    color: '#1697F5',
    fontFamily: 'ManropeSemiBold',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  monthButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'ManropeSemiBold',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#7F8589',
    fontFamily: 'ManropeMedium',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 14,
    color: '#18222A',
    fontFamily: 'ManropeRegular',
  },
  dayNumberOtherMonth: {
    color: '#D1D5DB',
  },
  dayNumberToday: {
    color: '#1697F5',
    fontFamily: 'ManropeSemiBold',
  },
  habitsSection: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    backgroundColor: '#1d1e24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 16,
    fontFamily: 'ManropeBold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'ManropeSemiBold',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7F8589',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'ManropeRegular',
  },
  emptyStateButton: {
    backgroundColor: '#1697F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  habitCard: {
    backgroundColor: '#26272c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  habitInfo: {
    flex: 1,
  },
  habitTitle: {
    fontSize: 18,
    color: '#f8fafc',
    fontFamily: 'ManropeBold',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'ManropeMedium',
  },
  habitActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  habitProgress: {
    paddingTop: 12,
  },
  progressTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    fontFamily: 'ManropeMedium',
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  progressDay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  progressDayCompleted: {
    backgroundColor: '#1697F5',
    borderColor: '#1697F5',
  },
  progressDayToday: {
    borderColor: '#1697F5',
    borderWidth: 2,
  },
  progressDayText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
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
    color: '#18222A',
    fontFamily: 'ManropeSemiBold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#18222A',
    marginBottom: 8,
    fontFamily: 'ManropeMedium',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#18222A',
    fontFamily: 'ManropeRegular',
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  categoryOptionSelected: {
    backgroundColor: 'rgba(22, 151, 245, 0.1)',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#7F8589',
    fontFamily: 'ManropeMedium',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#7F8589',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  confirmButton: {
    backgroundColor: '#1697F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  confirmModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    color: '#18222A',
    marginTop: 12,
    fontFamily: 'ManropeSemiBold',
  },
  confirmModalText: {
    fontSize: 14,
    color: '#7F8589',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'ManropeRegular',
  },
  confirmModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deleteConfirmButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  logo: {
    width: 40,
    height: 40,
  },
  logoContainer: {
    marginRight: 15,
  },
});

export default HabitsScreen; 