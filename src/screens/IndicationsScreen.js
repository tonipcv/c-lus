import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Clipboard,
  Dimensions,
  Linking,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import indicationService from '../services/indicationService';
import userService from '../services/userService';
import { showErrorAlert } from '../utils/errorHandler';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('IndicationsScreen');
const { width } = Dimensions.get('window');

const IndicationsScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  
  const [newIndication, setNewIndication] = useState('');
  const [generatedSlug, setGeneratedSlug] = useState('');
  const [indications, setIndications] = useState([]);
  const [baseUrl, setBaseUrl] = useState('https://med-ten-flax.vercel.app');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userSlug, setUserSlug] = useState('');
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        fetchUserProfile();
        fetchIndications();
      } else {
        navigation.replace('Login');
      }
    }
  }, [isAuthenticated, authLoading, navigation]);

  const fetchUserProfile = async () => {
    setIsLoading(true);
    try {
      logger.debug('Loading user profile');
      const profile = await userService.getUserProfile();
      
      if (profile && profile.slug) {
        setUserSlug(profile.slug);
        logger.info('User profile loaded successfully');
      }
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      showErrorAlert(error, 'Error loading profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIndications = async () => {
    setIsLoading(true);
    try {
      logger.debug('Loading indications');
      const response = await indicationService.getIndications(true, 'month');
      
      if (response && response.indications) {
        setIndications(response.indications);
        
        // Calculate totals
        const totalLeadsCount = response.indications.reduce((sum, ind) => sum + (ind._count?.leads || 0), 0);
        const totalClicksCount = response.indications.reduce((sum, ind) => sum + (ind._count?.events || 0), 0);
        
        setTotalLeads(totalLeadsCount);
        setTotalClicks(totalClicksCount);
        
        logger.info('Indications loaded successfully');
      }
    } catch (error) {
      logger.error('Error loading indications:', error);
      showErrorAlert(error, 'Error loading indications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSlug = async () => {
    if (!newIndication.trim()) return;
    
    setIsGenerating(true);
    try {
      logger.debug('Generating slug for indication:', newIndication);
      const response = await indicationService.generateIndicationLink({
        name: newIndication
      });
      
      if (response && response.slug) {
        setGeneratedSlug(response.slug);
        logger.info('Slug generated successfully:', response.slug);
        
        // Auto-focus on create button
        setTimeout(() => {
          // Could add ref to button and focus if needed
        }, 100);
      }
    } catch (error) {
      logger.error('Error generating slug:', error);
      showErrorAlert(error, 'Error generating link');
      
      // Fallback in case of error
      const fallbackSlug = newIndication
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '-');
      setGeneratedSlug(fallbackSlug);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateIndication = async () => {
    if (!newIndication.trim()) return;
    
    setIsLoading(true);
    try {
      logger.debug('Creating new indication:', newIndication);
      // Generate slug if it doesn't exist yet
      let slug = generatedSlug;
      if (!slug) {
        slug = newIndication
          .toLowerCase()
          .replace(/[^\w\s]/gi, '')
          .replace(/\s+/g, '-');
      }
      
      const data = {
        name: newIndication,
        slug
      };
      
      const response = await indicationService.createIndication(data);
      
      if (response) {
        // Reload indications list
        fetchIndications();
        setNewIndication('');
        setGeneratedSlug('');
        Alert.alert('Success', 'Indication link created successfully!');
        logger.info('Indication created successfully');
      }
    } catch (error) {
      logger.error('Error creating indication:', error);
      showErrorAlert(error, 'Error creating indication');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('Link copied', 'Link copied to clipboard.');
  };

  const shareOnWhatsApp = (link) => {
    // Add UTMs when sharing via WhatsApp for tracking
    const linkWithUtm = `${link}?utm_source=whatsapp&utm_medium=share&utm_campaign=indication`;
    Linking.openURL(`whatsapp://send?text=Check out this link: ${linkWithUtm}`);
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchIndications().finally(() => setRefreshing(false));
  }, []);

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
        <Text style={styles.loadingText}>Loading indications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Indications</Text>
          <Text style={styles.subtitle}>Manage your custom links</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Icon name="refresh" size={22} color="#0088FE" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0088FE"]} />
        }
      >
        {/* Doctor's direct link */}
        <View style={styles.personalLinkCard}>
          <Text style={styles.personalLinkLabel}>Your link:</Text>
          <View style={styles.personalLinkContent}>
            <Text style={styles.personalLinkText}>{`${baseUrl}/${userSlug}`}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => copyToClipboard(`${baseUrl}/${userSlug}`)}
            >
              <Icon name="content-copy" size={18} color="#0088FE" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Statistics cards */}
        <View style={styles.statsContainer}>
          {/* Active Links */}
          <View style={[styles.statCard, { borderLeftColor: '#0088FE' }]}>
            <View style={styles.statHeader}>
              <Icon name="link-variant" size={18} color="#0088FE" />
              <Text style={styles.statTitle}>Active Links</Text>
            </View>
            <Text style={styles.statDescription}>Total links created</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: '#0088FE' }]}>{indications.length}</Text>
              <View style={[styles.badge, { backgroundColor: '#EBF5FF' }]}>
                <Text style={{ color: '#0088FE', fontSize: 12 }}>Active</Text>
              </View>
            </View>
          </View>
          
          {/* Total Leads */}
          <View style={[styles.statCard, { borderLeftColor: '#666666' }]}>
            <View style={styles.statHeader}>
              <Icon name="account" size={18} color="#666666" />
              <Text style={styles.statTitle}>Total Leads</Text>
            </View>
            <Text style={styles.statDescription}>Total conversions</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: '#666666' }]}>{totalLeads}</Text>
              <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
                <Text style={{ color: '#666666', fontSize: 12 }}>Total</Text>
              </View>
            </View>
          </View>
          
          {/* Clicks */}
          <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
            <View style={styles.statHeader}>
              <Icon name="trending-up" size={18} color="#3B82F6" />
              <Text style={styles.statTitle}>Clicks</Text>
            </View>
            <Text style={styles.statDescription}>Total accesses</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>{totalClicks}</Text>
              <Text style={styles.conversionRate}>
                {totalLeads > 0 ? `${Math.round((totalLeads / totalClicks) * 100)}% conv.` : '0% conv.'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Create new link */}
        <View style={styles.createCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Create new link</Text>
            <Text style={styles.cardDescription}>Generate a new custom indication link</Text>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Indication name</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={newIndication}
                onChangeText={setNewIndication}
                placeholder="Ex: Instagram, WhatsApp, Facebook..."
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerateSlug}
                disabled={!newIndication.trim() || isGenerating}
              >
                <Icon name="link-variant" size={20} color="#0088FE" />
              </TouchableOpacity>
            </View>
            
            {generatedSlug ? (
              <View style={styles.generatedSlugContainer}>
                <Text style={styles.generatedSlugLabel}>Generated link:</Text>
                <View style={styles.generatedSlugContent}>
                  <Text style={styles.generatedSlugText}>
                    {`${baseUrl}/${userSlug}/${generatedSlug}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.copySlugButton}
                    onPress={() => copyToClipboard(`${baseUrl}/${userSlug}/${generatedSlug}`)}
                  >
                    <Icon name="content-copy" size={18} color="#0088FE" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            
            <TouchableOpacity
              style={[
                styles.createButton,
                (!newIndication.trim() || isLoading) && styles.disabledButton
              ]}
              onPress={handleCreateIndication}
              disabled={!newIndication.trim() || isLoading}
            >
              <Text style={styles.createButtonText}>
                {isLoading ? 'Creating...' : 'Create Indication Link'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Links List */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>Your Links ({indications.length})</Text>
          
          {indications.map((indication, index) => (
            <View 
              key={indication.id}
              style={styles.linkCard}
            >
              <View style={styles.linkHeader}>
                <Text style={styles.linkName}>{indication.name || indication.slug}</Text>
                <View style={styles.linkStats}>
                  <Icon name="account" size={14} color="#666666" style={styles.linkStatIcon} />
                  <Text style={styles.linkStatText}>{indication._count.leads}</Text>
                  <Icon name="trending-up" size={14} color="#666666" style={styles.linkStatIcon} />
                  <Text style={styles.linkStatText}>{indication._count.events}</Text>
                </View>
              </View>
              
              <View style={styles.linkUrlContainer}>
                <Text style={styles.linkUrl} numberOfLines={1} ellipsizeMode="middle">
                  {`${baseUrl}/${userSlug}/${indication.slug}`}
                </Text>
              </View>
              
              <View style={styles.linkActions}>
                <TouchableOpacity
                  style={styles.linkActionButton}
                  onPress={() => copyToClipboard(`${baseUrl}/${userSlug}/${indication.slug}`)}
                >
                  <Icon name="content-copy" size={20} color="#0088FE" />
                  <Text style={styles.linkActionText}>Copy</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.linkActionButton}
                  onPress={() => shareOnWhatsApp(`${baseUrl}/${userSlug}/${indication.slug}`)}
                >
                  <Icon name="share-variant" size={20} color="#10B981" />
                  <Text style={[styles.linkActionText, { color: '#10B981' }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {indications.length === 0 && (
            <View style={styles.emptyContainer}>
              <Icon name="link-variant-off" size={50} color="#E5E7EB" />
              <Text style={styles.emptyText}>No indication links created yet</Text>
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
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 10,
    color: '#0088FE',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  refreshButton: {
    padding: 10,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  personalLinkCard: {
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  personalLinkLabel: {
    fontSize: 14,
    color: '#3B82F6',
    marginBottom: 4,
  },
  personalLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personalLinkText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  copyButton: {
    padding: 8,
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 8,
  },
  statDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conversionRate: {
    fontSize: 12,
    color: '#6B7280',
  },
  createCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    margin: 16,
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  formContainer: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  generateButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
  },
  generatedSlugContainer: {
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  generatedSlugLabel: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 8,
  },
  generatedSlugContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  generatedSlugText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
  },
  copySlugButton: {
    padding: 4,
  },
  createButton: {
    backgroundColor: '#0088FE',
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 16,
  },
  linkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  linkStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkStatIcon: {
    marginHorizontal: 2,
  },
  linkStatText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  linkUrlContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  linkUrl: {
    fontSize: 12,
    color: '#6B7280',
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
  },
  linkActionText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#0088FE',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default IndicationsScreen; 