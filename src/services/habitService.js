import apiClient from './apiClient';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('HabitService');

class HabitService {
  /**
   * Listar hábitos do usuário
   * @param {string} month - Mês para filtrar (formato ISO)
   * @returns {Promise<Array>} Lista de hábitos
   */
  async getHabits(month = null) {
    try {
      let url = '/api/mobile/habits';
      if (month) {
        url += `?month=${month}`;
      }
      
      logger.debug('Buscando hábitos', { month });
      const response = await apiClient.get(url);
      
      if (response.success && Array.isArray(response.habits)) {
        logger.info('Hábitos carregados com sucesso', { 
          total: response.total,
          habitsCount: response.habits.length 
        });
        return response.habits;
      } else {
        logger.warn('Resposta inválida da API de hábitos', { response });
        return [];
      }
    } catch (error) {
      logger.error('Erro ao carregar hábitos:', error);
      throw error;
    }
  }

  /**
   * Criar novo hábito
   * @param {Object} habitData - Dados do hábito
   * @param {string} habitData.title - Título do hábito
   * @param {string} habitData.category - Categoria (personal, health, work)
   * @returns {Promise<Object>} Hábito criado
   */
  async createHabit(habitData) {
    try {
      logger.debug('Criando hábito', habitData);
      
      const response = await apiClient.post('/api/mobile/habits', habitData);
      
      if (response.success && response.habit) {
        logger.info('Hábito criado com sucesso', { 
          habitId: response.habit.id,
          title: response.habit.title 
        });
        return response.habit;
      } else {
        logger.error('Erro na resposta da API ao criar hábito', response);
        throw new Error(response.error || 'Erro ao criar hábito');
      }
    } catch (error) {
      logger.error('Erro ao criar hábito:', error);
      throw error;
    }
  }

  /**
   * Atualizar hábito existente
   * @param {string} habitId - ID do hábito
   * @param {Object} habitData - Dados atualizados
   * @param {string} habitData.title - Novo título
   * @param {string} habitData.category - Nova categoria
   * @returns {Promise<Object>} Hábito atualizado
   */
  async updateHabit(habitId, habitData) {
    try {
      logger.debug('Atualizando hábito', { habitId, habitData });
      
      const response = await apiClient.put(`/api/mobile/habits/${habitId}`, habitData);
      
      if (response.success && response.habit) {
        logger.info('Hábito atualizado com sucesso', { 
          habitId: response.habit.id,
          title: response.habit.title 
        });
        return response.habit;
      } else {
        logger.error('Erro na resposta da API ao atualizar hábito', response);
        throw new Error(response.error || 'Erro ao atualizar hábito');
      }
    } catch (error) {
      logger.error('Erro ao atualizar hábito:', error);
      throw error;
    }
  }

  /**
   * Deletar hábito
   * @param {string} habitId - ID do hábito
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async deleteHabit(habitId) {
    try {
      logger.debug('Deletando hábito', { habitId });
      
      const response = await apiClient.delete(`/api/mobile/habits/${habitId}`);
      
      if (response.success) {
        logger.info('Hábito deletado com sucesso', { habitId });
        return true;
      } else {
        logger.error('Erro na resposta da API ao deletar hábito', response);
        throw new Error(response.error || 'Erro ao deletar hábito');
      }
    } catch (error) {
      logger.error('Erro ao deletar hábito:', error);
      throw error;
    }
  }

  /**
   * Atualizar progresso do hábito (marcar/desmarcar)
   * @param {string} habitId - ID do hábito
   * @param {string} date - Data no formato YYYY-MM-DD
   * @returns {Promise<Object>} Resultado da operação
   */
  async updateProgress(habitId, date) {
    try {
      logger.debug('Atualizando progresso do hábito', { habitId, date });
      
      const response = await apiClient.post('/api/mobile/habits/progress', {
        habitId,
        date
      });
      
      if (response.success) {
        logger.info('Progresso atualizado com sucesso', { 
          habitId,
          date,
          isChecked: response.isChecked,
          isUpdate: response.isUpdate 
        });
        return response;
      } else {
        logger.error('Erro na resposta da API ao atualizar progresso', response);
        throw new Error(response.error || 'Erro ao atualizar progresso');
      }
    } catch (error) {
      logger.error('Erro ao atualizar progresso:', error);
      throw error;
    }
  }

  /**
   * Verificar se um hábito foi completado em uma data específica
   * @param {Array} progress - Array de progresso do hábito
   * @param {string} date - Data no formato YYYY-MM-DD
   * @returns {boolean} Se o hábito foi completado
   */
  isHabitCompletedOnDate(progress, date) {
    if (!progress || !Array.isArray(progress)) return false;
    
    const dayProgress = progress.find(p => p.date === date);
    return dayProgress ? dayProgress.isChecked : false;
  }

  /**
   * Calcular estatísticas dos hábitos
   * @param {Array} habits - Lista de hábitos
   * @param {string} date - Data para calcular (padrão: hoje)
   * @returns {Object} Estatísticas
   */
  calculateStats(habits, date = null) {
    if (!habits || !Array.isArray(habits)) {
      return { total: 0, completed: 0, completionRate: 0 };
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const total = habits.length;
    const completed = habits.filter(habit => 
      this.isHabitCompletedOnDate(habit.progress, targetDate)
    ).length;
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, completionRate };
  }
}

export default new HabitService(); 