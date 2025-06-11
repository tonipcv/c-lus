import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as authLogin, register as authRegister } from '../services/authService';
import * as userService from '../services/userService';
import { isTokenValid, storeToken, getToken, removeToken } from '../utils/jwtUtils';
import tokenService from '../services/tokenService';
import { createLogger } from '../utils/logUtils';
import { jwtDecode } from 'jwt-decode';

// Criar logger para o AuthContext
const logger = createLogger('AuthContext');

// Criar o contexto
const AuthContext = createContext(null);

// Hook personalizado para usar o contexto
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  // Função para carregar o estado de autenticação inicial
  const loadAuthState = async () => {
    try {
      setAuthLoading(true);
      const token = await getToken();
      
      if (token && isTokenValid(token)) {
        logger.info('Token válido encontrado, restaurando sessão');
        setIsAuthenticated(true);
        
        // Carregar dados do usuário se tiver token válido
        await fetchUserProfile();
      } else {
        logger.info('Token inválido ou ausente');
        setIsAuthenticated(false);
        setUser(null);
        // Limpar token inválido do storage
        await removeToken();
      }
    } catch (error) {
      logger.error('Erro ao carregar estado de autenticação', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // Carregar o estado de autenticação quando o app inicia
  useEffect(() => {
    logger.debug('Iniciando verificação de estado de autenticação');
    loadAuthState();
  }, []);

  // Iniciar ou parar o monitoramento de token baseado no estado de autenticação
  useEffect(() => {
    if (isAuthenticated) {
      logger.debug('Iniciando monitoramento de token');
      tokenService.startTokenRefreshMonitoring();
    } else {
      logger.debug('Parando monitoramento de token');
      tokenService.stopTokenRefreshMonitoring();
    }

    return () => {
      logger.debug('Limpando monitoramento de token');
      tokenService.stopTokenRefreshMonitoring();
    };
  }, [isAuthenticated]);

  // Buscar perfil do usuário
  const fetchUserProfile = async () => {
    try {
      logger.debug('Buscando perfil do usuário');
      const userData = await userService.getUserProfile();
      setUser(userData);
      logger.info('Perfil do usuário carregado com sucesso');
      return userData;
    } catch (error) {
      logger.error('Erro ao buscar perfil do usuário', error);
      return null;
    }
  };

  // Login do usuário
  const login = async (email, password) => {
    try {
      logger.debug('Tentativa de login', { email });
      setAuthLoading(true);
      setAuthError(null);

      const response = await authLogin(email, password);
      
      if (response && response.token) {
        logger.info('Login bem-sucedido');
        // O token já é armazenado pela função login do authService
        setIsAuthenticated(true);
        await fetchUserProfile();
        return true;
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      logger.error('Erro no login', error);
      setAuthError(error.message || 'Falha na autenticação');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // Login direto com token (usado após registro)
  const loginWithToken = async (token, userData = null) => {
    try {
      logger.debug('Login com token');
      setAuthLoading(true);
      setAuthError(null);

      // Armazenar o token
      await storeToken(token);
      
      // Definir como autenticado
      setIsAuthenticated(true);
      
      // Se os dados do usuário foram fornecidos, usar eles, senão buscar
      if (userData) {
        setUser(userData);
        logger.info('Login com token bem-sucedido usando dados fornecidos');
      } else {
        await fetchUserProfile();
        logger.info('Login com token bem-sucedido, perfil carregado');
      }
      
      return true;
    } catch (error) {
      logger.error('Erro no login com token', error);
      setAuthError(error.message || 'Falha na autenticação com token');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout do usuário
  const logout = async () => {
    try {
      logger.debug('Iniciando logout');
      setAuthLoading(true);
      await removeToken();
      setIsAuthenticated(false);
      setUser(null);
      logger.info('Logout realizado com sucesso');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      Alert.alert('Erro', 'Ocorreu um erro ao fazer logout.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Registro de usuário
  const register = async (userData) => {
    try {
      logger.debug('Tentativa de registro', { email: userData.email });
      setAuthLoading(true);
      setAuthError(null);
      
      const response = await authRegister(userData);
      
      if (response && response.token) {
        logger.info('Registro bem-sucedido');
        // O token já é armazenado pela função register do authService
        setIsAuthenticated(true);
        await fetchUserProfile();
        return true;
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      logger.error('Erro no registro', error);
      setAuthError(error.message || 'Falha no registro');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // Função para atualizar dados do usuário
  const updateUserData = async (userData) => {
    try {
      setUser(userData);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
    }
  };

  const handleSessionExpired = useCallback(async () => {
    logger.warn('Sessão expirada detectada, fazendo logout automático');
    await logout();
  }, [logout]);

  // Valor do contexto
  const value = {
    user,
    loading: authLoading,
    error: authError,
    isAuthenticated,
    login,
    loginWithToken,
    logout,
    updateUserData,
    refreshAuth: loadAuthState,
    handleSessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 