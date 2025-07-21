import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import leadService from '../services/leadService';
import { showErrorAlert } from '../utils/errorHandler';
import { createLogger } from '../utils/logUtils';
import LoadingSpinner from '../components/LoadingSpinner';

const logger = createLogger('LeadsScreen');

// Status de leads com cores
const leadStatuses = [
  { id: 'all', label: 'Todos', color: '#0088FE' },
  { id: 'new', label: 'Novos', color: '#0088FE' },
  { id: 'scheduled', label: 'Agendados', color: '#10B981' },
  { id: 'attended', label: 'Compareceram', color: '#22C55E' },
  { id: 'closed', label: 'Fechados', color: '#8B5CF6' },
  { id: 'noshow', label: 'Não vieram', color: '#EF4444' }
];

// Modelo para dados do lead
const mockLeads = [
  {
    id: '1',
    name: 'João Silva',
    phone: '(11) 98765-4321',
    interest: 'Consulta Geral',
    status: 'new',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Maria Oliveira',
    phone: '(11) 97654-3210',
    interest: 'Cardiologia',
    status: 'scheduled',
    appointmentDate: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
    createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString()
  },
  {
    id: '3',
    name: 'Pedro Santos',
    phone: '(11) 96543-2109',
    interest: 'Pediatria',
    status: 'attended',
    createdAt: new Date(Date.now() - 10*24*60*60*1000).toISOString()
  },
  {
    id: '4',
    name: 'Ana Pereira',
    phone: '(11) 95432-1098',
    interest: 'Dermatologia',
    status: 'closed',
    createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString()
  },
  {
    id: '5',
    name: 'Carlos Ferreira',
    phone: '(11) 94321-0987',
    interest: 'Ortopedia',
    status: 'noshow',
    createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString()
  }
];

const LeadsScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        fetchLeads();
      } else {
        navigation.replace('Login');
      }
    }
  }, [isAuthenticated, authLoading, navigation]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      logger.debug('Buscando leads da API');
      const response = await leadService.getLeads();
      
      if (response && Array.isArray(response.data)) {
        logger.info(`Recebidos ${response.data.length} leads da API`);
        const processedLeads = response.data.map(lead => ({
          id: lead.id || String(Math.random()),
          name: lead.name || 'Nome indisponível',
          phone: lead.phone || 'Telefone indisponível',
          interest: lead.interest || lead.indication?.name || 'Não especificado',
          status: lead.status || 'new',
          createdAt: lead.createdAt || new Date().toISOString(),
          appointmentDate: lead.appointmentDate || null
        }));
        setLeads(processedLeads);
      } else {
        logger.warn('Resposta da API não contém dados de leads válidos');
        setLeads([]);
        Alert.alert('Aviso', 'Não foram encontrados leads para exibir.');
      }
    } catch (error) {
      logger.error('Erro ao buscar leads:', error);
      showErrorAlert(error, 'Erro ao carregar leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar leads por status e termo de busca
  const getFilteredLeads = () => {
    let filtered = leads;
    
    // Filtrar por status
    if (activeStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === activeStatus);
    }
    
    // Filtrar por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.name.toLowerCase().includes(term) ||
        lead.phone.includes(term) ||
        (lead.interest && lead.interest.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  };

  const handleEditLead = (lead) => {
    setSelectedLead(lead);
    setEditModalVisible(true);
    // Aqui abriria um modal de edição
    Alert.alert(
      'Editar Lead',
      `Dados do lead: ${lead.name}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Editar', onPress: () => console.log('Editar lead', lead.id) }
      ]
    );
  };

  const handleScheduleLead = (lead) => {
    // Aqui abriria um modal para agendar consulta
    Alert.alert(
      'Agendar Consulta',
      `Agendar consulta para ${lead.name}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Agendar', onPress: () => console.log('Agendar para lead', lead.id) }
      ]
    );
  };

  const handleStatusChange = async (lead, status) => {
    Alert.alert(
      'Alterar Status',
      `Alterar status de ${lead.name} para ${getStatusLabel(status)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: async () => {
            try {
              setLoading(true);
              await leadService.updateLead(lead.id, { status });
              
              // Atualiza a lista localmente após sucesso na API
              const updatedLeads = leads.map(l => {
                if (l.id === lead.id) {
                  return { ...l, status };
                }
                return l;
              });
              
              setLeads(updatedLeads);
              Alert.alert('Sucesso', 'Status atualizado com sucesso!');
            } catch (error) {
              logger.error('Erro ao atualizar status do lead:', error);
              showErrorAlert(error, 'Erro ao atualizar status');
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  };

  const getStatusLabel = (statusId) => {
    const status = leadStatuses.find(s => s.id === statusId);
    return status ? status.label : 'Desconhecido';
  };

  const getStatusColor = (statusId) => {
    const status = leadStatuses.find(s => s.id === statusId);
    return status ? status.color : '#9CA3AF';
  };

  const renderLeadItem = ({ item }) => (
    <View style={styles.leadCard}>
      <View style={styles.leadHeader}>
        <Text style={styles.leadName}>{item.name}</Text>
        <TouchableOpacity 
          style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}
          onPress={() => handleStatusChange(item, item.status === 'new' ? 'scheduled' : 'new')}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.leadDetails}>
        <View style={styles.leadDetail}>
          <Icon name="phone" size={16} color="#6B7280" style={styles.leadDetailIcon} />
          <Text style={styles.leadDetailText}>{item.phone}</Text>
        </View>
        
        {item.interest && (
          <View style={styles.leadDetail}>
            <Icon name="briefcase-outline" size={16} color="#6B7280" style={styles.leadDetailIcon} />
            <Text style={styles.leadDetailText}>{item.interest}</Text>
          </View>
        )}
        
        <View style={styles.leadDetail}>
          <Icon name="calendar" size={16} color="#6B7280" style={styles.leadDetailIcon} />
          <Text style={styles.leadDetailText}>
            {item.appointmentDate ? 
              new Date(item.appointmentDate).toLocaleDateString() : 
              'Sem agendamento'}
          </Text>
        </View>
      </View>
      
      <View style={styles.leadActions}>
        <TouchableOpacity 
          style={styles.leadActionButton}
          onPress={() => handleScheduleLead(item)}
        >
          <Icon name="calendar-plus" size={20} color="#0088FE" />
          <Text style={styles.leadActionText}>Agendar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.leadActionButton}
          onPress={() => handleEditLead(item)}
        >
          <Icon name="pencil" size={20} color="#6B7280" />
          <Text style={[styles.leadActionText, { color: '#6B7280' }]}>Editar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Calcular estatísticas de leads
  const leadStats = {
    total: leads.length,
    new: leads.filter(lead => lead.status === 'new').length,
    scheduled: leads.filter(lead => lead.status === 'scheduled').length,
    attended: leads.filter(lead => lead.status === 'attended').length,
    closed: leads.filter(lead => lead.status === 'closed').length,
    noshow: leads.filter(lead => lead.status === 'noshow').length,
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Leads</Text>
          <Text style={styles.subtitle}>Gerenciar potenciais pacientes</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={fetchLeads}
        >
          <Icon name="refresh" size={20} color="#0088FE" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="magnify" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar leads..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#9CA3AF"
          />
          {searchTerm ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchTerm('')}
            >
              <Icon name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {leadStatuses.map(status => (
            <TouchableOpacity
              key={status.id}
              style={[
                styles.filterButton,
                activeStatus === status.id && { 
                  backgroundColor: `${status.color}20`,
                  borderColor: status.color
                }
              ]}
              onPress={() => setActiveStatus(status.id)}
            >
              <Text 
                style={[
                  styles.filterButtonText,
                  activeStatus === status.id && { color: status.color }
                ]}
              >
                {status.label}
                {status.id !== 'all' && leadStats[status.id] > 0 && 
                  ` (${leadStats[status.id]})`
                }
                {status.id === 'all' && ` (${leadStats.total})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <FlatList
        data={getFilteredLeads()}
        renderItem={renderLeadItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="account-search" size={48} color="#E5E7EB" />
            <Text style={styles.emptyText}>
              {searchTerm ? 
                'Nenhum lead encontrado para esta busca.' : 
                'Nenhum lead disponível nesta categoria.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

// Componente ScrollView
const ScrollView = ({ horizontal, children, contentContainerStyle, showsHorizontalScrollIndicator }) => {
  if (horizontal) {
    return (
      <View style={{ flexDirection: 'row', overflow: 'scroll' }}>
        <View style={contentContainerStyle}>
          {children}
        </View>
      </View>
    );
  }
  return (
    <View>
      <View style={contentContainerStyle}>
        {children}
      </View>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#1F2937',
  },
  clearButton: {
    padding: 4,
  },
  filterContainer: {
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999, // Very large number for pill shape
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding at bottom for tab bar
  },
  leadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  leadDetails: {
    marginVertical: 8,
  },
  leadDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  leadDetailIcon: {
    marginRight: 8,
  },
  leadDetailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  leadActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  leadActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  leadActionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#0088FE',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LeadsScreen; 