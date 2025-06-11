import apiClient from './apiClient';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('SymptomReportsService');

class SymptomReportsService {
  // Buscar relatórios de sintomas com paginação
  async getSymptomReports(params = {}) {
    try {
      const { limit = 20, offset = 0, protocolId, status } = params;
      
      const queryParams = {
        limit,
        offset,
        ...(protocolId && { protocolId }),
        ...(status && { status })
      };
      
      logger.debug('Buscando relatórios de sintomas', queryParams);
      const response = await apiClient.get('/api/mobile/symptom-reports', queryParams);
      
      logger.info('Relatórios de sintomas carregados', { 
        total: response.pagination?.total || 0,
        count: response.reports?.length || 0 
      });
      
      return response;
    } catch (error) {
      logger.error('Erro ao buscar relatórios de sintomas:', error);
      throw error;
    }
  }

  // Criar novo relatório de sintomas
  async createSymptomReport(reportData) {
    try {
      const {
        protocolId,
        dayNumber,
        title = 'Symptom Report',
        description,
        symptoms,
        severity,
        isNow = true,
        reportTime
      } = reportData;

      // Validações básicas
      if (!protocolId) {
        throw new Error('Protocol ID is required');
      }
      if (!symptoms || symptoms.trim() === '') {
        throw new Error('Symptoms description is required');
      }
      if (severity < 1 || severity > 10) {
        throw new Error('Severity must be between 1 and 10');
      }

      const requestData = {
        protocolId,
        dayNumber,
        title,
        symptoms: symptoms.trim(),
        severity,
        isNow,
        ...(description && { description }),
        ...(reportTime && { reportTime })
      };

      logger.debug('Criando relatório de sintomas', { 
        protocolId, 
        dayNumber, 
        severity,
        symptomsLength: symptoms.length 
      });
      
      const response = await apiClient.post('/api/mobile/symptom-reports', requestData);
      
      logger.info('Relatório de sintomas criado com sucesso', { 
        reportId: response.report?.id 
      });
      
      return response;
    } catch (error) {
      logger.error('Erro ao criar relatório de sintomas:', error);
      throw error;
    }
  }

  // Buscar relatórios por protocolo específico
  async getReportsByProtocol(protocolId, params = {}) {
    try {
      return await this.getSymptomReports({
        ...params,
        protocolId
      });
    } catch (error) {
      logger.error('Erro ao buscar relatórios por protocolo:', error);
      throw error;
    }
  }

  // Buscar relatórios pendentes
  async getPendingReports(params = {}) {
    try {
      return await this.getSymptomReports({
        ...params,
        status: 'PENDING'
      });
    } catch (error) {
      logger.error('Erro ao buscar relatórios pendentes:', error);
      throw error;
    }
  }

  // Buscar relatórios revisados
  async getReviewedReports(params = {}) {
    try {
      return await this.getSymptomReports({
        ...params,
        status: 'REVIEWED'
      });
    } catch (error) {
      logger.error('Erro ao buscar relatórios revisados:', error);
      throw error;
    }
  }
}

export default new SymptomReportsService(); 