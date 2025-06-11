import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { storeToken, removeToken, decodeToken, getToken } from '../utils/jwtUtils';
import { apiRequest } from './apiClient';
import { ENV } from '../config/environment';
import { createLogger } from '../utils/logUtils';
import { isConnected } from '../utils/connectivityUtils';

const logger = createLogger('AuthService');

// JWT Secret obtido das variáveis de ambiente
const JWT_SECRET = ENV.JWT_SECRET;

/**
 * Realiza login com email e senha
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<Object>} Objeto com token e dados do usuário
 */
export const login = async (email, password) => {
  try {
    logger.debug('Iniciando login', { email });
    
    // Login com API usando o endpoint correto da documentação
    const response = await apiRequest('/api/auth/mobile/login', {
      method: 'POST',
      body: {
        email,
        password
      }
    });
    
    if (response && response.token && response.user) {
      // Save token using jwtUtils to ensure consistency
      await storeToken(response.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      
      logger.info('Login successful', { userId: response.user.id });
      return response;
    } else {
      throw new Error('Invalid login response');
    }
  } catch (error) {
    logger.error('Login error', error);
    throw error;
  }
};

/**
 * Realiza registro de novo usuário
 * @param {Object} userData - Dados do usuário para registro
 * @returns {Promise<Object>} Objeto com token e dados do usuário
 */
export const register = async (userData) => {
  try {
    logger.debug('Iniciando registro', { email: userData.email });
    const response = await apiRequest('/api/auth/mobile/register', {
      method: 'POST',
      body: userData
    });
    
    if (response && response.token && response.user) {
      // Save token using jwtUtils to ensure consistency
      await storeToken(response.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      
      logger.info('Registration successful', { userId: response.user.id });
      return response;
    } else {
      throw new Error('Invalid registration response');
    }
  } catch (error) {
    logger.error('Registration error', error);
    throw error;
  }
};

/**
 * Valida token com o servidor
 * @param {string} token - Token JWT para validar
 * @returns {Promise<Object>} Dados do usuário se válido
 */
export const validateToken = async (token) => {
  try {
    logger.debug('Validando token com servidor');
    
    const response = await apiRequest('/api/auth/mobile/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response && response.valid) {
      logger.info('Token validated successfully');
      return response;
    } else {
      throw new Error('Invalid token');
    }
  } catch (error) {
    logger.error('Token validation error', error);
    throw error;
  }
};

// Verifica se o usuário está autenticado e redireciona se não estiver
export const checkAuth = async (navigation) => {
  try {
    console.log('Verificando autenticação...');
    const token = await getToken();
    
    if (!token) {
      console.log('Token não encontrado no AsyncStorage');
      if (navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
      return false;
    }

    // Verificar se o token está expirado
    try {
      const decoded = decodeToken(token);
      const currentTime = Date.now() / 1000;
      
      if (!decoded || decoded.exp < currentTime) {
        console.log('Token expirado, validando com servidor...');
        return await verifyTokenWithServer(token, navigation);
      }
      
      return true;
    } catch (decodeError) {
      console.error('Error decoding token:', decodeError);
      return false;
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

// Verifica a validade do token com o servidor
export const verifyTokenWithServer = async (token, navigation) => {
  try {
    console.log('Verificando token com o servidor...');
    
    // Usar o endpoint correto da documentação
    const response = await validateToken(token);
    
    if (response && response.valid) {
      console.log('Token validado pelo servidor');
      return true;
    }
    
    // Token inválido
    console.log('Token inválido');
    handleAuthFailure(navigation);
    return false;
  } catch (error) {
    console.error('Error verifying token with server:', error);
    
    // In case of network error, consider user authenticated locally
    if (error.message?.includes('Network') || error.message?.includes('timeout')) {
      console.log('Connection error, considering locally authenticated');
      return true;
    }
    
    return false;
  }
};

// Tenta renovar o token
export const refreshToken = async (oldToken, navigation) => {
  try {
    console.log('Tentando renovar o token...');
    
    // Por enquanto, vamos usar a validação do token
    // Se a API não tiver endpoint de refresh, podemos implementar depois
    const response = await validateToken(oldToken);
    
    if (response && response.valid) {
      console.log('Token ainda válido');
      return oldToken;
    }
    
    // Se não conseguir validar, remove o token
    console.log('Não foi possível renovar o token');
    handleAuthFailure(navigation);
    return null;
  } catch (error) {
    console.error('Error renewing token:', error);
    throw error;
  }
};

// Função para gerar um token JWT
export const generateJWT = (userData) => {
  try {
    // Esta função seria normalmente executada apenas no servidor
    // Aqui é apenas para testes/demonstração
    
    const payload = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 horas
    };
    
    // Esta implementação é simplificada e não segura para produção
    // Normalmente seria feita no servidor com uma biblioteca como jsonwebtoken
    const headerEncoded = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadEncoded = btoa(JSON.stringify(payload));
    const signature = btoa(JWT_SECRET.substring(0, 10)); // Simulação de assinatura
    
    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  } catch (error) {
    console.error('Error generating JWT:', error);
    throw error;
  }
};

// Função para tratar falha de autenticação
export const handleAuthFailure = (navigation) => {
  // Limpa dados de autenticação
  removeToken();
  
  // Alerta o usuário
  Alert.alert(
    'Sessão expirada',
    'Sua sessão expirou ou é inválida. Por favor, faça login novamente.',
    [
      {
        text: 'OK',
        onPress: () => {
          if (navigation) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      }
    ]
  );
}; 