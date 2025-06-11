import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { setupGlobalErrorHandler } from './src/utils/errorHandler';
import './src/config/environment';

export default function App() {
  // Configurar o manipulador global de erros ao iniciar o aplicativo
  useEffect(() => {
    setupGlobalErrorHandler();
  }, []);

  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
