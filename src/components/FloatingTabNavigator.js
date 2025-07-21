import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Importar as telas
import HomeScreen from '../screens/HomeScreen';
import ProtocolsScreen from '../screens/ProtocolsScreen';
import HabitsScreen from '../screens/HabitsScreen';

const Tab = createBottomTabNavigator();
const { width, height } = Dimensions.get('window');

// Componente customizado para o tab bar
const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const tab = tabs.find(t => t.route === route.name);
          if (!tab) return null;

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tab, isFocused && styles.activeTab]}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.8}
            >
              <Icon
                name={isFocused ? tab.activeIcon : tab.icon}
                size={20}
                color={isFocused ? '#60a5fa' : '#94a3b8'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const tabs = [
  {
    name: 'Home',
    icon: 'home-outline',
    route: 'MainApp',
    activeIcon: 'home',
  },
  {
    name: 'Protocols',
    icon: 'clipboard-text-outline',
    route: 'Protocols',
    activeIcon: 'clipboard-text',
  },
  {
    name: 'Habits',
    icon: 'calendar-check-outline',
    route: 'Habits',
    activeIcon: 'calendar-check',
  },
];

const FloatingTabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true, // Lazy loading para melhor performance
        unmountOnBlur: false, // Manter o estado das telas
      }}
    >
      <Tab.Screen 
        name="MainApp" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Protocols" 
        component={ProtocolsScreen}
        options={{
          tabBarLabel: 'Protocols',
        }}
      />
      <Tab.Screen 
        name="Habits" 
        component={HabitsScreen}
        options={{
          tabBarLabel: 'Habits',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 30,
    left: 20,
    right: 20,
    zIndex: 999999,
    elevation: 999999,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 15,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
});

export default FloatingTabNavigator; 