import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { useTheme } from '@react-navigation/native';

// Screens
import HomeScreen from '../screens/HomeScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none' // Esconde a barra de navegação
        }
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator; 