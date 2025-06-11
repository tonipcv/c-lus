import { getToken, getAuthHeaders, isTokenValid, isTokenExpiringSoon } from '../utils/jwtUtils';
import { ENV } from '../config/environment';
import { handleApiError, showErrorAlert } from '../utils/errorHandler';
import { isConnected } from '../utils/connectivityUtils';
import { createLogger } from '../utils/logUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('ApiClient');

const BASE_URL = 'https://app.cxlus.com/api';

// Fila de requisições pendentes durante renovação de token
let isRefreshing = false;
let failedRequestsQueue = [];

// Processar fila de requisições após renovação de token
const processQueue = (error, token = null) => {
  logger.debug(`Processando fila de requisições: ${failedRequestsQueue.length} pendentes`);
  
  failedRequestsQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  
  failedRequestsQueue = [];
};

// Cliente HTTP básico com tratamento de erros
export const apiRequest = async (endpoint, options = {}) => {
  try {
    // Verifica a conectividade
    const connected = await isConnected();
    if (!connected) {
      logger.warn(`Tentativa de requisição sem conexão: ${endpoint}`);
      throw new Error('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
    }
    
    // Para endpoints de autenticação, não verificar token
    const isAuthEndpoint = endpoint.includes('/auth/');
    
    // Verificar se o token está válido apenas para endpoints que não são de autenticação
    if (!isAuthEndpoint) {
      const tokenValid = await isTokenValid();
      
      if (!tokenValid) {
        logger.debug('Token inválido, redirecionando para login');
        throw new Error('Sessão expirada');
      }
    }
    
    // Obtém os headers de autenticação (apenas se não for endpoint de auth)
    const authHeaders = isAuthEndpoint ? {} : await getAuthHeaders();
    
    // Configura headers padrão
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...authHeaders
    };
    
    // Combina headers
    const requestHeaders = {
      ...defaultHeaders,
      ...options.headers
    };
    
    // Prepara dados da requisição para logging
    const requestData = {
      method: options.method || 'GET',
      endpoint,
      url: `${ENV.API_URL}${endpoint}`,
      hasAuthHeader: !!authHeaders['Authorization']
    };
    
    logger.debug('Enviando requisição', requestData);
    
    // Prepara o corpo da requisição
    let requestOptions = {
      ...options,
      headers: requestHeaders
    };
    
    // Se é uma requisição POST, PUT ou PATCH, garante que o Content-Type está correto
    if (['POST', 'PUT', 'PATCH'].includes(requestOptions.method) && requestOptions.body) {
      if (typeof requestOptions.body === 'object' && !(requestOptions.body instanceof FormData)) {
        requestOptions.body = JSON.stringify(requestOptions.body);
      }
    }
    
    // Faz a requisição
    logger.debug(`Requisição: ${ENV.API_URL}${endpoint}`, { method: requestOptions.method });
    const response = await fetch(`${ENV.API_URL}${endpoint}`, requestOptions);
    logger.debug(`Resposta recebida: ${response.status}`);
    
    // Verifica o tipo de conteúdo
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      logger.debug('Resposta JSON recebida', { status: response.status });
    } else {
      const textResponse = await response.text();
      logger.debug('Resposta texto recebida', { status: response.status, length: textResponse.length });
      
      if (!response.ok) {
        throw {
          response: {
            status: response.status,
            data: { message: textResponse }
          }
        };
      }
      
      return textResponse;
    }
    
    // Trata erros na resposta
    if (!response.ok) {
      logger.warn(`Erro na resposta: ${response.status}`, data);
      throw {
        response: {
          status: response.status,
          data
        }
      };
    }
    
    logger.debug(`Requisição bem-sucedida: ${endpoint}`);
    return data;
  } catch (error) {
    // Tratar o erro usando o utilitário global
    const processedError = await handleApiError(error);
    logger.error(`Erro na requisição: ${endpoint}`, processedError);
    throw processedError;
  }
};

// Métodos HTTP padronizados
export const apiClient = {
  get: (endpoint, params = {}, options = {}) => {
    const url = new URL(`${ENV.API_URL}${endpoint}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return apiRequest(url.pathname + url.search, {
      method: 'GET',
      ...options
    });
  },
  
  post: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: data, // Não serializar aqui, será feito no apiRequest
      ...options
    });
  },
  
  put: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: data, // Não serializar aqui, será feito no apiRequest
      ...options
    });
  },
  
  patch: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      method: 'PATCH',
      body: data, // Não serializar aqui, será feito no apiRequest
      ...options
    });
  },
  
  delete: (endpoint, options = {}) => {
    return apiRequest(endpoint, {
      method: 'DELETE',
      ...options
    });
  }
};

export default apiClient; 