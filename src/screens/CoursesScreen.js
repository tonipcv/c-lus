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
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('CoursesScreen');
const { width } = Dimensions.get('window');

const CoursesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState([]);
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      logger.debug('Loading available courses');
      
      const response = await apiClient.get('/api/courses/available');
      setCourses(response.active || []);
      logger.info(`${response.active?.length || 0} courses loaded`);
      
    } catch (error) {
      logger.error('Error loading courses:', error);
      // Não mostrar alert, apenas definir cursos como vazio
      setCourses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  const openWhatsApp = () => {
    const phoneNumber = '5511976638147';
    const message = 'Hello! I need help with the available courses in the app.';
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          const webUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch((err) => {
        logger.error('Erro ao abrir WhatsApp:', err);
        Alert.alert(
          'Error',
          'Unable to open WhatsApp. Please check if the app is installed.',
          [{ text: 'OK' }]
        );
      });
  };

  const handleCoursePress = (course) => {
    // Funcionalidade de cursos removida
    Alert.alert(
      'Coming Soon',
      'The courses feature will be available soon.',
      [{ text: 'OK' }]
    );
  };

  const getProgressColor = (progress) => {
    if (progress === 0) return '#E5E7EB';
    if (progress < 50) return '#F59E0B';
    if (progress < 100) return '#3B82F6';
    return '#10B981';
  };

  const formatPrice = (price) => {
    if (!price) return 'Free';
    return `$ ${parseFloat(price).toFixed(2)}`;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
        <Text style={styles.loadingText}>Loading courses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Courses</Text>
        </View>
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
        {courses.length > 0 ? (
          <Animated.View style={[styles.coursesContainer, { opacity: fadeAnim }]}>
            {courses.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                onPress={() => handleCoursePress(course)}
                activeOpacity={0.7}
              >
                {/* Imagem do curso */}
                <View style={styles.courseImageContainer}>
                  {course.coverImage || course.thumbnail ? (
                    <Image
                      source={{ uri: course.coverImage || course.thumbnail }}
                      style={styles.courseImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Icon name="play-circle" size={40} color="#9CA3AF" />
                    </View>
                  )}
                  
                  {/* Badge de preço */}
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>{formatPrice(course.price)}</Text>
                  </View>
                </View>

                {/* Conteúdo do curso */}
                <View style={styles.courseContent}>
                  <Text style={styles.courseTitle} numberOfLines={2}>
                    {course.title}
                  </Text>
                  
                  <Text style={styles.courseDescription} numberOfLines={3}>
                    {course.description}
                  </Text>

                  {/* Informações do instrutor */}
                  <View style={styles.instructorInfo}>
                    <Icon name="account-circle" size={16} color="#6B7280" />
                    <Text style={styles.instructorName}>
                      {course.doctor?.name || 'Instructor'}
                    </Text>
                  </View>

                  {/* Estatísticas do curso */}
                  <View style={styles.courseStats}>
                    <View style={styles.statItem}>
                      <Icon name="book-open-variant" size={14} color="#6B7280" />
                      <Text style={styles.statText}>
                        {course._count?.modules || 0} modules
                      </Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Icon name="clock-outline" size={14} color="#6B7280" />
                      <Text style={styles.statText}>
                        {course.modules?.reduce((total, module) => 
                          total + (module.lessons?.reduce((lessonTotal, lesson) => 
                            lessonTotal + (lesson.duration || 0), 0) || 0), 0
                        ) || 0} min
                      </Text>
                    </View>
                  </View>

                  {/* Barra de progresso (se o usuário estiver inscrito) */}
                  {course.assignment && (
                    <View style={styles.progressContainer}>
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
                        {course.assignment.progress || 0}% completed
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Icon name="school" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Courses Available</Text>
            <Text style={styles.emptyDescription}>
              There are no courses available at the moment or there was a problem loading the data.
              {'\n\n'}
              Contact us via WhatsApp for more information or come back soon to check for updates.
            </Text>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.whatsappButton}
                onPress={openWhatsApp}
              >
                <Icon name="whatsapp" size={20} color="#FFFFFF" />
                <Text style={styles.whatsappButtonText}>Chat on WhatsApp</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={onRefresh}
              >
                <Icon name="refresh" size={20} color="#0088FE" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
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
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  coursesContainer: {
    padding: 20,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  courseImageContainer: {
    position: 'relative',
    height: 180,
  },
  courseImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  courseContent: {
    padding: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 24,
  },
  courseDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  instructorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructorName: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  courseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  whatsappButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0088FE',
    marginLeft: 8,
  },
});

export default CoursesScreen; 