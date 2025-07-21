import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  Linking,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';
import { AuthError } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';
import habitService from '../services/habitService';

const logger = createLogger('HomeScreen');
const { width, height } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, logout, isAuthenticated, handleSessionExpired } = useAuth();
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [startProtocolModal, setStartProtocolModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [habits, setHabits] = useState([]);
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (isAuthenticated) {
      loadProtocols();
      loadUserProfile();
      loadHabits();
    } else {
      navigation.replace('Login');
    }
  }, [isAuthenticated]);

  // Animar elementos quando os dados carregarem
  useEffect(() => {
    if (!loading) {
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
  }, [loading, fadeAnim, slideAnim]);

  const loadUserProfile = async () => {
    try {
      logger.debug('Carregando perfil do usuário');
      const response = await apiClient.get('/api/patient/profile');
      setUserProfile(response.user);
      logger.info('Perfil do usuário carregado com sucesso');
    } catch (error) {
      logger.error('Erro ao carregar perfil do usuário:', error);
      if (error instanceof AuthError) {
        handleSessionExpired();
      }
      setUserProfile(null);
    }
  };

  const loadProtocols = async () => {
    try {
      setLoading(true);
      logger.debug('Loading patient prescriptions');
      
      const response = await apiClient.get('/api/v2/patients/prescriptions');
      
      if (response.success) {
        // Map the prescriptions to match the expected format
        const mappedProtocols = response.prescriptions.map(prescription => ({
          id: prescription.id,
          protocol: {
            id: prescription.protocol_id,
            name: prescription.protocol.name,
            description: prescription.protocol.description,
            duration: prescription.protocol.duration,
            coverImage: prescription.protocol.cover_image,
            doctor: prescription.protocol.doctor
          },
          status: prescription.status,
          startDate: prescription.actual_start_date,
          currentDay: prescription.current_day,
          adherenceRate: prescription.adherence_rate,
          progress: prescription.progress
        }));

        logger.debug('Protocols loaded:', mappedProtocols.map(p => ({
          id: p.id,
          name: p.protocol?.name,
          status: p.status,
          startDate: p.startDate
        })));
        
        setProtocols(mappedProtocols);
        logger.info(`${mappedProtocols.length} protocols loaded`);
        
      } else {
        logger.warn('Failed to load protocols:', response.message);
        setProtocols([]);
      }
    } catch (error) {
      logger.error('Error loading protocols:', error);
      if (error instanceof AuthError) {
        handleSessionExpired();
      }
      setProtocols([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadHabits = async () => {
    try {
      const currentDate = new Date();
      const month = currentDate.toISOString();
      const habitsData = await habitService.getHabits(month);
      setHabits(habitsData);
    } catch (error) {
      logger.error('Erro ao carregar hábitos:', error);
      setHabits([]);
    }
  };

  const getPendingTasks = () => {
    const activeTasks = protocols
      .filter(p => p.status === 'ACTIVE')
      .reduce((tasks, protocol) => {
        const protocolTasks = protocol.protocol.tasks || [];
        return [...tasks, ...protocolTasks.filter(task => !task.completed)];
      }, []);
    return activeTasks.slice(0, 3);
  };

  const getPendingHabits = () => {
    const today = new Date().toISOString().split('T')[0];
    return habits
      .filter(habit => !habit.progress.some(p => p.date === today && p.isChecked))
      .slice(0, 3);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadProtocols(),
      loadUserProfile(),
      loadHabits()
    ]);
    setRefreshing(false);
  };

  const openWhatsApp = () => {
    const phoneNumber = '5511976638147'; // Número com código do país
    const message = 'Hello! I need help with my treatment protocols in the app.';
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback para WhatsApp Web
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

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              logger.error('Erro ao fazer logout:', error);
              Alert.alert('Error', 'An error occurred while signing out.');
            }
          }
        }
      ]
    );
  };

  const handleProfilePress = () => {
    navigation.navigate('PatientProfile');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#4ade80';
      case 'PRESCRIBED': return '#1697F5';
      case 'PAUSED': return '#f59e0b';
      case 'COMPLETED': return '#4ade80';
      case 'ABANDONED': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ACTIVE': return 'Active';
      case 'PRESCRIBED': return 'Not Started';
      case 'PAUSED': return 'Paused';
      case 'COMPLETED': return 'Completed';
      case 'ABANDONED': return 'Abandoned';
      default: return 'Unknown';
    }
  };

  const isProtocolAvailable = (protocol) => {
    if (!protocol.protocol.availableFrom) return true;
    const availableFrom = new Date(protocol.protocol.availableFrom);
    return new Date() >= availableFrom;
  };

  const handleStartProtocol = async (protocol) => {
    try {
      logger.debug('Starting protocol', { 
        assignmentId: protocol.id,
        actualStartDate: protocol.actualStartDate
      });
      
      // Use the correct endpoint structure
      await apiClient.post(
        `/api/protocols/assignments/${protocol.id}/start`
      );
      
      await loadProtocols();
      navigation.navigate('Protocol', { protocolId: protocol.id });
      logger.info('Protocol started successfully');
    } catch (error) {
      logger.error('Error starting protocol:', error);
      
      // Handle specific error when protocol is already started
      if (error.response?.status === 400 && error.response?.data?.startDate) {
        const startDate = new Date(error.response.data.startDate).toLocaleDateString();
        Alert.alert(
          'Protocol Already Started',
          `This protocol was already started on ${startDate}.`
        );
      } else {
        Alert.alert(
          'Error',
          'Could not start the protocol. Please try again later or contact support if the issue persists.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleStartProtocolPress = (protocol) => {
    setSelectedProtocol(protocol);
    setStartProtocolModal(true);
  };

  const handleConfirmStartProtocol = async () => {
    if (!selectedProtocol) return;
    
    // Check if protocol can be started
    if (selectedProtocol.status !== 'PRESCRIBED') {
      Alert.alert(
        'Cannot Start Protocol',
        selectedProtocol.status === 'ACTIVE' 
          ? 'This protocol is already active.'
          : `Protocol cannot be started in its current status: ${selectedProtocol.status}`
      );
      return;
    }

    try {
      logger.debug('Starting protocol', { 
        protocolId: selectedProtocol.protocol.id,
        prescriptionId: selectedProtocol.id,
        status: selectedProtocol.status
      });
      
      // Use the correct endpoint structure
      await apiClient.post(
        `/api/protocols/${selectedProtocol.protocol.id}/prescriptions/${selectedProtocol.id}/start`
      );
      
      await loadProtocols();
      setStartProtocolModal(false);
      setSelectedProtocol(null);
      navigation.navigate('Protocol', { protocolId: selectedProtocol.id });
      logger.info('Protocol started successfully');
    } catch (error) {
      logger.error('Error starting protocol:', error);
      Alert.alert(
        'Error',
        'Could not start the protocol. Please try again later or contact support if the issue persists.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderStartProtocolModal = () => {
    if (!selectedProtocol) return null;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={startProtocolModal}
        onRequestClose={() => setStartProtocolModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start Protocol</Text>
              <TouchableOpacity
                onPress={() => setStartProtocolModal(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#cccccc" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Are you ready to start the protocol "{selectedProtocol.protocol.name}"?
              </Text>
              <Text style={styles.modalSubtext}>
                The protocol will start today and you'll need to follow the daily tasks.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setStartProtocolModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmStartProtocol}
              >
                <Text style={styles.confirmButtonText}>Start Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
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

  const renderProtocolCard = (protocol, index) => {
    const { protocol: protocolData } = protocol;
    const protocolImage = getProtocolImage(protocolData);
    const isAvailable = isProtocolAvailable(protocol);
    
    // Debug log para entender o estado do protocolo
    logger.debug('Renderizando protocolo:', {
      id: protocol.id,
      name: protocolData?.name,
      status: protocol.status,
      actualStartDate: protocol.actualStartDate,
      isAvailable,
      hasStartDate: !!protocol.actualStartDate
    });

    // Verificar se o protocolo pode ser iniciado
    const canStart = protocol.status === 'PRESCRIBED' && !protocol.actualStartDate && isAvailable;
    // Verificar se o protocolo está ativo
    const isActive = protocol.status === 'ACTIVE';
    
    return (
      <Animated.View
        key={protocol.id}
        style={[
          styles.protocolCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Protocol Image */}
        <Image 
          source={{ uri: protocolImage }}
          style={styles.protocolImage}
          resizeMode="cover"
        />
        
        <View style={styles.protocolContent}>
        <View style={styles.protocolHeader}>
          <View style={styles.protocolInfo}>
            <Text style={styles.protocolTitle}>{protocolData.name}</Text>
            <Text style={styles.protocolDescription} numberOfLines={2}>
              {protocolData.description}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(protocol.status) }]}>
            <Text style={styles.statusText}>{getStatusText(protocol.status)}</Text>
          </View>
        </View>

        <View style={styles.protocolDetails}>
          {protocolData.doctor && (
            <View style={styles.detailRow}>
                <Icon name="doctor" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={[styles.detailText, { color: 'rgba(255, 255, 255, 0.9)' }]}>
                {protocolData.doctor.name}
              </Text>
            </View>
          )}
        </View>

          {isActive && (
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={() => {
                navigation.navigate('Protocol', { protocolId: protocol.id });
            }}
          >
              <Text style={styles.continueButtonText}>Continue the protocol</Text>
              <Icon name="arrow-right" size={16} color="#cccccc" />
            </TouchableOpacity>
          )}

          {canStart && (
            <TouchableOpacity 
              style={[styles.continueButton, { backgroundColor: '#1697F5', borderColor: '#1697F5' }]}
              onPress={() => handleStartProtocolPress(protocol)}
            >
              <Text style={[styles.continueButtonText, { color: '#ffffff' }]}>Start the protocol now</Text>
              <Icon name="play" size={16} color="#ffffff" />
          </TouchableOpacity>
        )}
        </View>
      </Animated.View>
    );
  };

  const renderProtocolSection = (title, protocolsList, emptyMessage) => {
    if (protocolsList.length === 0) return null;

    return (
      <View style={styles.protocolSection}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {protocolsList.map((protocol, index) => renderProtocolCard(protocol, index))}
      </View>
    );
  };

  // Separate protocols by status
  const activeProtocols = protocols.filter(p => 
    p.status === 'ACTIVE' || 
    (p.status === 'PRESCRIBED' && isProtocolAvailable(p))
  );
  
  const inactiveProtocols = protocols.filter(p => 
    p.status !== 'ACTIVE' && 
    (p.status !== 'PRESCRIBED' || !isProtocolAvailable(p))
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
            progressBackgroundColor="#234e6c"
          />
        }
      >
        {/* Header Section */}
      <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
            <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          </View>
        </View>
        

      </View>
      
        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Original Protocols Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Protocols</Text>
            <TouchableOpacity 
              style={styles.seeAllButton}
              onPress={() => navigation.navigate('Protocols')}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Icon name="chevron-right" size={20} color="#1697F5" />
            </TouchableOpacity>
          </View>

          {/* Protocols List */}
          {protocols.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="clipboard-text-outline" size={64} color="#1697F5" />
              <Text style={styles.emptyStateTitle}>No Protocols Yet</Text>
              <Text style={styles.emptyStateText}>
                Your prescribed protocols will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.protocolsList}>
              {protocols.map((protocol, index) => renderProtocolCard(protocol, index))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16171b',
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

  welcomeText: {
    fontSize: 16,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
  },
  userName: {
    fontSize: 24,
    color: '#f8fafc',
    fontFamily: 'ManropeBold',
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#26272c',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    color: '#1697F5',
    fontFamily: 'ManropeBold',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
    marginTop: 4,
    textAlign: 'center',
  },
  mainContent: {
    backgroundColor: '#1d1e24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    minHeight: 600,
    paddingBottom: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#f8fafc',
    fontFamily: 'ManropeBold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'ManropeMedium',
    marginRight: 4,
  },


  scrollView: {
    flex: 1,
    paddingBottom: 120,
  },
  protocolsList: {
    paddingTop: 20,
  },
  protocolCard: {
    backgroundColor: '#26272c',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  protocolInfo: {
    flex: 1,
    marginRight: 12,
  },
  protocolTitle: {
    fontSize: 18,
    color: '#f8fafc',
    marginBottom: 4,
    fontFamily: 'ManropeBold',
  },
  protocolDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    fontFamily: 'ManropeRegular',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusText: {
    fontSize: 12,
    color: '#f8fafc',
    fontFamily: 'ManropeMedium',
  },
  protocolDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 8,
    fontFamily: 'ManropeRegular',
  },
  continueButton: {
    backgroundColor: '#26272c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  continueButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'ManropeSemiBold',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'ManropeRegular',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1697F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeMedium',
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: '#26272c',
    borderWidth: 1,
    borderColor: '#1697F5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  refreshButtonText: {
    color: '#1697F5',
    fontSize: 14,
    fontFamily: 'ManropeSemiBold',
    marginLeft: 8,
  },
  protocolImage: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  protocolContent: {
    padding: 16,
  },
  protocolSection: {
    marginBottom: 24,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helloText: {
    fontSize: 24,
    color: '#7F8589',
    marginRight: 8,
    fontFamily: 'ManropeRegular',
  },
  nameText: {
    fontSize: 24,
    color: '#18222A',
    fontFamily: 'ManropeSemiBold',
  },
  bottomLogoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#16171b',
  },
  bottomLogo: {
    width: 120,
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#26272c',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1e24',
  },
  modalTitle: {
    fontSize: 18,
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'ManropeRegular',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: 'ManropeRegular',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1d1e24',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#1d1e24',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#1697F5',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  protocolMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 12,
  },
  protocolMetaText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'ManropeRegular',
  },
  dailySummary: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#26272c',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#f8fafc',
    fontFamily: 'ManropeSemiBold',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  summaryItemText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'ManropeRegular',
    flex: 1,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'ManropeRegular',
    textAlign: 'center',
    paddingVertical: 8,
  },
});

export default HomeScreen;
