import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { createLogger } from '../utils/logUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { AuthError } from '../utils/errorHandler';

const logger = createLogger('PatientProfile');

const PatientProfile = () => {
  const navigation = useNavigation();
  const { logout, isAuthenticated, handleSessionExpired } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(50)).current;
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
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
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [loading, fadeAnim, translateAnim]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      logger.debug('Carregando perfil do paciente');
      
      const response = await apiClient.get('/api/patient/profile');
      setProfile(response.user);
      logger.info('Perfil do paciente carregado com sucesso');
      
    } catch (error) {
      logger.error('Erro ao carregar perfil:', error);
      if (error instanceof AuthError) {
        handleSessionExpired();
      }
      // Não mostrar alert, apenas definir profile como null
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, []);

  const openWhatsApp = () => {
    const phoneNumber = '5511976638147';
    const message = 'Hello! I need help accessing my profile in the app.';
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Not informed';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US');
    } catch {
      return 'Invalid date';
    }
  };

  const renderInfoCard = (title, icon, children) => (
    <Animated.View 
      style={[
        styles.infoCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateAnim }]
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <Icon name={icon} size={20} color="#0088FE" />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardContent}>
        {children}
      </View>
    </Animated.View>
  );

  const renderInfoRow = (label, value, icon) => (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Icon name={icon} size={16} color="#6B7280" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value || 'Not informed'}</Text>
    </View>
  );

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Unable to load your profile</Text>
        <Text style={styles.errorDescription}>
          There was a problem loading your data. Contact us via WhatsApp for help.
        </Text>
        
        <View style={styles.errorActions}>
          <TouchableOpacity 
            style={styles.whatsappButton} 
            onPress={openWhatsApp}
          >
            <Icon name="whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.whatsappButtonText}>Chat on WhatsApp</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchProfile}
          >
            <Icon name="refresh" size={20} color="#0088FE" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#333333" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
        
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="logout" size={22} color="#cccccc" />
        </TouchableOpacity>
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
        {/* Cabeçalho do Perfil */}
        <Animated.View 
          style={[
            styles.profileHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateAnim }]
            }
          ]}
        >
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ uri: profile.image || 'https://via.placeholder.com/120/0088FE/FFFFFF?text=P' }} 
              style={styles.profileImage} 
            />
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileEmail}>{profile.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Patient</Text>
            </View>
          </View>
        </Animated.View>

        {/* Informações Pessoais */}
        {renderInfoCard('Personal Information', 'account', (
          <>
            {renderInfoRow('Full name', profile.name, 'account')}
            {renderInfoRow('Email', profile.email, 'email')}
            {renderInfoRow('Phone', profile.phone, 'phone')}
            {renderInfoRow('Date of birth', formatDate(profile.birthDate), 'calendar')}
            {renderInfoRow('Gender', profile.gender, 'human-male-female')}
          </>
        ))}

        
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#cccccc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 24,
  },
  errorDescription: {
    fontSize: 16,
    color: '#cccccc',
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#61aed0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#61aed0',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF2',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#61aed0',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#E8ECF2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#61aed0',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF2',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 12,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 'auto',
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  doctorEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  doctorPhone: {
    fontSize: 14,
    color: '#666666',
  },
});

export default PatientProfile; 