import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const LearnMoreScreen = () => {
  const navigation = useNavigation();

  const handleBackToWelcome = () => {
    navigation.goBack();
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToWelcome} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image 
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>CXLUS</Text>
        </View>

        {/* Main Content */}
        <View style={styles.contentSection}>
          <Text style={styles.mainTitle}>About CXLUS</Text>
          
          <Text style={styles.description}>
            CXLUS is a specialized platform designed for private, invitation-only access. 
            We connect clients with professionals through personalized protocols 
            and comprehensive progress management.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            
            <View style={styles.stepsList}>
              <Text style={styles.step}>1. Professional Invitation</Text>
              <Text style={styles.step}>2. Account Creation</Text>
              <Text style={styles.step}>3. Account Activation</Text>
              <Text style={styles.step}>4. Begin Protocols</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Features</Text>
            
            <View style={styles.featuresList}>
              <Text style={styles.feature}>• End-to-end encryption and secure data handling</Text>
              <Text style={styles.feature}>• Direct communication with professionals</Text>
              <Text style={styles.feature}>• Personalized protocols and tracking</Text>
              <Text style={styles.feature}>• Progress monitoring and detailed reporting</Text>
              <Text style={styles.feature}>• Daily check-ins and progress reporting</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy & Security</Text>
            <Text style={styles.description}>
              Your privacy and data security are our top priorities. CXLUS employs industry-standard 
              encryption, secure authentication, and strict access controls to ensure your 
              information remains confidential and protected.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={handleLogin}
          activeOpacity={0.9}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 48,
    height: 48,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  contentSection: {
    maxWidth: 400,
    alignSelf: 'center',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 32,
    fontWeight: '300',
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  stepsList: {
    marginLeft: 16,
  },
  step: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 12,
    fontWeight: '300',
  },
  featuresList: {
    marginLeft: 16,
  },
  feature: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 12,
    fontWeight: '300',
    lineHeight: 22,
  },
  buttonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

export default LearnMoreScreen; 