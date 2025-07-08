import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import NotificationDebugPanel from '../components/NotificationDebugPanel';

const NotificationTestScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <NotificationDebugPanel />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default NotificationTestScreen; 