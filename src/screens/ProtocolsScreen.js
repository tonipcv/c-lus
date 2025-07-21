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
const logger = createLogger('ProtocolsScreen');
const { width, height } = Dimensions.get('window');

const ProtocolsScreen = () => {
  const navigation = useNavigation();
  const { user, handleSessionExpired } = useAuth();
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startProtocolModal, setStartProtocolModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadProtocols();
  }, []);

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
          progress: prescription.progress,
          plannedStartDate: prescription.planned_start_date,
          plannedEndDate: prescription.planned_end_date,
          actualEndDate: prescription.actual_end_date,
          pausedAt: prescription.paused_at,
          pauseReason: prescription.pause_reason,
          abandonedAt: prescription.abandoned_at,
          abandonReason: prescription.abandon_reason
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProtocols();
    setRefreshing(false);
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
        prescriptionId: protocol.id,
        startDate: protocol.startDate
      });
      
      // Use the new endpoint structure
      await apiClient.post(`/api/v2/patients/prescriptions/${protocol.id}/start`);
      
      await loadProtocols();
      navigation.navigate('Protocol', { protocolId: protocol.id });
      logger.info('Protocol started successfully');
    } catch (error) {
      logger.error('Error starting protocol:', error);
      
      // Handle specific error when protocol is already started
      if (error.response?.status === 400 && error.response?.data?.actual_start_date) {
        const startDate = new Date(error.response.data.actual_start_date).toLocaleDateString();
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
    if (protocolData.coverImage) {
      return protocolData.coverImage;
    }
    
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
      return 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=200&fit=crop&crop=center';
    }
  };

  const renderProtocolCard = (protocol, index) => {
    const { protocol: protocolData } = protocol;
    const protocolImage = getProtocolImage(protocolData);
    const isAvailable = isProtocolAvailable(protocol);
    
    const canStart = protocol.status === 'PRESCRIBED' && !protocol.actualStartDate && isAvailable;
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Protocols</Text>
          <Text style={styles.headerSubtitle}>Your treatment protocols</Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1697F5']}
            tintColor="#1697F5"
          />
        }
      >
        <View style={styles.content}>
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

      {renderStartProtocolModal()}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#16171b',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'ManropeSemiBold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontFamily: 'ManropeRegular',
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
  scrollView: {
    flex: 1,
    paddingBottom: 120,
  },
  content: {
    padding: 20,
    backgroundColor: '#1d1e24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    marginTop: 20,
    paddingBottom: 120,
  },
  protocolsList: {
    gap: 16,
  },
  protocolCard: {
    backgroundColor: '#26272c',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  protocolImage: {
    width: '100%',
    height: 160,
  },
  protocolContent: {
    padding: 16,
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
    color: '#f1f5f9',
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
    marginTop: 12,
  },
  continueButtonText: {
    color: '#f1f5f9',
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
  emptyStateTitle: {
    fontSize: 20,
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'ManropeSemiBold',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
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
    backgroundColor: '#26272c',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: height * 0.8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#f1f5f9',
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
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
  confirmButton: {
    backgroundColor: '#1697F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'ManropeMedium',
  },
});

export default ProtocolsScreen; 