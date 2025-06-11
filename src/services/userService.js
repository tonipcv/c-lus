import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('UserService');

// Serviço para manipulação do perfil do usuário
const userService = {
  // Obter perfil do usuário (Método principal, usado pelo AuthContext)
  getUserProfile: async () => {
    try {
      logger.debug('Buscando perfil do usuário');
      const response = await apiClient.get('/api/user/profile');
      
      if (response && response.user) {
        // Cache user data
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        logger.info('User profile obtained successfully');
        
        return response.user;
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching user profile', error);
      
      // Try to get cached data in case of error
      try {
        const cachedData = await AsyncStorage.getItem('userData');
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      } catch (cacheError) {
        logger.error('Error retrieving user data from cache', cacheError);
      }
      
      throw error;
    }
  },
  
  // Obter perfil do usuário (Método legado/alternativo)
  getProfile: async () => {
    try {
      logger.debug('Usando getProfile (legado)');
      // Redirecionar para o método principal
      return await userService.getUserProfile();
    } catch (error) {
      logger.error('Error in getProfile', error);
      throw error;
    }
  },
  
  // Atualizar perfil do usuário
  updateProfile: async (data) => {
    try {
      const response = await apiClient.put('/api/patient/profile', data);
      
      // Atualiza os dados do usuário no AsyncStorage
      if (response && response.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },
  
  // Atualizar senha do usuário
  updatePassword: async (currentPassword, newPassword) => {
    try {
      return await apiClient.put('/api/patient/profile', {
        currentPassword,
        newPassword
      });
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  },
  
  // Obter protocolos atribuídos ao paciente
  getProtocols: async () => {
    try {
      logger.debug('Buscando protocolos do paciente');
      const response = await apiClient.get('/api/protocols/assignments');
      if (response && response.assignments) {
        logger.info('Protocols obtained successfully');
        return response.assignments;
      }
    } catch (error) {
      logger.error('Error fetching protocols:', error);
      throw error;
    }
  },
  
  // Obter dados de resumo do usuário (dashboard simplificado)
  getUserSummary: async () => {
    try {
      return await apiClient.get('/api/patient/summary');
    } catch (error) {
      console.error('Error fetching user summary:', error);
      throw error;
    }
  }
};

// Exportar métodos individuais para compatibilidade
export const getUserProfile = userService.getUserProfile;
export const getProfile = userService.getProfile;
export const updateProfile = userService.updateProfile;
export const updatePassword = userService.updatePassword;
export const getProtocols = userService.getProtocols;
export const getUserSummary = userService.getUserSummary;

export default userService; 