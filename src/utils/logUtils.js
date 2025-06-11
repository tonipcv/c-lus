/**
 * Utilitário para logs melhorados com diferentes níveis
 * Em produção, os logs podem ser desativados ou enviados para um serviço de monitoramento
 */

// Configuração de logs
const LOG_CONFIG = {
  // Quando true, mostra todos os logs no console
  enableConsoleLogs: __DEV__, // Ativar apenas em desenvolvimento
  
  // Definir níveis que devem ser mostrados
  enabledLevels: {
    debug: __DEV__, // Logs de debug apenas em desenvolvimento
    info: true,     // Logs de informação sempre
    warn: true,     // Logs de aviso sempre
    error: true     // Logs de erro sempre
  }
};

/**
 * Log de depuração - usar para informações temporárias durante desenvolvimento
 * @param {string} tag - Tag para identificar a origem do log
 * @param {...any} args - Argumentos a serem logados
 */
export const debug = (tag, ...args) => {
  if (LOG_CONFIG.enableConsoleLogs && LOG_CONFIG.enabledLevels.debug) {
    console.debug(`[DEBUG][${tag}]`, ...args);
  }
};

/**
 * Log de informação - usar para informações importantes sobre o fluxo normal
 * @param {string} tag - Tag para identificar a origem do log
 * @param {...any} args - Argumentos a serem logados
 */
export const info = (tag, ...args) => {
  if (LOG_CONFIG.enableConsoleLogs && LOG_CONFIG.enabledLevels.info) {
    console.info(`[INFO][${tag}]`, ...args);
  }
};

/**
 * Log de aviso - usar para situações que precisam de atenção mas não são erros críticos
 * @param {string} tag - Tag para identificar a origem do log
 * @param {...any} args - Argumentos a serem logados
 */
export const warn = (tag, ...args) => {
  if (LOG_CONFIG.enableConsoleLogs && LOG_CONFIG.enabledLevels.warn) {
    console.warn(`[WARN][${tag}]`, ...args);
  }
};

/**
 * Log de erro - usar para erros e exceções
 * @param {string} tag - Tag para identificar a origem do log
 * @param {...any} args - Argumentos a serem logados
 */
export const error = (tag, ...args) => {
  if (LOG_CONFIG.enableConsoleLogs && LOG_CONFIG.enabledLevels.error) {
    console.error(`[ERROR][${tag}]`, ...args);
  }
  
  // Aqui você poderia adicionar código para enviar erros para um serviço de monitoramento
  // como Sentry, Firebase Crashlytics, etc.
};

/**
 * Logger completo para módulos específicos
 * @param {string} moduleName - Nome do módulo para identificação nos logs
 * @returns {Object} - Objeto com os métodos de log
 */
export const createLogger = (moduleName) => {
  return {
    debug: (...args) => debug(moduleName, ...args),
    info: (...args) => info(moduleName, ...args),
    warn: (...args) => warn(moduleName, ...args),
    error: (...args) => error(moduleName, ...args)
  };
};

export default {
  debug,
  info,
  warn,
  error,
  createLogger
}; 