import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import symptomReportsService from '../services/symptomReportsService';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('SymptomReportsScreen');
const { width } = Dimensions.get('window');

const SymptomReportsScreen = () => {
  const navigation = useNavigation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  });
  const [filter, setFilter] = useState('ALL'); // ALL, PENDING, REVIEWED

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [filter])
  );

  const loadReports = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = {
        limit: pagination.limit,
        offset: isRefresh ? 0 : pagination.offset,
        ...(filter !== 'ALL' && { status: filter })
      };

      logger.debug('Carregando relatórios de sintomas', { filter, params });
      const response = await symptomReportsService.getSymptomReports(params);

      if (isRefresh) {
        setReports(response.reports || []);
        setPagination({
          ...pagination,
          offset: 0,
          total: response.pagination?.total || 0,
          hasMore: response.pagination?.hasMore || false
        });
      } else {
        setReports(response.reports || []);
        setPagination(response.pagination || pagination);
      }

      logger.info('Relatórios carregados', { 
        count: response.reports?.length || 0,
        total: response.pagination?.total || 0 
      });
    } catch (error) {
      logger.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadReports(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return '#F59E0B';
      case 'REVIEWED': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING': return 'Pending Review';
      case 'REVIEWED': return 'Reviewed';
      default: return 'Unknown';
    }
  };

  const getSeverityColor = (severity) => {
    if (severity <= 3) return '#10B981'; // Green - Mild
    if (severity <= 6) return '#F59E0B'; // Yellow - Moderate
    if (severity <= 8) return '#F97316'; // Orange - Severe
    return '#EF4444'; // Red - Very Severe
  };

  const getSeverityText = (severity) => {
    if (severity <= 3) return 'Mild';
    if (severity <= 6) return 'Moderate';
    if (severity <= 8) return 'Severe';
    return 'Very Severe';
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const renderFilterTabs = () => {
    const filters = [
      { key: 'ALL', label: 'All Reports', count: pagination.total },
      { key: 'PENDING', label: 'Pending', count: reports.filter(r => r.status === 'PENDING').length },
      { key: 'REVIEWED', label: 'Reviewed', count: reports.filter(r => r.status === 'REVIEWED').length }
    ];

    return (
      <View style={styles.filterTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((filterItem) => (
            <TouchableOpacity
              key={filterItem.key}
              style={[
                styles.filterTab,
                filter === filterItem.key && styles.filterTabActive
              ]}
              onPress={() => setFilter(filterItem.key)}
            >
              <Text style={[
                styles.filterTabText,
                filter === filterItem.key && styles.filterTabTextActive
              ]}>
                {filterItem.label}
              </Text>
              {filterItem.count > 0 && (
                <View style={[
                  styles.filterTabBadge,
                  filter === filterItem.key && styles.filterTabBadgeActive
                ]}>
                  <Text style={[
                    styles.filterTabBadgeText,
                    filter === filterItem.key && styles.filterTabBadgeTextActive
                  ]}>
                    {filterItem.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderReportCard = (report) => {
    return (
      <View key={report.id} style={styles.reportCard}>
        {/* Header */}
        <View style={styles.reportHeader}>
          <View style={styles.reportHeaderLeft}>
            <Text style={styles.reportTitle}>{report.title}</Text>
            <Text style={styles.reportProtocol}>
              {report.protocol?.name} • Day {report.dayNumber}
            </Text>
          </View>
          
          <View style={styles.reportHeaderRight}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(report.status) }
            ]}>
              <Text style={styles.statusText}>
                {getStatusText(report.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Severity */}
        <View style={styles.severityContainer}>
          <View style={styles.severityInfo}>
            <Icon name="thermometer" size={16} color={getSeverityColor(report.severity)} />
            <Text style={[
              styles.severityText,
              { color: getSeverityColor(report.severity) }
            ]}>
              Severity: {report.severity}/10 ({getSeverityText(report.severity)})
            </Text>
          </View>
        </View>

        {/* Symptoms */}
        <View style={styles.symptomsContainer}>
          <Text style={styles.symptomsLabel}>Symptoms:</Text>
          <Text style={styles.symptomsText} numberOfLines={3}>
            {report.symptoms}
          </Text>
        </View>

        {/* Additional Info */}
        {report.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>Additional Notes:</Text>
            <Text style={styles.descriptionText} numberOfLines={2}>
              {report.description}
            </Text>
          </View>
        )}

        {/* Review Info */}
        {report.status === 'REVIEWED' && report.reviewer && (
          <View style={styles.reviewContainer}>
            <Icon name="check-circle" size={16} color="#10B981" />
            <Text style={styles.reviewText}>
              Reviewed by {report.reviewer.name} on {formatDate(report.reviewedAt)}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.reportFooter}>
          <View style={styles.reportDate}>
            <Icon name="clock" size={14} color="#6B7280" />
            <Text style={styles.reportDateText}>
              {formatDate(report.reportTime)}
            </Text>
          </View>
          
          {report.attachments && report.attachments.length > 0 && (
            <View style={styles.attachmentsInfo}>
              <Icon name="attachment" size={14} color="#6B7280" />
              <Text style={styles.attachmentsText}>
                {report.attachments.length} attachment{report.attachments.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
        <Text style={styles.loadingText}>Loading symptom reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Symptom Reports</Text>
          <Text style={styles.headerSubtitle}>
            {pagination.total} report{pagination.total !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* Content */}
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
        {reports.length > 0 ? (
          <View style={styles.reportsContainer}>
            {reports.map(renderReportCard)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="clipboard-text-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No symptom reports</Text>
            <Text style={styles.emptyText}>
              {filter === 'ALL' 
                ? 'You haven\'t submitted any symptom reports yet.'
                : `No ${filter.toLowerCase()} reports found.`
              }
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  filterTabs: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#0088FE',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterTabBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  filterTabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterTabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabBadgeTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  reportsContainer: {
    padding: 20,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  reportProtocol: {
    fontSize: 14,
    color: '#6B7280',
  },
  reportHeaderRight: {
    marginLeft: 12,
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
  severityContainer: {
    marginBottom: 12,
  },
  severityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  symptomsContainer: {
    marginBottom: 12,
  },
  symptomsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  symptomsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  reviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 6,
    flex: 1,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reportDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportDateText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  attachmentsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentsText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SymptomReportsScreen; 