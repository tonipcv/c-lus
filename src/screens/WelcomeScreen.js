import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation();

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleLearnMore = () => {
    navigation.navigate('LearnMore');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Main Content */}
      <View style={styles.content}>
        {/* Logo and Message */}
        <View style={styles.chatContainer}>
          <Image 
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          
          <View style={styles.messageContainer}>
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>
                Welcome to your personalized protocol management platform.
          </Text>
            </View>
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>
                Get started with your treatment journey by logging in or learn more about our services.
          </Text>
            </View>
          </View>
        </View>

      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleLogin}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleLearnMore}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>Learn More</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Invitation-only platform</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 24,
  },
  chatContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
    marginTop: 4,
  },
  messageContainer: {
    flex: 1,
    gap: 8,
  },
  messageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
  },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 3,
  },
  messageText: {
    fontSize: 15,
    color: '#18222A',
    lineHeight: 22,
    fontFamily: 'ManropeRegular',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    marginBottom: 32,
    paddingHorizontal: 32,
  },
  primaryButton: {
    backgroundColor: '#1697F5',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1697F5',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeSemiBold',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#18222A',
    fontSize: 16,
    fontFamily: 'ManropeMedium',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 13,
    color: '#7F8589',
    fontFamily: 'ManropeLight',
  },
});

export default WelcomeScreen; 