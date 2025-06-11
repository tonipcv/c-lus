import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function DoctorCard({ doctor }) {
  return (
    <View style={styles.card}>
      {doctor?.image ? (
        <Image
          source={{ uri: doctor.image }}
          style={styles.avatar}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {doctor?.name?.charAt(0)}
          </Text>
        </View>
      )}
      <Text style={styles.name}>{doctor?.name}</Text>
      <Text style={styles.specialty}>{doctor?.specialty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF5FF', // blue-50
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    color: '#1D4ED8', // blue-700
    fontWeight: '300',
  },
  name: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1F2937', // gray-800
    marginTop: 12,
  },
  specialty: {
    fontSize: 14,
    color: '#4B5563', // gray-600
    marginTop: 4,
  },
});
