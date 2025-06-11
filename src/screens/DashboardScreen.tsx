import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
  Animated,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import leadService from '../services/leadService';
import indicationService from '../services/indicationService';
import userService from '../services/userService';
import { showErrorAlert } from '../utils/errorHandler';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('DashboardScreen');

// Interfaces
interface Lead {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  utmSource?: string;
  utmMedium?: string;
  indication?: {
    name?: string;
    slug: string;
  };
}

interface Indication {
  id: string;
  slug: string;
  name?: string;
  _count: {
    leads: number;
    events: number;
  };
}

interface UtmSource {
  source: string;
  count: number;
}

interface DashboardData {
  totalLeads: number;
  totalIndications: number;
  totalClicks: number;
  conversionRate: number;
  recentLeads: Lead[];
  topIndications: Indication[];
  topSources: UtmSource[];
}

// Cores para os gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A05195'];

// Função para verificar se uma data é válida
const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

const DashboardScreen = ({ navigation }) => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [userData, setUserData] = useState<any>(null);
  const [showTips, setShowTips] = useState(false);
  
  // Valores para animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;

  // Verificar autenticação e carregar dados
  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        loadUserData();
        fetchDashboardData();
      } else {
        navigation.replace('Login');
      }
    }
  }, [isAuthenticated, authLoading, navigation]);

  // Efeito de fade-in para os componentes
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
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

  // Carrega os dados do usuário
  const loadUserData = async () => {
    try {
      logger.debug('Carregando dados do usuário');
      const profileData = await userService.getProfile();
      setUserData(profileData);
      logger.info('Dados do usuário carregados com sucesso');
    } catch (error) {
      logger.error('Erro ao carregar dados do usuário:', error);
      showErrorAlert(error, 'Erro ao carregar perfil');
    }
  };

  // Buscar dados para o dashboard combinando diferentes APIs
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      logger.debug('Buscando dados do dashboard');
      
      // Buscar leads recentes
      const leadsResponse = await leadService.getLeads({ limit: 5, sort: 'createdAt:desc' });
      const recentLeads = leadsResponse?.data || [];
      
      // Buscar estatísticas de indicações
      const indicationStats = await indicationService.getIndicationStats();
      const indications = await indicationService.getIndications(true);
      
      // Ordenar indicações por número de leads
      const topIndications = [...(indications || [])].sort((a, b) => 
        (b._count?.leads || 0) - (a._count?.leads || 0)
      ).slice(0, 5);
      
      // Processar fontes UTM
      const topSources: UtmSource[] = [];
      if (leadsResponse?.data) {
        const sourceCounts = {};
        leadsResponse.data.forEach(lead => {
          const source = lead.utmSource || 'direct';
          sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        
        Object.entries(sourceCounts).forEach(([source, count]) => {
          topSources.push({ source, count: count as number });
        });
        
        topSources.sort((a, b) => b.count - a.count);
      }
      
      // Calcular totais
      const totalLeads = leadsResponse?.pagination?.total || 0;
      const totalIndications = indications?.length || 0;
      const totalClicks = indicationStats?.overall?.totalClicks || 0;
      const conversionRate = totalClicks > 0 
        ? Math.round((totalLeads / totalClicks) * 100) 
        : 0;
      
      // Montar o objeto com os dados do dashboard
      const dashboardData: DashboardData = {
        totalLeads,
        totalIndications,
        totalClicks,
        conversionRate,
        recentLeads,
        topIndications,
        topSources: topSources.slice(0, 5)
      };
      
      setDashboardData(dashboardData);
      logger.info('Dados do dashboard carregados com sucesso');
      
    } catch (error) {
      logger.error('Erro ao buscar dados do dashboard:', error);
      showErrorAlert(error, 'Erro ao carregar dashboard');
      
      // Define dados vazios para evitar erros na UI
      setDashboardData({
        totalLeads: 0,
        totalIndications: 0,
        totalClicks: 0,
        conversionRate: 0,
        recentLeads: [],
        topIndications: [],
        topSources: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  // Preparar dados para gráficos
  const pieChartData = dashboardData?.topSources?.map((source, index) => ({
    name: source.source || 'Direto',
    population: source.count,
    color: COLORS[index % COLORS.length],
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  })) || [];

  const barChartData = {
    labels: dashboardData?.topIndications?.map(ind => ind.name || ind.slug).slice(0, 5) || [],
    datasets: [{
      data: dashboardData?.topIndications?.map(ind => ind._count.leads).slice(0, 5) || []
    }]
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isValidDate(date)) {
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      }
      return 'Data inválida';
    } catch (error) {
      return 'Data inválida';
    }
  };

  // Informações rápidas para o usuário
  const tips = [
    'Dica: Arraste para baixo para atualizar os dados',
    'Dica: Clique nos gráficos para mais detalhes',
    'Dica: Use a aba Detalhamento para análises avançadas'
  ];

  // Alternar entre mostrar/esconder dicas
  const toggleTips = () => {
    setShowTips(!showTips);
  };

  // Renderização dos cartões com estatísticas
  const renderStatCard = (title: string, value: string | number, icon: string, color: string) => (
    <Animated.View 
      style={[
        styles.card, 
        { 
          borderLeftColor: color,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <Icon name={icon} size={24} color={color} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
    </Animated.View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
        onPress={() => setActiveTab('overview')}
      >
        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
          Visão Geral
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'details' && styles.activeTab]}
        onPress={() => setActiveTab('details')}
      >
        <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
          Detalhamento
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#0088FE']} 
          />
        }
        contentContainerStyle={{ paddingBottom: 70 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Bem-vindo, {userData?.name || 'Médico'}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.helpButton}
              onPress={toggleTips}
            >
              <Icon name="help-circle-outline" size={20} color="#0088FE" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Text style={styles.refreshButtonText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showTips && (
          <View style={styles.tipsContainer}>
            {tips.map((tip, index) => (
              <Text key={index} style={styles.tipText}>
                {tip}
              </Text>
            ))}
            <TouchableOpacity 
              style={styles.closeTipsButton}
              onPress={toggleTips}
            >
              <Text style={styles.closeTipsText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        )}

        {renderTabs()}

        {activeTab === 'overview' ? (
          <Animated.View 
            style={{ 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
          >
            <View style={styles.cardsContainer}>
              {renderStatCard(
                'Total de Leads',
                dashboardData?.totalLeads || 0,
                'phone',
                '#0088FE'
              )}
              {renderStatCard(
                'Links Ativos',
                dashboardData?.totalIndications || 0,
                'link',
                '#666666'
              )}
              {renderStatCard(
                'Taxa de Conversão',
                `${dashboardData?.conversionRate || 0}%`,
                'trending-up',
                '#00C49F'
              )}
            </View>

            {/* Gráfico de Pizza - Fontes */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Leads por Origem</Text>
                <TouchableOpacity 
                  style={styles.chartInfoButton}
                  onPress={() => Alert.alert('Informação', 'Este gráfico mostra a distribuição de leads por origem de tráfego.')}
                >
                  <Icon name="information-outline" size={20} color="#0088FE" />
                </TouchableOpacity>
              </View>
              {pieChartData.length > 0 ? (
                <PieChart
                  data={pieChartData}
                  width={Dimensions.get('window').width - 32}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    }
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="chart-pie" size={40} color="#E5E7EB" />
                  <Text style={styles.noDataText}>Nenhum dado disponível</Text>
                </View>
              )}
            </View>

            {/* Gráfico de Barras - Indicações */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Leads por Indicação</Text>
                <TouchableOpacity 
                  style={styles.chartInfoButton}
                  onPress={() => Alert.alert('Informação', 'Este gráfico mostra o número de leads gerados por cada indicação.')}
                >
                  <Icon name="information-outline" size={20} color="#0088FE" />
                </TouchableOpacity>
              </View>
              {barChartData.labels.length > 0 ? (
                <BarChart
                  data={barChartData}
                  width={Dimensions.get('window').width - 32}
                  height={220}
                  yAxisLabel=""
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 136, 254, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                  }}
                  style={{
                    marginVertical: 8,
                    borderRadius: 16,
                  }}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="chart-bar" size={40} color="#E5E7EB" />
                  <Text style={styles.noDataText}>Nenhum dado disponível</Text>
                </View>
              )}
            </View>

            {/* Lista de Leads Recentes */}
            <View style={styles.leadsCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Leads Recentes</Text>
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('Leads')}
                >
                  <Text style={styles.viewAllText}>Ver todos</Text>
                  <Icon name="chevron-right" size={16} color="#0088FE" />
                </TouchableOpacity>
              </View>
              {dashboardData?.recentLeads && dashboardData.recentLeads.length > 0 ? (
                dashboardData.recentLeads.map((lead) => (
                  <TouchableOpacity 
                    key={lead.id} 
                    style={styles.leadItem}
                    onPress={() => Alert.alert('Detalhes do Lead', `Nome: ${lead.name}\nTelefone: ${lead.phone}\nData: ${formatDate(lead.createdAt)}\nOrigem: ${lead.utmSource || "Direta"}`)}
                  >
                    <View style={styles.leadInfo}>
                      <View style={[
                        styles.leadAvatar,
                        { backgroundColor: lead.utmSource ? '#EBF5FF' : '#F0F4F8' }
                      ]}>
                        <Text style={styles.leadAvatarText}>
                          {lead.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.leadName}>{lead.name}</Text>
                        <Text style={styles.leadSource}>
                          {lead.indication?.name || lead.indication?.slug || "Link principal"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.leadContact}>
                      <Text style={styles.leadPhone}>{lead.phone}</Text>
                      <Text style={styles.leadDate}>{formatDate(lead.createdAt)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="account-multiple" size={40} color="#E5E7EB" />
                  <Text style={styles.noDataText}>Nenhum lead registrado ainda</Text>
                </View>
              )}
            </View>
          </Animated.View>
        ) : (
          <Animated.View 
            style={[
              styles.detailsContainer,
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Estatísticas detalhadas */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Estatísticas</Text>
                <TouchableOpacity 
                  style={styles.chartInfoButton}
                  onPress={() => Alert.alert('Informação', 'Esta seção mostra estatísticas avançadas e métricas de desempenho.')}
                >
                  <Icon name="information-outline" size={20} color="#0088FE" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.conversionRateContainer}>
                <Text style={styles.statLabel}>Taxa de Conversão</Text>
                <View style={styles.conversionRateBar}>
                  <View 
                    style={[
                      styles.conversionRateFill, 
                      { width: `${Math.min(dashboardData?.conversionRate || 0, 100)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.conversionRateText}>
                  {dashboardData?.conversionRate || 0}%
                </Text>
              </View>
              
              <View style={styles.separator} />
              
              <View style={styles.statsGrid}>
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => Alert.alert('Total de Cliques', `Seu indicador recebeu ${dashboardData?.totalClicks || 0} cliques no total.`)}
                >
                  <Text style={styles.statLabel}>Total de Cliques</Text>
                  <View style={styles.statValueContainer}>
                    <Text style={styles.statValue}>{dashboardData?.totalClicks || 0}</Text>
                    <Icon name="cursor-default-click" size={16} color="#666" style={styles.statIcon} />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => Alert.alert('Eficiência', 'Este valor indica quantos leads são gerados para cada clique.')}
                >
                  <Text style={styles.statLabel}>Eficiência</Text>
                  <View style={styles.statValueContainer}>
                    <Text style={styles.statValue}>
                      {dashboardData?.totalClicks 
                        ? (dashboardData.totalLeads / dashboardData.totalClicks).toFixed(2) 
                        : "0.00"}
                    </Text>
                    <Icon name="percent" size={16} color="#666" style={styles.statIcon} />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => Alert.alert('Leads por Link', 'Este valor mostra a média de leads gerados por cada link de indicação.')}
                >
                  <Text style={styles.statLabel}>Leads por Link</Text>
                  <View style={styles.statValueContainer}>
                    <Text style={styles.statValue}>
                      {dashboardData?.totalIndications 
                        ? (dashboardData.totalLeads / dashboardData.totalIndications).toFixed(1) 
                        : "0.0"}
                    </Text>
                    <Icon name="link" size={16} color="#666" style={styles.statIcon} />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => Alert.alert('Cliques por Link', 'Este valor mostra a média de cliques recebidos por cada link de indicação.')}
                >
                  <Text style={styles.statLabel}>Cliques por Link</Text>
                  <View style={styles.statValueContainer}>
                    <Text style={styles.statValue}>
                      {dashboardData?.totalIndications 
                        ? (dashboardData.totalClicks / dashboardData.totalIndications).toFixed(1) 
                        : "0.0"}
                    </Text>
                    <Icon name="cursor-default-click-outline" size={16} color="#666" style={styles.statIcon} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Lista de todos os indicadores */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Todos os Indicadores</Text>
                <TouchableOpacity 
                  style={styles.chartInfoButton}
                  onPress={() => Alert.alert('Informação', 'Esta tabela mostra todos os seus links de indicação e seus respectivos desempenhos.')}
                >
                  <Icon name="information-outline" size={20} color="#0088FE" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>INDICADOR</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>LEADS</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>CLIQUES</Text>
              </View>
              
              {dashboardData?.topIndications && dashboardData.topIndications.length > 0 ? (
                dashboardData.topIndications.map((indication) => (
                  <TouchableOpacity 
                    key={indication.id} 
                    style={styles.tableRow}
                    onPress={() => Alert.alert(
                      indication.name || indication.slug,
                      `Leads: ${indication._count.leads}\nCliques: ${indication._count.events}\nTaxa de conversão: ${indication._count.events ? ((indication._count.leads / indication._count.events) * 100).toFixed(1) : 0}%`
                    )}
                  >
                    <Text style={[styles.tableCell, { flex: 2 }]}>
                      {indication.name || indication.slug}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {indication._count.leads}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {indication._count.events}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="link-variant-off" size={40} color="#E5E7EB" />
                  <Text style={styles.noDataText}>Nenhum indicador registrado ainda</Text>
                </View>
              )}
            </View>
            
            {/* Origem do tráfego */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Origem do Tráfego</Text>
                <TouchableOpacity 
                  style={styles.chartInfoButton}
                  onPress={() => Alert.alert('Informação', 'Esta seção mostra de onde vêm os visitantes que se tornam leads.')}
                >
                  <Icon name="information-outline" size={20} color="#0088FE" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>FONTE</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>LEADS</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>%</Text>
              </View>
              
              {dashboardData?.topSources && dashboardData.topSources.length > 0 ? (
                dashboardData.topSources.map((source, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.tableRow}
                    onPress={() => Alert.alert(
                      source.source || "Tráfego Direto",
                      `Leads: ${source.count}\nPercentual: ${Math.round((source.count / (dashboardData.totalLeads || 1)) * 100)}%`
                    )}
                  >
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                      <View 
                        style={[
                          styles.colorDot, 
                          { backgroundColor: COLORS[index % COLORS.length] }
                        ]} 
                      />
                      <Text style={styles.tableCell}>{source.source || "Direto"}</Text>
                    </View>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {source.count}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {Math.round((source.count / (dashboardData.totalLeads || 1)) * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="traffic-light" size={40} color="#E5E7EB" />
                  <Text style={styles.noDataText}>Nenhuma origem registrada ainda</Text>
                </View>
              )}
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
    marginTop: 10,
    color: '#0088FE',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0088FE',
    marginLeft: 8,
  },
  refreshButtonText: {
    color: '#0088FE',
    fontSize: 14,
    fontWeight: '500',
  },
  helpButton: {
    padding: 8,
  },
  tipsContainer: {
    backgroundColor: '#EBF5FF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0088FE',
  },
  tipText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  closeTipsButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  closeTipsText: {
    color: '#0088FE',
    fontSize: 14,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
  },
  activeTab: {
    backgroundColor: '#EBF5FF',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0088FE',
    fontWeight: '600',
  },
  cardsContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 8,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
  },
  chartInfoButton: {
    padding: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#0088FE',
    fontSize: 14,
    marginRight: 4,
  },
  leadsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  leadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  leadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leadAvatarText: {
    color: '#0088FE',
    fontSize: 18,
    fontWeight: '500',
  },
  leadName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  leadSource: {
    fontSize: 12,
    color: '#6B7280',
  },
  leadContact: {
    alignItems: 'flex-end',
  },
  leadPhone: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  leadDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailsContainer: {
    flex: 1,
    padding: 0,
  },
  noDataContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  noDataText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
  },
  
  // Estilos para a tab de detalhes
  conversionRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 2,
  },
  conversionRateBar: {
    height: 8,
    flex: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  conversionRateFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  conversionRateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 8,
    flex: 1,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 8,
    paddingRight: 8,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1F2937',
  },
  statIcon: {
    marginLeft: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCell: {
    fontSize: 14,
    color: '#1F2937',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
});

export default DashboardScreen; 