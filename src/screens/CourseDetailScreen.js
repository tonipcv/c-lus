import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Animated,
  Image,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('CourseDetailScreen');

const CourseDetailScreen = ({ route, navigation }) => {
  const { courseId, courseTitle } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [course, setCourse] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCourseDetails();
  }, [courseId]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const loadCourseDetails = async () => {
    try {
      setLoading(true);
      logger.debug('Carregando detalhes do curso', { courseId });
      
      const response = await apiClient.get(`/api/courses/${courseId}`);
      setCourse(response);
      logger.info('Detalhes do curso carregados com sucesso');
      
    } catch (error) {
      logger.error('Erro ao carregar detalhes do curso:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do curso. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourseDetails();
  };

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const handleLessonComplete = async (lessonId) => {
    try {
      logger.debug('Marcando aula como concluída', { lessonId });
      
      await apiClient.post('/api/courses/lessons/complete', {
        lessonId: lessonId
      });
      
      logger.info('Aula marcada como concluída com sucesso');
      Alert.alert('Sucesso', 'Aula concluída com sucesso!');
      
      // Recarregar detalhes do curso para atualizar o progresso
      loadCourseDetails();
      
    } catch (error) {
      logger.error('Erro ao completar aula:', error);
      Alert.alert('Erro', 'Não foi possível marcar a aula como concluída. Tente novamente.');
    }
  };

  const handleVideoPress = (videoUrl) => {
    if (videoUrl) {
      Linking.openURL(videoUrl).catch(err => {
        logger.error('Erro ao abrir vídeo:', err);
        Alert.alert('Erro', 'Não foi possível abrir o vídeo.');
      });
    }
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const getProgressColor = (progress) => {
    if (progress === 0) return '#E5E7EB';
    if (progress < 50) return '#F59E0B';
    if (progress < 100) return '#3B82F6';
    return '#10B981';
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
        <Text style={styles.loadingText}>Carregando curso...</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Curso não encontrado</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header com botão de voltar */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {courseTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0088FE']}
            tintColor="#0088FE"
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Imagem de capa */}
          {course.coverImage && (
            <View style={styles.coverImageContainer}>
              <Image
                source={{ uri: course.coverImage }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Informações do curso */}
          <View style={styles.courseInfo}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <Text style={styles.courseDescription}>{course.description}</Text>

            {/* Progresso geral */}
            {course.assignment && (
              <View style={styles.progressSection}>
                <Text style={styles.progressTitle}>Seu Progresso</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${course.assignment.progress || 0}%`,
                        backgroundColor: getProgressColor(course.assignment.progress || 0)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {course.assignment.progress || 0}% concluído
                </Text>
              </View>
            )}
          </View>

          {/* Módulos e Aulas */}
          <View style={styles.modulesContainer}>
            <Text style={styles.modulesTitle}>Conteúdo do Curso</Text>
            
            {course.modules?.map((module, moduleIndex) => (
              <View key={module.id} style={styles.moduleCard}>
                <TouchableOpacity
                  style={styles.moduleHeader}
                  onPress={() => toggleModule(module.id)}
                >
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleTitle}>
                      {module.title || `Módulo ${moduleIndex + 1}`}
                    </Text>
                    <Text style={styles.moduleDescription}>
                      {module.description}
                    </Text>
                    <Text style={styles.moduleStats}>
                      {module.lessons?.length || 0} aulas • {
                        module.lessons?.reduce((total, lesson) => 
                          total + (lesson.duration || 0), 0
                        ) || 0
                      } min
                    </Text>
                  </View>
                  <Icon 
                    name={expandedModules[module.id] ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>

                {/* Lista de aulas (expandível) */}
                {expandedModules[module.id] && (
                  <View style={styles.lessonsContainer}>
                    {module.lessons?.map((lesson, lessonIndex) => (
                      <View key={lesson.id} style={styles.lessonCard}>
                        <View style={styles.lessonInfo}>
                          <View style={styles.lessonHeader}>
                            <Text style={styles.lessonTitle}>
                              {lesson.title}
                            </Text>
                            <View style={styles.lessonMeta}>
                              <Icon name="clock-outline" size={14} color="#6B7280" />
                              <Text style={styles.lessonDuration}>
                                {formatDuration(lesson.duration || 0)}
                              </Text>
                            </View>
                          </View>
                          
                          {lesson.content && (
                            <Text style={styles.lessonContent} numberOfLines={3}>
                              {lesson.content}
                            </Text>
                          )}
                        </View>

                        <View style={styles.lessonActions}>
                          {/* Botão de vídeo */}
                          {lesson.videoUrl && (
                            <TouchableOpacity
                              style={styles.videoButton}
                              onPress={() => handleVideoPress(lesson.videoUrl)}
                            >
                              <Icon name="play-circle" size={20} color="#0088FE" />
                              <Text style={styles.videoButtonText}>Assistir</Text>
                            </TouchableOpacity>
                          )}

                          {/* Botão de completar */}
                          <TouchableOpacity
                            style={[
                              styles.completeButton,
                              lesson.completed && styles.completedButton
                            ]}
                            onPress={() => handleLessonComplete(lesson.id)}
                            disabled={lesson.completed}
                          >
                            <Icon 
                              name={lesson.completed ? "check-circle" : "circle-outline"} 
                              size={20} 
                              color={lesson.completed ? "#10B981" : "#6B7280"} 
                            />
                            <Text style={[
                              styles.completeButtonText,
                              lesson.completed && styles.completedButtonText
                            ]}>
                              {lesson.completed ? 'Concluída' : 'Marcar como concluída'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {lesson.completed && lesson.completedAt && (
                          <Text style={styles.completedDate}>
                            Concluída em {new Date(lesson.completedAt).toLocaleDateString('pt-BR')}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
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
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  coverImageContainer: {
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  courseInfo: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  courseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    lineHeight: 32,
  },
  courseDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 20,
  },
  progressSection: {
    marginTop: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'right',
  },
  modulesContainer: {
    padding: 20,
  },
  modulesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  moduleStats: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  lessonsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  lessonCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lessonInfo: {
    marginBottom: 12,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonDuration: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  lessonContent: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  lessonActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
  },
  videoButtonText: {
    fontSize: 14,
    color: '#0088FE',
    fontWeight: '500',
    marginLeft: 6,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  completedButton: {
    backgroundColor: '#ECFDF5',
  },
  completeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 6,
  },
  completedButtonText: {
    color: '#10B981',
  },
  completedDate: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
    textAlign: 'right',
  },
});

export default CourseDetailScreen; 