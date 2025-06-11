import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatsCard({ doctor }) {
  if (!doctor?.stats) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Estatísticas</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{doctor.stats.patients}</Text>
          <Text style={styles.statLabel}>Pacientes</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{doctor.stats.experience}</Text>
          <Text style={styles.statLabel}>Experiência</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{doctor.stats.rating}</Text>
          <Text style={styles.statLabel}>Avaliação</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937', // gray-800
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D4ED8', // blue-700
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280', // gray-500
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB', // gray-200
  },
});
