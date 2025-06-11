import { isTokenExpiringSoon, getToken } from '../utils/jwtUtils';
import { refreshToken } from './authService';
import { API_URL } from '@env';

// Intervalo para verificar a expiração do token em milissegundos (a cada 5 minutos)
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000;

let tokenRefreshInterval = null;

/**
 * Inicia o monitoramento do token para renovação proativa
 */
export const startTokenRefreshMonitoring = () => {
  // Limpar qualquer intervalo existente
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  // Iniciar um novo intervalo
  tokenRefreshInterval = setInterval(async () => {
    try {
      // Verificar se o token vai expirar em breve
      const isExpiringSoon = await isTokenExpiringSoon();
      
      if (isExpiringSoon) {
        console.log('Token expirando em breve, iniciando renovação proativa');
        const currentToken = await getToken();
        
        if (currentToken) {
          const newToken = await refreshToken(currentToken);
          if (newToken) {
            console.log('Token renovado proativamente');
          } else {
            console.error('Falha na renovação proativa do token');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar expiração do token:', error);
    }
  }, TOKEN_CHECK_INTERVAL);
  
  console.log('Monitoramento de renovação de token iniciado');
};

/**
 * Para o monitoramento do token
 */
export const stopTokenRefreshMonitoring = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log('Monitoramento de renovação de token parado');
  }
};

export default {
  startTokenRefreshMonitoring,
  stopTokenRefreshMonitoring
}; 