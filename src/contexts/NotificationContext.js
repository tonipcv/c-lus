import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('NotificationContext');

// Criar o contexto
const NotificationContext = createContext(null);

// Hook personalizado para usar o contexto
export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [notificationStats, setNotificationStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const maxRetries = 3;

  const { user, isAuthenticated } = useAuth();

  // Função de delay com backoff exponencial
  const getRetryDelay = (attempt) => {
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 segundos
  };

  // Inicializar serviço de notificações
  const initializeNotifications = useCallback(async () => {
    try {
      logger.debug('Inicializando contexto de notificações');
      setLoading(true);
      setError(null);

      const success = await notificationService.initialize();
      
      if (success) {
        setIsInitialized(true);
        const token = notificationService.getCurrentToken();
        setFcmToken(token);
        
        // Verificar se já está registrado
        const registered = await notificationService.isDeviceRegistered();
        setIsRegistered(registered);
        
        // Atualizar estatísticas
        await updateNotificationStats();
        
        logger.info('Contexto de notificações inicializado com sucesso');
        setRetryAttempt(0); // Resetar tentativas após sucesso
      } else {
        throw new Error('Falha ao inicializar serviço de notificações');
      }
    } catch (error) {
      logger.error('Erro ao inicializar contexto de notificações', error);
      setError(error.message);
      setIsInitialized(false);

      // Tentar novamente se não excedeu o limite
      if (retryAttempt < maxRetries) {
        const delay = getRetryDelay(retryAttempt);
        logger.info(`Tentando novamente em ${delay}ms (tentativa ${retryAttempt + 1})`);
        setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
          initializeNotifications();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [retryAttempt]);

  // Registrar dispositivo no servidor
  const registerDevice = useCallback(async (forceRegister = false) => {
    try {
      if (!isInitialized) {
        throw new Error('Serviço de notificações não inicializado');
      }

      if (isRegistered && !forceRegister) {
        logger.debug('Dispositivo já registrado, pulando registro');
        return true;
      }

      logger.debug('Registrando dispositivo no servidor');
      logger.debug('Estado do usuário no momento do registro:', { 
        hasUser: !!user,
        userData: user ? {
          id: user.id || user.userId || user._id,
          email: user.email,
          // outros campos relevantes
        } : 'null'
      });
      setError(null);

      // Extrair dados do usuário
      let userId = null;
      let email = null;

      if (user) {
        userId = user.id || user.userId || user._id;
        email = user.email;
        logger.debug('Dados extraídos do usuário:', { userId, email });
      } else {
        logger.warn('Tentando registrar dispositivo sem dados do usuário');
      }

      const result = await notificationService.registerDeviceToken(userId, email);
      
      setIsRegistered(true);
      await updateNotificationStats();
      setRetryAttempt(0); // Resetar tentativas após sucesso
      
      logger.info('Dispositivo registrado com sucesso', result);
      return true;
    } catch (error) {
      logger.error('Erro ao registrar dispositivo', error);
      setError(error.message);

      // Tentar novamente se não excedeu o limite
      if (retryAttempt < maxRetries) {
        const delay = getRetryDelay(retryAttempt);
        logger.info(`Tentando registrar novamente em ${delay}ms (tentativa ${retryAttempt + 1})`);
        setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
          registerDevice(forceRegister);
        }, delay);
      }
      return false;
    }
  }, [isInitialized, isRegistered, user, retryAttempt]);

  // Atualizar estatísticas de notificação
  const updateNotificationStats = useCallback(async () => {
    try {
      const stats = await notificationService.getNotificationStats();
      setNotificationStats(stats);
      return stats;
    } catch (error) {
      logger.error('Erro ao atualizar estatísticas', error);
      return null;
    }
  }, []);

  // Limpar dados de notificação (usado no logout)
  const clearNotificationData = useCallback(async () => {
    try {
      logger.debug('Limpando dados de notificação');
      await notificationService.clearRegistrationData();
      setIsRegistered(false);
      setFcmToken(null);
      await updateNotificationStats();
      logger.info('Dados de notificação limpos');
    } catch (error) {
      logger.error('Erro ao limpar dados de notificação', error);
    }
  }, [updateNotificationStats]);

  // Agendar notificação de teste
  const scheduleTestNotification = useCallback(async (title = 'Teste', body = 'Esta é uma notificação de teste') => {
    try {
      if (!isInitialized) {
        throw new Error('Serviço de notificações não inicializado');
      }

      await notificationService.scheduleLocalNotification(title, body, { test: true }, 2);
      Alert.alert('Sucesso', 'Notificação de teste agendada para 2 segundos');
      return true;
    } catch (error) {
      logger.error('Erro ao agendar notificação de teste', error);
      Alert.alert('Erro', 'Não foi possível agendar a notificação de teste');
      return false;
    }
  }, [isInitialized]);

  // Cancelar todas as notificações
  const cancelAllNotifications = useCallback(async () => {
    try {
      await notificationService.cancelAllNotifications();
      Alert.alert('Sucesso', 'Todas as notificações foram canceladas');
      return true;
    } catch (error) {
      logger.error('Erro ao cancelar notificações', error);
      Alert.alert('Erro', 'Não foi possível cancelar as notificações');
      return false;
    }
  }, []);

  // Reinicializar serviço
  const reinitialize = useCallback(async () => {
    logger.debug('Reinicializando serviço de notificações');
    await initializeNotifications();
  }, [initializeNotifications]);

  // Inicializar quando o usuário autenticar
  useEffect(() => {
    if (isAuthenticated) {
      logger.debug('Usuário autenticado, iniciando notificações', {
        isAuthenticated,
        hasUser: !!user,
        userEmail: user?.email
      });
      initializeNotifications();
    }
  }, [isAuthenticated, initializeNotifications]);

  // Registrar dispositivo quando o usuário faz login
  useEffect(() => {
    if (isAuthenticated && isInitialized && !isRegistered && user?.email) {
      logger.debug('Condições para registro do dispositivo:', {
        isAuthenticated,
        isInitialized,
        isRegistered,
        hasUser: !!user,
        userEmail: user?.email
      });
      logger.debug('Usuário autenticado, registrando dispositivo automaticamente');
      registerDevice();
    }
  }, [isAuthenticated, isInitialized, isRegistered, registerDevice, user]);

  // Limpar dados quando o usuário faz logout
  useEffect(() => {
    if (!isAuthenticated && isRegistered) {
      logger.debug('Usuário deslogado, limpando dados de notificação');
      clearNotificationData();
    }
  }, [isAuthenticated, isRegistered, clearNotificationData]);

  // Monitorar mudanças no estado do app
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && isInitialized) {
        // App voltou ao foreground, atualizar estatísticas
        updateNotificationStats();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isInitialized, updateNotificationStats]);

  // Valor do contexto
  const value = {
    // Estados
    isInitialized,
    isRegistered,
    fcmToken,
    notificationStats,
    loading,
    error,

    // Ações
    registerDevice,
    clearNotificationData,
    scheduleTestNotification,
    cancelAllNotifications,
    updateNotificationStats,
    reinitialize,

    // Informações úteis
    hasPermissions: isInitialized,
    canReceiveNotifications: isInitialized && isRegistered,
    tokenPreview: fcmToken ? fcmToken.substring(0, 20) + '...' : null,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 