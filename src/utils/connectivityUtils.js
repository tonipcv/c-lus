/**
 * Utilitário para gerenciar conectividade com a internet
 */
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { createLogger } from './logUtils';

const logger = createLogger('ConnectivityUtils');

/**
 * Verifica se o dispositivo tem conexão com a internet
 * @returns {Promise<boolean>} Promise resolvida com true se conectado, false caso contrário
 */
export const isConnected = async () => {
  try {
    const state = await NetInfo.fetch();
    logger.debug('Estado da conexão:', state);
    
    // Considerar conectado se isConnected for true, mesmo se isInternetReachable for null
    // (isInternetReachable pode ser null em alguns dispositivos mesmo com internet)
    if (state.isConnected && state.isInternetReachable === null) {
      logger.info('Dispositivo conectado à rede, mas verificação de internet indeterminada. Assumindo conectado.');
      return true;
    }
    
    return state.isConnected && (state.isInternetReachable === true || state.isInternetReachable === null);
  } catch (error) {
    logger.error('Erro ao verificar conexão', error);
    return false;
  }
};

/**
 * Hook para monitorar o estado da conexão
 * @returns {object} Objeto com estado da conexão e tipo
 */
export const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    type: null,
    details: null
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // Considerar conectado mesmo se isInternetReachable for null
      const isReachable = state.isConnected && 
        (state.isInternetReachable === true || state.isInternetReachable === null);
      
      if (networkState.isConnected !== isReachable) {
        logger.info(
          isReachable ? 'Conexão com internet restaurada' : 'Conexão com internet perdida', 
          { type: state.type }
        );
      }
      
      setNetworkState({
        isConnected: isReachable,
        type: state.type,
        details: state.details
      });
    });

    // Carregar estado inicial
    NetInfo.fetch().then(state => {
      const isReachable = state.isConnected && 
        (state.isInternetReachable === true || state.isInternetReachable === null);
        
      setNetworkState({
        isConnected: isReachable,
        type: state.type,
        details: state.details
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return networkState;
};

export default {
  isConnected,
  useNetworkStatus
}; 