import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Image, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '@react-navigation/native';

// Screens
import HomeScreen from '../screens/HomeScreen';
import PatientProfile from '../screens/PatientProfile';
import ReferralsScreen from '../screens/ReferralsScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#151515',
          borderTopWidth: 1,
          borderTopColor: '#252525',
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
        tabBarItemStyle: {
          paddingVertical: 4,
        }
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={{
                  width: focused ? 32 : 28,
                  height: focused ? 32 : 28,
                }}
                resizeMode="contain"
              />
            </View>
          ),
        }} 
      />
    </Tab.Navigator>
  );
};

export default TabNavigator; 