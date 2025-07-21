import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import LearnMoreScreen from '../screens/LearnMoreScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LeadsScreen from '../screens/LeadsScreen';
import ProtocolScreen from '../screens/ProtocolScreen';
import SymptomReportsScreen from '../screens/SymptomReportsScreen';
import PatientProfile from '../screens/PatientProfile';
import NotificationTestScreen from '../screens/NotificationTestScreen';
import CoursesScreen from '../screens/CoursesScreen';
import CourseDetailScreen from '../screens/CourseDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FloatingTabNavigator from '../components/FloatingTabNavigator';
import LoadingSpinner from '../components/LoadingSpinner';
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
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator 
        initialRouteName={isAuthenticated ? "MainApp" : "Welcome"}
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
          // Telas de autenticação
          <Stack.Group>
            <Stack.Screen 
              name="Welcome" 
              component={WelcomeScreen} 
            />
            <Stack.Screen 
              name="LearnMore" 
              component={LearnMoreScreen} 
            />
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
            />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen} 
            />
          </Stack.Group>
        ) : (
          // Telas do app
          <Stack.Group>
            <Stack.Screen 
              name="MainApp" 
              component={FloatingTabNavigator} 
            />
            
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

            <Stack.Screen 
              name="SymptomReports" 
              component={SymptomReportsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
              }} 
            />

            <Stack.Screen 
              name="PatientProfile" 
              component={PatientProfile} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
              }} 
            />

            <Stack.Screen 
              name="NotificationTest" 
              component={NotificationTestScreen} 
              options={{ 
                title: 'Teste de Notificações',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#2196F3',
                },
                headerTitleStyle: {
                  color: '#FFFFFF',
                  fontWeight: '600',
                },
                headerTintColor: '#FFFFFF',
                headerShadowVisible: false,
              }} 
            />

            <Stack.Screen 
              name="Courses" 
              component={CoursesScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
              }} 
            />

            <Stack.Screen 
              name="CourseDetail" 
              component={CourseDetailScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
              }} 
            />

            <Stack.Screen 
              name="ProfileScreen" 
              component={ProfileScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
              }} 
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
