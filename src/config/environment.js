/**
 * Configuração de variáveis de ambiente
 * Este arquivo centraliza o acesso às variáveis de ambiente para evitar importações diretas
 * de @env em todos os arquivos
 */
import { API_URL, JWT_SECRET } from '@env';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('Environment');

// Define valores padrão para desenvolvimento caso as variáveis não estejam definidas
const DEFAULT_ENV = {
  API_URL: 'https://app.cxlus.com',
  JWT_SECRET: 'your-nextauth-secret',
};

// Valida e exporta as variáveis de ambiente
export const ENV = {
  API_URL: API_URL || DEFAULT_ENV.API_URL,
  JWT_SECRET: JWT_SECRET || DEFAULT_ENV.JWT_SECRET,
  // Adicione outras variáveis de ambiente aqui conforme necessário
};

// Valida se as variáveis essenciais estão configuradas
const validateEnvironment = () => {
  const missing = [];
  
  if (!ENV.API_URL) missing.push('API_URL');
  if (!ENV.JWT_SECRET) missing.push('JWT_SECRET');
  
  if (missing.length > 0) {
    logger.warn(`Algumas variáveis de ambiente estão faltando: ${missing.join(', ')}. Usando valores padrão.`);
  }
  
  logger.info('Configuração de ambiente carregada', { 
    API_URL: ENV.API_URL,
    // Não logar o JWT_SECRET completo por segurança
    JWT_SECRET_SET: !!ENV.JWT_SECRET,
  });
};

validateEnvironment();

export default ENV; 