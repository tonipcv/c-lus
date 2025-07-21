import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { setupGlobalErrorHandler } from './src/utils/errorHandler';
import LoadingSpinner from './src/components/LoadingSpinner';
import {
  useFonts,
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import './src/config/environment';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [fontsLoaded] = useFonts({
    ManropeExtraLight: Manrope_200ExtraLight,
    ManropeLight: Manrope_300Light,
    ManropeRegular: Manrope_400Regular,
    ManropeMedium: Manrope_500Medium,
    ManropeSemiBold: Manrope_600SemiBold,
    ManropeBold: Manrope_700Bold,
    ManropeExtraBold: Manrope_800ExtraBold,
  });

  // Configurar o manipulador global de erros ao iniciar o aplicativo
  useEffect(() => {
    setupGlobalErrorHandler();
  }, []);

  // Simular um tempo mínimo de carregamento para mostrar o spinner
  useEffect(() => {
    if (fontsLoaded) {
      // Aguardar pelo menos 2 segundos antes de esconder o spinner
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || isLoading) {
    return <LoadingSpinner showLogo={true} />;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <AppNavigator />
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16171b',
  },
});
