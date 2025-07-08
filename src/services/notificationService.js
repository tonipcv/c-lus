// Modular Firebase imports
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken as getFCMTokenModular,
  requestPermission as requestPermissionModular,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logUtils';
import apiClient from './apiClient';

const logger = createLogger('NotificationService');

// Configurar como as notificações devem ser apresentadas
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  constructor() {
    this.fcmToken = null;
    this.isInitialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo inicial
    this.messaging = getMessaging(getApp());
    logger.debug('NotificationService construído');
  }

  // Inicializar o serviço de notificações
  async initialize() {
    try {
      logger.debug('Inicializando serviço de notificações');
      
      // Solicitar permissões
      await this.requestPermissions();
      
      // Obter token FCM
      await this.getFCMToken();
      
      // Configurar listeners
      this.setupNotificationListeners();
      
      this.isInitialized = true;
      logger.info('Serviço de notificações inicializado com sucesso');
      
      return true;
    } catch (error) {
      logger.error('Erro ao inicializar serviço de notificações', error);
      return false;
    }
  }

  // Solicitar permissões de notificação
  async requestPermissions() {
    try {
      logger.debug('Solicitando permissões de notificação');
      
      if (Platform.OS === 'ios') {
        const settings = await requestPermissionModular(this.messaging);
        const enabled =
          settings === 1 || // AUTHORIZED
          settings === 2;   // PROVISIONAL

        if (!enabled) {
          throw new Error('Permissão de notificação negada');
        }

        // Registrar para remote messages (necessário no iOS antes de obter token)
        await this.messaging.registerDeviceForRemoteMessages();
      }

      // Também solicitar permissões do Expo Notifications
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        throw new Error('Permissão de notificação negada pelo Expo');
      }

      logger.info('Permissões de notificação concedidas');
      return true;
    } catch (error) {
      logger.error('Erro ao solicitar permissões', error);
      Alert.alert(
        'Permissões Necessárias',
        'Para receber notificações importantes sobre sua saúde, é necessário permitir notificações.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  }

  // Obter token FCM com retry
  async getFCMToken() {
    try {
      logger.debug('Iniciando obtenção do token FCM');
      
      // Verificar se já temos um token armazenado
      const storedToken = await AsyncStorage.getItem('fcm_token');
      logger.debug('Token FCM armazenado:', { storedToken: storedToken ? `${storedToken.substring(0, 20)}...` : 'null' });
      
      // Obter token atual do Firebase com retry
      const currentToken = await this.retryOperation(async () => {
        logger.debug('Solicitando novo token FCM do Firebase');
        const token = await getFCMTokenModular(this.messaging);
        if (!token) throw new Error('Não foi possível obter o token FCM');
        logger.debug('Token FCM obtido do Firebase:', { token: `${token.substring(0, 20)}...` });
        return token;
      });

      // Se o token mudou, atualizar
      if (storedToken !== currentToken) {
        logger.debug('Token FCM mudou, atualizando storage');
        await AsyncStorage.setItem('fcm_token', currentToken);
        logger.info('Token FCM atualizado no storage:', { token: `${currentToken.substring(0, 20)}...` });
      }

      this.fcmToken = currentToken;
      logger.debug('Token FCM final definido na instância:', { token: `${this.fcmToken.substring(0, 20)}...` });
      return currentToken;
    } catch (error) {
      logger.error('Erro ao obter token FCM', error);
      throw error;
    }
  }

  // Função de retry para operações que podem falhar
  async retryOperation(operation) {
    let lastError;
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i === this.maxRetries) break;
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  // Configurar listeners de notificação
  setupNotificationListeners() {
    logger.debug('Configurando listeners de notificação');

    // Listener para quando o token é atualizado
    onTokenRefresh(this.messaging, async (token) => {
      logger.info('Token FCM atualizado', { token: token.substring(0, 20) + '...' });
      this.fcmToken = token;
      await AsyncStorage.setItem('fcm_token', token);
      
      // Re-registrar o dispositivo com o novo token
      await this.registerDeviceToken();
    });

    // Listener para mensagens em foreground
    onMessage(this.messaging, async (remoteMessage) => {
      logger.info('Mensagem recebida em foreground', remoteMessage);
      
      // Mostrar notificação local quando o app está em foreground
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'Nova notificação',
          body: remoteMessage.notification?.body || 'Você tem uma nova mensagem',
          data: remoteMessage.data || {},
        },
        trigger: null, // Mostrar imediatamente
      });
    });

    // Listener para quando o app é aberto através de uma notificação
    onNotificationOpenedApp(this.messaging, (remoteMessage) => {
      logger.info('App aberto através de notificação', remoteMessage);
      this.handleNotificationPress(remoteMessage);
    });

    // Verificar se o app foi aberto através de uma notificação (app estava fechado)
    getInitialNotification(this.messaging)
      .then((remoteMessage) => {
        if (remoteMessage) {
          logger.info('App iniciado através de notificação', remoteMessage);
          this.handleNotificationPress(remoteMessage);
        }
      });

    // Listeners do Expo Notifications
    Notifications.addNotificationReceivedListener((notification) => {
      logger.debug('Notificação recebida (Expo)', notification);
    });

    Notifications.addNotificationResponseReceivedListener((response) => {
      logger.debug('Resposta de notificação recebida (Expo)', response);
      this.handleNotificationPress(response.notification.request.content);
    });
  }

  // Lidar com o toque na notificação
  handleNotificationPress(notificationData) {
    logger.debug('Processando toque na notificação', notificationData);
    
    // Aqui você pode implementar navegação baseada no tipo de notificação
    const { data } = notificationData;
    
    if (data?.screen) {
      // Navegar para uma tela específica
      logger.info('Navegando para tela:', data.screen);
      // Implementar navegação aqui se necessário
    }
  }

  // Registrar token do dispositivo no servidor com retry e exponential backoff
  async registerDeviceToken(userId = null, email = null) {
    return this.retryOperation(async () => {
      logger.debug('Iniciando registro do dispositivo');
      
      if (!this.fcmToken) {
        logger.debug('Token FCM não encontrado na instância, obtendo novo token');
        await this.getFCMToken();
      }

      if (!this.fcmToken) {
        logger.error('Token FCM ainda não disponível após tentativa de obtenção');
        throw new Error('Token FCM não disponível');
      }

      logger.debug('Preparando dados para registro do dispositivo', {
        fcmToken: `${this.fcmToken.substring(0, 20)}...`,
        userId,
        email,
        platform: Platform.OS
      });

      const url = 'https://aa-ios-notify-cxlus.dpbdp1.easypanel.host/register-device';
      
      const requestData = {
        deviceToken: this.fcmToken,
        platform: Platform.OS,
        userId: userId || null,
        email: email || null
      };

      logger.debug('Enviando requisição de registro', { 
        url,
        deviceToken: `${requestData.deviceToken.substring(0, 20)}...`,
        platform: requestData.platform,
        userId: requestData.userId,
        email: requestData.email
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        logger.error('Erro na resposta do servidor:', { status: response.status });
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      logger.info('Token registrado com sucesso no servidor', {
        result,
        sentToken: `${this.fcmToken.substring(0, 20)}...`
      });

      await AsyncStorage.setItem('device_registered', 'true');
      await AsyncStorage.setItem('registration_data', JSON.stringify({
        userId,
        email,
        registeredAt: new Date().toISOString(),
      }));

      return result;
    });
  }

  // Verificar se o dispositivo está registrado
  async isDeviceRegistered() {
    try {
      const registered = await AsyncStorage.getItem('device_registered');
      return registered === 'true';
    } catch (error) {
      logger.error('Erro ao verificar registro do dispositivo', error);
      return false;
    }
  }

  // Obter token atual
  getCurrentToken() {
    return this.fcmToken;
  }

  // Limpar dados de registro (usado no logout)
  async clearRegistrationData() {
    try {
      logger.debug('Limpando dados de registro');
      await AsyncStorage.removeItem('device_registered');
      await AsyncStorage.removeItem('registration_data');
      await AsyncStorage.removeItem('fcm_token');
      this.fcmToken = null;
      logger.info('Dados de registro limpos');
    } catch (error) {
      logger.error('Erro ao limpar dados de registro', error);
    }
  }

  // Agendar notificação local (para testes)
  async scheduleLocalNotification(title, body, data = {}, seconds = 1) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: { seconds },
      });
      logger.info('Notificação local agendada');
    } catch (error) {
      logger.error('Erro ao agendar notificação local', error);
    }
  }

  // Cancelar todas as notificações pendentes
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      logger.info('Todas as notificações canceladas');
    } catch (error) {
      logger.error('Erro ao cancelar notificações', error);
    }
  }

  // Obter estatísticas de notificação
  async getNotificationStats() {
    try {
      const registrationData = await AsyncStorage.getItem('registration_data');
      const isRegistered = await this.isDeviceRegistered();
      
      return {
        isInitialized: this.isInitialized,
        isRegistered,
        hasToken: !!this.fcmToken,
        tokenPreview: this.fcmToken ? this.fcmToken.substring(0, 20) + '...' : null,
        registrationData: registrationData ? JSON.parse(registrationData) : null,
        platform: Platform.OS,
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas', error);
      return null;
    }
  }
}

// Criar instância singleton
const notificationService = new NotificationService();

export default notificationService; 