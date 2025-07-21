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
  Dimensions,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { useRoute } from '@react-navigation/native';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';
import LoadingSpinner from '../components/LoadingSpinner';

const logger = createLogger('CoursesScreen');
const { width } = Dimensions.get('window');

const CoursesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const route = useRoute();
  const { protocolId, protocolName } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCourses, setActiveCourses] = useState([]);
  const [unavailableCourses, setUnavailableCourses] = useState([]);
  const [protocolCourses, setProtocolCourses] = useState([]);
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCourses();
  }, [protocolId]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const loadProtocolCourses = async () => {
    if (!protocolId) return;

    try {
      logger.debug('Loading protocol courses', { protocolId });
      const response = await apiClient.get(`/api/v2/patients/protocols/${protocolId}/courses`);
      
      if (response.success) {
        setProtocolCourses(response.courses || []);
        logger.info(`Loaded ${response.courses?.length} protocol courses`);
      } else {
        logger.warn('Unexpected protocol courses response format:', response);
        setProtocolCourses([]);
      }
    } catch (error) {
      logger.error('Error loading protocol courses:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      setProtocolCourses([]);
      
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Protocol not found or not active.');
      } else {
        Alert.alert('Error', 'Unable to load protocol courses. Please try again later.');
      }
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      
      if (protocolId) {
        await loadProtocolCourses();
      } else {
        logger.debug('Loading available courses');
        const response = await apiClient.get('/api/v2/patients/courses');
        logger.debug('API Response:', response);
        
        if (response.success) {
          setActiveCourses(response.courses || []);
          setUnavailableCourses(response.unavailableCourses || []);
          logger.info(`Loaded ${response.courses?.length} active courses and ${response.unavailableCourses?.length} unavailable courses`);
        } else {
          logger.warn('Unexpected response format:', response);
          setActiveCourses([]);
          setUnavailableCourses([]);
        }
      }
    } catch (error) {
      logger.error('Error loading courses:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      setActiveCourses([]);
      setUnavailableCourses([]);
      setProtocolCourses([]);
      Alert.alert(
        'Error',
        'Unable to load courses. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  const handleCoursePress = (courseData) => {
    // For protocol courses, we need to access the course object inside the courseData
    const course = courseData.course || courseData;
    const isProtocolCourse = !!courseData.course;
    
    if (!course || !course.id) {
      logger.warn('Invalid course data:', course);
      Alert.alert(
        'Error',
        'Course information is not available.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Se o curso tem modal, mostrar informações do modal
    if (course.modalTitle) {
      Alert.alert(
        course.modalTitle,
        course.modalDescription,
        [
          { 
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: course.modalButtonText || 'Learn More',
            onPress: () => {
              if (course.modalButtonUrl) {
                Linking.openURL(course.modalButtonUrl)
                  .catch(err => {
                    logger.error('Error opening modal URL:', err);
                    Alert.alert('Error', 'Could not open the link.');
                  });
              }
            }
          }
        ]
      );
      return;
    }

    logger.debug('Navigating to course details:', {
      courseId: course.id,
      title: course.name || course.title,
      isProtocolCourse
    });

    navigation.navigate('CourseDetail', {
      courseId: course.id,
      title: course.name || course.title,
      isProtocolCourse,
      protocolCourseData: isProtocolCourse ? courseData : null
    });
  };

  const getTotalDuration = (course) => {
    return course.modules?.reduce((total, module) => 
      total + (module.lessons?.reduce((lessonTotal, lesson) => 
        lessonTotal + (lesson.duration || 0), 0) || 0), 0
    ) || 0;
  };

  const getProgressPercentage = (course) => {
    if (!course.progress) return 0;
    return Math.round((course.progress.completedLessons / course.progress.totalLessons) * 100) || 0;
  };

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

  const renderCourseCard = (courseData, isUnavailable = false) => {
    const course = courseData.course || courseData;
    const isProtocolCourse = !!courseData.course;
    const progress = isProtocolCourse ? course.progress : null;

    return (
      <TouchableOpacity
        key={course.id}
        style={[
          styles.courseCard,
          isUnavailable && styles.unavailableCourseCard
        ]}
        onPress={() => handleCoursePress(courseData)}
        activeOpacity={0.8}
      >
        {/* Imagem do Curso - destaque, largura total */}
        <View style={styles.courseImageContainer}>
          {course.coverImage ? (
            <Image
              source={{ uri: course.coverImage }}
              style={styles.courseImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Icon name="play-circle" size={48} color="#9CA3AF" />
            </View>
          )}
          {isUnavailable && (
            <View style={styles.unavailableBadge}>
              <Text style={styles.unavailableBadgeText}>Indisponível</Text>
            </View>
          )}
          {isProtocolCourse && courseData.isRequired && (
            <View style={[styles.badge, styles.requiredBadge]}>
              <Text style={styles.badgeText}>Obrigatório</Text>
            </View>
          )}
        </View>
        {/* Conteúdo do Card */}
        <View style={styles.courseContent}>
          <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
          <Text style={styles.courseDescription} numberOfLines={3}>{course.description}</Text>
          {/* Instrutor (se houver) */}
          {course.instructor && (
            <View style={styles.instructorRow}>
              <Icon name="account" size={16} color="#94a3b8" style={{ marginRight: 4 }} />
              <Text style={styles.instructorText}>{course.instructor}</Text>
            </View>
          )}
          {/* Progresso */}
          {isProtocolCourse && progress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${getProgressPercentage(course)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress.completedLessons}/{progress.totalLessons} aulas concluídas
              </Text>
            </View>
          )}
          {/* Estatísticas */}
          <View style={styles.courseStats}>
            <View style={styles.statItem}>
              <Icon name="book-open-variant" size={14} color="#6B7280" />
              <Text style={styles.statText}>{course.modules?.length || 0} módulos</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="clock-outline" size={14} color="#6B7280" />
              <Text style={styles.statText}>{getTotalDuration(course)} min</Text>
            </View>
            {isProtocolCourse && (
              <View style={styles.statItem}>
                <Icon
                  name={progress?.isEnrolled ? "check-circle" : "circle-outline"}
                  size={14}
                  color={progress?.isEnrolled ? "#4ade80" : "#6B7280"}
                />
                <Text style={[styles.statText, progress?.isEnrolled && styles.enrolledText]}>
                  {progress?.isEnrolled ? "Inscrito" : "Não inscrito"}
                </Text>
              </View>
            )}
          </View>
          {/* Botão de ação */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCoursePress(courseData)}
          >
            <Text style={styles.actionButtonText}>Ver detalhes</Text>
            <Icon name="chevron-right" size={18} color="#1697F5" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {protocolId && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>
            {protocolId ? `${protocolName || 'Protocol'} Courses` : 'Courses'}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#61aed0']}
            tintColor="#61aed0"
          />
        }
      >
        {(protocolCourses.length > 0 || activeCourses.length > 0 || unavailableCourses.length > 0) ? (
          <Animated.View style={[styles.coursesContainer, { opacity: fadeAnim }]}>
            {/* Protocol Courses Section */}
            {protocolCourses.length > 0 && (
              <View style={styles.courseSection}>
                <Text style={styles.sectionTitle}>Protocol Courses</Text>
                {protocolCourses.map(course => renderCourseCard(course))}
              </View>
            )}

            {/* Active Courses Section (only shown when not viewing protocol courses) */}
            {!protocolId && activeCourses.length > 0 && (
              <View style={styles.courseSection}>
                <Text style={styles.sectionTitle}>Available Courses</Text>
                {activeCourses.map(course => renderCourseCard(course))}
              </View>
            )}

            {/* Unavailable Courses Section (only shown when not viewing protocol courses) */}
            {!protocolId && unavailableCourses.length > 0 && (
              <View style={styles.courseSection}>
                <Text style={styles.sectionTitle}>Unavailable Courses</Text>
                {unavailableCourses.map(course => renderCourseCard(course, true))}
              </View>
            )}
          </Animated.View>
        ) : (
          <View style={styles.emptyCourses}>
            <Icon name="book-open-variant" size={48} color="#6B7280" />
            <Text style={styles.emptyCoursesText}>
              {protocolId ? 'No courses available for this protocol.' : 'No courses available.'}
            </Text>
          </View>
        )}
      </ScrollView>
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
    fontSize: 14,
    color: '#94a3b8',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#16171b',
    borderBottomWidth: 1,
    borderBottomColor: '#1d1e24',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#16171b',
  },
  scrollViewContent: {
    paddingBottom: 24,
  },
  coursesContainer: {
    padding: 12,
  },
  courseSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 10,
    letterSpacing: 0.2,
    fontFamily: 'ManropeBold',
  },
  courseCard: {
    backgroundColor: '#1d1e24',
    borderRadius: 14,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  unavailableCourseCard: {
    opacity: 0.5,
  },
  courseImageContainer: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#26272c',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  courseImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#26272c',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  courseContent: {
    padding: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
    fontFamily: 'ManropeBold',
  },
  courseDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 22,
    fontFamily: 'ManropeRegular',
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  instructorText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#26272c',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1697F5',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  courseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 18,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  statText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  enrolledText: {
    color: '#4ade80',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#26272c',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1697F5',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#1697F5',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
    fontFamily: 'ManropeSemiBold',
  },
  unavailableBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'ManropeMedium',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadge: {
    backgroundColor: '#1697F5',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'ManropeMedium',
  },
  emptyCourses: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 10,
  },
  emptyCoursesText: {
    marginTop: 10,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: 'ManropeRegular',
  },
});

export default CoursesScreen; 