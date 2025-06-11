import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { createLogger } from './logUtils';
import { ENV } from '../config/environment';

const logger = createLogger('JwtUtils');

// Chave consistente para armazenar o token
const TOKEN_STORAGE_KEY = 'token';

// JWT Secret das variáveis de ambiente
const JWT_SECRET = ENV.JWT_SECRET;

// Armazenar token JWT
export const storeToken = async (token) => {
  try {
    logger.debug('Armazenando token');
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    return true;
  } catch (error) {
    logger.error('Erro ao armazenar token:', error);
    return false;
  }
};

// Obter token JWT
export const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    return token;
  } catch (error) {
    logger.error('Erro ao buscar token:', error);
    return null;
  }
};

// Remover token (logout)
export const removeToken = async () => {
  try {
    logger.debug('Removendo token');
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem('user_data');
    return true;
  } catch (error) {
    logger.error('Erro ao remover token:', error);
    return false;
  }
};

// Decodificar token JWT
export const decodeToken = (token) => {
  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('Erro ao decodificar token:', error);
    return null;
  }
};

// Verificar se o token é válido (não expirado)
export const isTokenValid = async () => {
  try {
    const token = await getToken();
    if (!token) return false;
    
    const decoded = decodeToken(token);
    if (!decoded) return false;
    
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Erro ao verificar validade do token:', error);
    return false;
  }
};

// Verificar se o token vai expirar em breve (30 minutos)
export const isTokenExpiringSoon = async () => {
  try {
    const token = await getToken();
    if (!token) return false;
    
    const decoded = decodeToken(token);
    if (!decoded) return false;
    
    const currentTime = Date.now() / 1000;
    const expiresInSeconds = decoded.exp - currentTime;
    
    // Retorna true se o token expira em menos de 30 minutos
    return expiresInSeconds > 0 && expiresInSeconds < 1800;
  } catch (error) {
    console.error('Erro ao verificar expiração do token:', error);
    return false;
  }
};

// Obter headers padrão com autorização JWT
export const getAuthHeaders = async () => {
  try {
    const token = await getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'X-JWT-Secret': JWT_SECRET
    };
  } catch (error) {
    logger.error('Erro ao obter headers de autenticação:', error);
    return {
      'Content-Type': 'application/json'
    };
  }
}; 