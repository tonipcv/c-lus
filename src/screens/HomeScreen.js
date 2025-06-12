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
  Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('HomeScreen');
const { width, height } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, logout, isAuthenticated, handleSessionExpired } = useAuth();
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (isAuthenticated) {
      loadProtocols();
      loadUserProfile();
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
      setProtocols(protocolsArray);
      logger.info(`${protocolsArray.length} protocolos carregados`);
      
    } catch (error) {
      logger.error('Erro ao carregar protocolos:', error);
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

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US');
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
              {formatDate(protocol.startDate)} - {formatDate(protocol.endDate)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="clock" size={16} color="#cccccc" />
            <Text style={styles.detailText}>
                {protocolData.duration} days • Current day: {protocol.currentDay}
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

        {protocol.status === 'ACTIVE' && (
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={() => {
              navigation.navigate('Protocol', { protocol: protocol });
            }}
          >
              <Text style={styles.continueButtonText}>Continue Protocol</Text>
            <Icon name="arrow-right" size={16} color="#cccccc" />
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
  const activeProtocols = protocols.filter(p => p.status === 'ACTIVE');
  const inactiveProtocols = protocols.filter(p => p.status !== 'ACTIVE');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#cccccc" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>My Protocols</Text>
            {user?.name && (
              <Text style={styles.welcomeText}>Hello, {user.name}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.headerActions}>
        <TouchableOpacity 
          onPress={handleProfilePress} 
          style={styles.profileButton}
          activeOpacity={0.7}
        >
          {userProfile?.image ? (
            <Image 
              source={{ uri: userProfile.image }} 
              style={styles.profileImage}
            />
          ) : (
            <Icon name="account-circle" size={22} color="#61aed0" />
          )}
        </TouchableOpacity>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
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
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  welcomeText: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#2a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  protocolsList: {
    padding: 20,
  },
  protocolCard: {
    backgroundColor: '#151515',
    borderRadius: 12,
    marginBottom: 16,
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
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
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
    backgroundColor: 'transparent',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#61aed0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#61aed0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
  protocolSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    padding: 8,
    borderRadius: 8,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

export default HomeScreen;
