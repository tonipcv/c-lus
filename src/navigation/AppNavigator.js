import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LeadsScreen from '../screens/LeadsScreen';
import ProtocolScreen from '../screens/ProtocolScreen';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator();

// Definir um tema personalizado para a navegação
const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0088FE',
    background: '#F8F9FA',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
    notification: '#0088FE',
  },
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088FE" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator 
        initialRouteName={isAuthenticated ? "MainApp" : "Login"}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          presentation: 'card',
          cardOverlayEnabled: true,
          animationTypeForReplace: isAuthenticated ? 'push' : 'pop',
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
            />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen} 
            />
          </>
        ) : (
          <>
            {/* Tab Navigator como tela principal após o login */}
            <Stack.Screen 
              name="MainApp" 
              component={TabNavigator} 
            />
            
            {/* Telas adicionais que podem ser acessadas a partir das tabs */}
            <Stack.Screen 
              name="Leads" 
              component={LeadsScreen} 
              options={{ 
                title: 'Leads',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                },
                headerTitleStyle: {
                  color: '#1F2937',
                  fontWeight: '600',
                },
                headerShadowVisible: false,
              }} 
            />

            <Stack.Screen 
              name="Protocol" 
              component={ProtocolScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
              }} 
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
});

export default AppNavigator;
