import apiClient from './apiClient';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('DailyCheckinService');

class DailyCheckinService {
  // Buscar perguntas e status do check-in
  async getCheckinData(protocolId, date = null) {
    try {
      const dateParam = date ? `&date=${date}` : '';
      const url = `/api/mobile/daily-checkin?protocolId=${protocolId}${dateParam}`;
      
      logger.debug('Buscando dados do check-in', { protocolId, date });
      const response = await apiClient.get(url);
      
      logger.info('Dados do check-in carregados', { 
        questionsCount: response.questions?.length || 0,
        hasCheckinToday: response.hasCheckinToday 
      });
      
      return response;
    } catch (error) {
      logger.error('Erro ao buscar dados do check-in:', error);
      throw error;
    }
  }

  // Submeter respostas do check-in
  async submitCheckin(protocolId, responses) {
    try {
      logger.debug('Submetendo check-in', { protocolId, responsesCount: responses.length });
      
      const response = await apiClient.post('/api/mobile/daily-checkin', {
        protocolId,
        responses
      });
      
      logger.info('Check-in submetido com sucesso');
      return response;
    } catch (error) {
      logger.error('Erro ao submeter check-in:', error);
      throw error;
    }
  }
}

export default new DailyCheckinService(); 