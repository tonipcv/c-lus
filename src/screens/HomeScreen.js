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
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (isAuthenticated) {
      loadProtocols();
      loadUserProfile();
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
      logger.debug('Carregando protocolos do paciente');
      
      const response = await apiClient.get('/api/protocols/assignments');
      // A API retorna um array diretamente, não dentro de uma propriedade assignments
      const protocolsArray = Array.isArray(response) ? response : [];
      
      // Debug log para ver a estrutura dos protocolos
      logger.debug('Protocolos carregados:', protocolsArray.map(p => ({
        id: p.id,
        name: p.protocol?.name,
        status: p.status,
        prescriptionStatus: p.prescription?.status,
        hasStartDate: !!p.prescription?.startDate
      })));
      
      setProtocols(protocolsArray);
      logger.info(`${protocolsArray.length} protocolos carregados`);
      
    } catch (error) {
      logger.error('Erro ao carregar protocolos:', error);
      if (error instanceof AuthError) {
        handleSessionExpired();
      }
      // Não mostrar alert, apenas definir protocolos como vazio
      setProtocols([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProtocols();
    await loadUserProfile();
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
      case 'PRESCRIBED': return '#61aed0';
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
            <View style={styles.detailRow}>
              <Icon name="calendar" size={16} color="#cccccc" />
              <Text style={styles.detailText}>
                {protocol.status === 'ACTIVE' || protocol.actualStartDate ? 
                  `${formatDate(protocol.actualStartDate)} - ${formatDate(protocol.endDate)}` :
                  isAvailable ? 'Available to start now' : `Available from ${formatDate(protocolData.availableFrom)}`
                }
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Icon name="clock" size={16} color="#cccccc" />
              <Text style={styles.detailText}>
                {protocolData.duration} days
                {isActive && protocol?.currentDay && 
                  ` • Current day: ${protocol.currentDay}`}
              </Text>
            </View>

            {protocolData.doctor && (
              <View style={styles.detailRow}>
                <Icon name="doctor" size={16} color="#cccccc" />
                <Text style={styles.detailText}>
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
              style={[styles.continueButton, { backgroundColor: '#61aed0', borderColor: '#61aed0' }]}
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
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" backgroundColor="#151515" />
        <ActivityIndicator size="large" color="#0088FE" />
        <Text style={styles.loadingText}>Loading protocols...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#151515" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleContainer}>
            {user?.name && (
              <View style={styles.welcomeContainer}>
                <Text style={styles.helloText}>Hello</Text>
                <Text style={styles.nameText}>{user.name}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0088FE"
            colors={['#0088FE']}
            progressBackgroundColor="#151515"
          />
        }
      >
        {protocols.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Icon name="medical-bag" size={64} color="#cccccc" />
            <Text style={styles.emptyTitle}>No Protocols Available</Text>
            <Text style={styles.emptyDescription}>
              You don't have any active treatment protocols yet or there was a problem loading your data.
              {'\n\n'}
              Contact us via WhatsApp for help or wait for new treatments to be released.
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
        ) : (
          <View style={styles.protocolsList}>
            {/* Active Protocols Section */}
            {renderProtocolSection('Available Protocols', activeProtocols, 'No active protocols')}
            
            {/* Inactive Protocols Section */}
            {renderProtocolSection('Inactive Protocols', inactiveProtocols, 'No inactive protocols')}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomLogoContainer}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.bottomLogo}
          resizeMode="contain"
        />
      </View>
      {renderStartProtocolModal()}
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
    marginTop: 12,
    fontSize: 14,
    color: '#cccccc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#151515',
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  welcomeText: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#151515',
  },
  protocolsList: {
    paddingTop: 20,
  },
  protocolCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#202020',
    overflow: 'hidden',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  protocolDescription: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#252525',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
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
    color: '#cccccc',
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: '#151515',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#252525',
  },
  continueButtonText: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '500',
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
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 24,
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
    backgroundColor: '#61aed0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#61aed0',
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
    color: '#61aed0',
    fontSize: 14,
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    marginHorizontal: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    padding: 8,
    borderRadius: 8,
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
    color: '#cccccc',
    marginRight: 8,
  },
  nameText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
  bottomLogoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#151515',
  },
  bottomLogo: {
    width: 120,
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#151515',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#202020',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#202020',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#252525',
  },
  cancelButtonText: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#61aed0',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HomeScreen;
