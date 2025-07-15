/**
 * Sistema de tratamento global de erros
 */
import { Alert } from 'react-native';
import { createLogger } from './logUtils';
import { isConnected } from './connectivityUtils';

const logger = createLogger('ErrorHandler');

// Erro personalizado para erros de API
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Erro personalizado para erros de rede
export class NetworkError extends Error {
  constructor(message, originalError = null) {
    super(message || 'Erro de conexão com o servidor');
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

// Erro personalizado para erros de autenticação
export class AuthError extends Error {
  constructor(message, originalError = null) {
    super(message || 'Erro de autenticação');
    this.name = 'AuthError';
    this.originalError = originalError;
  }
}

// Mapeamento de códigos HTTP para mensagens amigáveis
const HTTP_ERROR_MESSAGES = {
  400: 'Solicitação inválida',
  401: 'Não autorizado',
  403: 'Acesso negado',
  404: 'Recurso não encontrado',
  408: 'Tempo de conexão esgotado',
  500: 'Erro interno do servidor',
  502: 'Erro de gateway',
  503: 'Serviço indisponível',
  504: 'Tempo limite do gateway'
};

/**
 * Captura e processa erros de API
 * @param {Error} error - O erro a ser processado
 * @returns {Error} O erro processado
 */
export const handleApiError = async (error) => {
  // Se já é um AuthError, retorne-o diretamente
  if (error instanceof AuthError) {
    logger.warn('Erro de autenticação detectado', error);
    return error;
  }

  if (!error.response) {
    // Verificar se é um problema de conectividade
    const connected = await isConnected();
    if (!connected) {
      logger.warn('Erro de API sem resposta - Problema de conexão detectado');
      return new NetworkError('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
    }
    
    logger.error('Erro de API sem resposta', error);
    return new NetworkError('Não foi possível se comunicar com o servidor. Tente novamente mais tarde.');
  }

  const { status, data } = error.response;
  
  let message = HTTP_ERROR_MESSAGES[status] || 'Ocorreu um erro inesperado';
  
  // Se o servidor retornou uma mensagem, use-a
  if (data && data.message) {
    message = data.message;
  }
  
  if (status === 401) {
    // Erro de autenticação
    logger.warn('Erro de autenticação na API', { status, data });
    return new AuthError(message, error);
  }
  
  logger.error('Erro de API', { status, message, data });
  return new ApiError(message, status, data);
};

/**
 * Exibe um alerta para o usuário baseado no erro
 * @param {Error} error - O erro a ser exibido
 * @param {string} fallbackTitle - Título padrão para o alerta
 */
export const showErrorAlert = (error, fallbackTitle = 'Erro') => {
  let title = fallbackTitle;
  let message = error.message || 'Ocorreu um erro inesperado';
  
  // Personalizar alerta baseado no tipo de erro
  if (error instanceof NetworkError) {
    title = 'Erro de Conexão';
  } else if (error instanceof AuthError) {
    title = 'Erro de Autenticação';
  } else if (error instanceof ApiError) {
    title = `Erro ${error.status || ''}`;
  }
  
  logger.debug('Exibindo alerta de erro', { title, message });
  Alert.alert(title, message);
};

/**
 * Função global para capturar erros não tratados
 */
export const setupGlobalErrorHandler = () => {
  // Capturar erros não tratados em promises
  const originalHandler = global.ErrorUtils.getGlobalHandler();
  
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    logger.error('Erro global não tratado', { error, isFatal });
    
    // Aqui você poderia enviar o erro para um serviço como Sentry
    
    // Chamar o manipulador original
    originalHandler(error, isFatal);
  });
  
  // Capturar rejeições de promise não tratadas
  global.Promise = class ExtendedPromise extends Promise {
    constructor(executor) {
      super((resolve, reject) => {
        return executor(
          resolve,
          (error) => {
            logger.error('Promise rejeitada não tratada', error);
            // Aqui você poderia enviar o erro para um serviço como Sentry
            reject(error);
          }
        );
      });
    }
  };
};

export default {
  handleApiError,
  showErrorAlert,
  setupGlobalErrorHandler,
  ApiError,
  NetworkError,
  AuthError
}; 