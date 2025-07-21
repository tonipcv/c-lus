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
  Modal,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import YoutubePlayer from 'react-native-youtube-iframe';

const logger = createLogger('CourseDetailScreen');

const { width, height } = Dimensions.get('window');

const CourseDetailScreen = ({ route, navigation }) => {
  const { courseId, courseTitle, isProtocolCourse, protocolCourseData } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [course, setCourse] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [completingLesson, setCompletingLesson] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [lessonModalVisible, setLessonModalVisible] = useState(false);
  const [fullscreenVideoVisible, setFullscreenVideoVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [youtubePlayerRef, setYoutubePlayerRef] = useState(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const videoScaleAnim = useRef(new Animated.Value(0.95)).current;

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

  useEffect(() => {
    if (fullscreenVideoVisible) {
      Animated.spring(videoScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [fullscreenVideoVisible, videoScaleAnim]);

  // Clean up YouTube player when modal closes
  useEffect(() => {
    if (!fullscreenVideoVisible && youtubePlayerRef) {
      setPlaying(false);
      setYoutubePlayerRef(null);
    }
  }, [fullscreenVideoVisible, youtubePlayerRef]);

  const loadCourseDetails = async () => {
    try {
      setLoading(true);
      logger.debug('Carregando detalhes do curso', { courseId, isProtocolCourse });
      
      let response;
      if (isProtocolCourse) {
        response = await apiClient.get(`/api/v2/patients/protocols/${protocolCourseData.protocol?.id}/courses/${courseId}/modules`);
        if (response.success) {
          setCourse(response.course);
          logger.info('Loaded protocol course modules');
        } else {
          throw new Error('Failed to load course details');
        }
      } else {
        response = await apiClient.get(`/api/v2/patients/courses/${courseId}/modules`);
        if (response.success) {
          setCourse(response.course);
          logger.info('Loaded course modules');
        } else {
          throw new Error('Failed to load course details');
        }
      }
      
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
      setCompletingLesson(lessonId);
      logger.debug('Marcando aula como concluída', { lessonId, courseId });
      
      const response = await apiClient.post(
        `/api/v2/patients/protocols/${protocolCourseData.protocol?.id}/courses/${courseId}/lessons/${lessonId}/complete`,
        {
          watchTime: 300
        }
      );
      
      if (response.success) {
        logger.info('Aula marcada como concluída com sucesso', { 
          progress: response.courseProgress,
          message: response.message 
        });
        
        Alert.alert('Sucesso', response.message || 'Aula concluída com sucesso!');
        await loadCourseDetails();
      } else {
        throw new Error(response.message || 'Failed to complete lesson');
      }
      
    } catch (error) {
      logger.error('Erro ao completar aula:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        lessonId,
        courseId,
        isProtocolCourse
      });
      
      let errorMessage = 'Não foi possível marcar a aula como concluída. Tente novamente.';
      
      if (error.response?.status === 404) {
        errorMessage = 'Aula não encontrada.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Você não tem permissão para marcar esta aula como concluída.';
      } else if (error.response?.status === 409) {
        errorMessage = 'Esta aula já foi marcada como concluída.';
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setCompletingLesson(null);
    }
  };

  const handleVideoPress = async (lesson) => {
    if (lesson.videoUrl) {
      setSelectedLesson(lesson);
      setSelectedVideoUrl(lesson.videoUrl);
      setFullscreenVideoVisible(true);
      setPlaying(false);
      setVideoLoading(true);
      
      logger.debug('Opening video:', { 
        videoUrl: lesson.videoUrl,
        videoId: getYoutubeVideoId(lesson.videoUrl),
        lessonTitle: lesson.title 
      });
    } else {
      Alert.alert('Vídeo não disponível', 'Este vídeo não está disponível no momento.');
    }
  };

  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    logger.error('WebView error:', nativeEvent);
    setVideoLoading(false);
    
    Alert.alert(
      'Erro ao carregar vídeo',
      'Não foi possível carregar o vídeo no app. Deseja abrir no navegador?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Abrir no Navegador', 
          onPress: () => {
            setFullscreenVideoVisible(false);
            if (selectedVideoUrl) {
              Linking.openURL(selectedVideoUrl);
            }
          }
        }
      ]
    );
  };

  const getYoutubeVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderLessonModal = () => {
    if (!selectedLesson) return null;

    const videoId = getYoutubeVideoId(selectedLesson.videoUrl);
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={lessonModalVisible}
        onRequestClose={() => setLessonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <Text style={styles.modalTitle}>{selectedLesson.title}</Text>
                {selectedLesson.duration && (
                  <View style={styles.modalDuration}>
                    <Icon name="clock-outline" size={16} color="#94a3b8" />
                    <Text style={styles.modalDurationText}>{selectedLesson.duration} min</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setLessonModalVisible(false)}
              >
                <Icon name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {embedUrl && (
                <View style={styles.videoContainer}>
                  <View style={styles.videoWrapper}>
                    <Image
                      source={{ uri: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }}
                      style={styles.videoThumbnail}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={() => Linking.openURL(selectedLesson.videoUrl)}
                    >
                      <Icon name="play-circle" size={64} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {selectedLesson.content && (
                <Text style={styles.modalContent}>{selectedLesson.content}</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.modalCompleteButton,
                  selectedLesson.completed && styles.modalCompletedButton,
                  completingLesson === selectedLesson.id && styles.modalCompletingButton
                ]}
                onPress={() => handleLessonComplete(selectedLesson.id)}
                disabled={selectedLesson.completed || completingLesson === selectedLesson.id}
              >
                {completingLesson === selectedLesson.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon 
                      name={selectedLesson.completed ? "check" : "check-circle-outline"} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.modalCompleteButtonText}>
                      {selectedLesson.completed ? 'Completed' : 'Mark as Complete'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFullscreenVideoModal = () => {
    const videoId = selectedVideoUrl ? getYoutubeVideoId(selectedVideoUrl) : null;

    return (
      <Modal
        animationType="none"
        transparent={false}
        visible={fullscreenVideoVisible}
        onRequestClose={() => setFullscreenVideoVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar style="light" backgroundColor="#000000" />
          
          <Animated.View style={[styles.fullscreenHeader, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setFullscreenVideoVisible(false);
                setPlaying(false);
              }}
            >
              <Icon name="arrow-left" size={24} color="#FFFFFF" />
              <Text style={styles.backButtonText}>Back to Course</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.fullscreenVideoContainer, { transform: [{ scale: videoScaleAnim }] }]}>
            {videoLoading && (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.videoLoadingText}>Loading Video...</Text>
              </View>
            )}
            
            {videoId ? (
              <YoutubePlayer
                ref={setYoutubePlayerRef}
                height={height * 0.6}
                width={Math.min(width * 0.9, 720)}
                videoId={videoId}
                play={playing}
                webViewProps={{
                  androidLayerType: 'hardware',
                  androidHardwareAccelerationDisabled: false,
                }}
                onReady={() => {
                  logger.debug('YouTube player ready');
                  setVideoLoading(false);
                  setPlaying(true);
                  Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true,
                  }).start();
                }}
                onError={(error) => {
                  logger.error('YouTube player error:', error);
                  setVideoLoading(false);
                  Alert.alert(
                    'Erro no vídeo',
                    'Não foi possível carregar o vídeo. Deseja abrir no navegador?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { 
                        text: 'Abrir no Navegador', 
                        onPress: () => {
                          setFullscreenVideoVisible(false);
                          if (selectedVideoUrl) {
                            Linking.openURL(selectedVideoUrl);
                          }
                        }
                      }
                    ]
                  );
                }}
                onStateChange={(event) => {
                  logger.debug('YouTube player state change:', event);
                  if (event === 'ended') {
                    setPlaying(false);
                    setFullscreenVideoVisible(false);
                    handleLessonComplete(selectedLesson.id);
                  }
                }}
                initialPlayerParams={{
                  preventFullScreen: false,
                  showClosedCaptions: true,
                  controls: true,
                  modestbranding: true,
                  rel: false,
                  showinfo: false,
                  fs: 1,
                  playerVars: {
                    controls: 1,
                    modestbranding: 1,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3,
                    playsinline: 0,
                    disablekb: 0,
                    fs: 1,
                    origin: 'https://www.youtube.com'
                  }
                }}
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Icon name="play-circle-outline" size={80} color="#FFFFFF" />
                <Text style={styles.videoPlaceholderText}>
                  Vídeo não disponível
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    );
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
    if (progress === 0) return '#334155';
    if (progress < 50) return '#f59e0b';
    if (progress < 100) return '#1697F5';
    return '#4ade80';
  };

  if (loading && !refreshing) {
    return <LoadingSpinner />;
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
      <StatusBar style="light" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 80 }}
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
        <View style={styles.heroSection}>
          {course?.coverImage ? (
            <Image
              source={{ uri: course.coverImage }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Icon name="play-circle-outline" size={64} color="#94a3b8" />
            </View>
          )}

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#f8fafc" />
          </TouchableOpacity>
        </View>

        <View style={styles.courseInfoSection}>
          <Text style={styles.courseTitle}>{course?.title}</Text>
          {course?.description && (
            <Text style={styles.courseDescription} numberOfLines={3}>
              {course.description}
            </Text>
          )}
          
          {course?.progress && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${course.progress.progress || 0}%`, backgroundColor: getProgressColor(course.progress.progress) }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {course.progress.progress || 0}% Complete
              </Text>
            </View>
          )}
        </View>

        <View style={styles.contentSection}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="book-open-variant" size={20} color="#1697F5" />
              <Text style={styles.statValue}>
                {course?.modules?.length || 0} Modules
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="clock-outline" size={20} color="#1697F5" />
              <Text style={styles.statValue}>
                {formatDuration(course?.modules?.reduce((total, module) => 
                  total + (module.lessons?.reduce((sum, lesson) => 
                    sum + (lesson.duration || 0), 0) || 0), 0) || 0)}
              </Text>
            </View>
            {course?.progress && (
              <View style={styles.statItem}>
                <Icon name="check-circle" size={20} color="#4ade80" />
                <Text style={styles.statValue}>
                  {course.progress.lessonsCompleted || 0} / {course.progress.totalLessons || 0} Lessons
                </Text>
              </View>
            )}
          </View>

          <View style={styles.modulesSection}>
            <Text style={styles.modulesTitle}>Course Content</Text>
            
            {course?.modules?.map((module, moduleIndex) => (
              <View key={module.id} style={styles.moduleCard}>
                <TouchableOpacity
                  style={styles.moduleHeader}
                  onPress={() => toggleModule(module.id)}
                >
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleTitle}>
                      {moduleIndex + 1}. {module.title}
                    </Text>
                    <Text style={styles.moduleStats}>
                      {module.lessons?.length || 0} lessons • {formatDuration(
                        module.lessons?.reduce((total, lesson) => 
                          total + (lesson.duration || 0), 0) || 0
                      )}
                    </Text>
                  </View>
                  <Icon 
                    name={expandedModules[module.id] ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#94a3b8" 
                  />
                </TouchableOpacity>

                {expandedModules[module.id] && (
                  <View style={styles.lessonsContainer}>
                    {module.lessons?.map((lesson, lessonIndex) => (
                      <View key={lesson.id} style={styles.lessonCard}>
                        <View style={styles.lessonHeader}>
                          <View style={styles.lessonInfo}>
                            <Text style={styles.lessonTitle}>
                              {moduleIndex + 1}.{lessonIndex + 1} {lesson.title}
                            </Text>
                            <View style={styles.lessonMeta}>
                              <Icon name="clock-outline" size={14} color="#94a3b8" />
                              <Text style={styles.lessonDuration}>
                                {lesson.duration} min
                              </Text>
                            </View>
                          </View>
                          {lesson.completed ? (
                            <Icon name="check-circle" size={20} color="#4ade80" />
                          ) : lesson.videoUrl ? (
                            <Icon name="play-circle-outline" size={20} color="#1697F5" />
                          ) : null}
                        </View>

                        <View style={styles.lessonActions}>
                          {lesson.videoUrl && (
                            <TouchableOpacity
                              style={styles.videoButton}
                              onPress={() => handleVideoPress(lesson)}
                            >
                              <Icon name="play" size={16} color="#FFFFFF" />
                              <Text style={styles.videoButtonText}>Watch Lesson</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={[
                              styles.completeButton,
                              lesson.completed && styles.completedButton,
                              completingLesson === lesson.id && styles.completingButton
                            ]}
                            onPress={() => handleLessonComplete(lesson.id)}
                            disabled={lesson.completed || completingLesson === lesson.id}
                          >
                            {completingLesson === lesson.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Icon 
                                  name={lesson.completed ? "check" : "check-circle-outline"} 
                                  size={16} 
                                  color={lesson.completed ? "#FFFFFF" : "#94a3b8"} 
                                />
                                <Text style={[
                                  styles.completeButtonText,
                                  lesson.completed && styles.completedButtonText
                                ]}>
                                  {lesson.completed ? 'Completed' : 'Mark as Complete'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      {renderLessonModal()}
      {renderFullscreenVideoModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16171b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16171b',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'ManropeSemiBold',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: 8,
  },
  backButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'ManropeSemiBold',
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    height: 300,
    position: 'relative',
    backgroundColor: '#26272c',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#26272c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseInfoSection: {
    padding: 24,
    backgroundColor: '#1d1e24',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  courseTitle: {
    fontSize: 26,
    fontFamily: 'ManropeBold',
    color: '#f8fafc',
    marginBottom: 12,
  },
  courseDescription: {
    fontSize: 15,
    fontFamily: 'ManropeRegular',
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 16,
  },
  progressSection: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease-in-out',
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'ManropeMedium',
    color: '#94a3b8',
  },
  contentSection: {
    padding: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1d1e24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'ManropeSemiBold',
    color: '#f8fafc',
  },
  modulesSection: {
    marginTop: 8,
  },
  modulesTitle: {
    fontSize: 22,
    fontFamily: 'ManropeBold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  moduleCard: {
    backgroundColor: '#1d1e24',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    fontSize: 17,
    fontFamily: 'ManropeSemiBold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  moduleStats: {
    fontSize: 14,
    fontFamily: 'ManropeRegular',
    color: '#94a3b8',
  },
  lessonsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  lessonCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  lessonInfo: {
    flex: 1,
    marginRight: 12,
  },
  lessonTitle: {
    fontSize: 15,
    fontFamily: 'ManropeSemiBold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonDuration: {
    fontSize: 13,
    fontFamily: 'ManropeRegular',
    color: '#94a3b8',
  },
  lessonActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1697F5',
    borderRadius: 8,
    gap: 6,
  },
  videoButtonText: {
    fontSize: 14,
    fontFamily: 'ManropeMedium',
    color: '#FFFFFF',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#26272c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  completedButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    borderColor: '#4ade80',
  },
  completeButtonText: {
    fontSize: 14,
    fontFamily: 'ManropeMedium',
    color: '#94a3b8',
  },
  completedButtonText: {
    color: '#FFFFFF',
  },
  completingButton: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16171b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeaderContent: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#f8fafc',
    fontFamily: 'ManropeBold',
    marginBottom: 8,
  },
  modalDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalDurationText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  modalBody: {
    padding: 20,
  },
  videoContainer: {
    width: '100%',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 24,
    fontFamily: 'ManropeRegular',
    marginBottom: 20,
  },
  modalCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1697F5',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  modalCompletedButton: {
    backgroundColor: '#4ade80',
  },
  modalCompletingButton: {
    opacity: 0.7,
  },
  modalCompleteButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'ManropeSemiBold',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullscreenVideoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  videoLoadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeMedium',
    marginTop: 12,
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  videoPlaceholderText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
    fontFamily: 'ManropeRegular',
  },
});

export default CourseDetailScreen;