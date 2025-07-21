import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const success = await login(email, password);
      
      if (!success) {
        Alert.alert('Error', 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      <View style={styles.container}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.content}
          >
            {/* Logo */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
            {/* Login Form */}
            <View style={styles.formContainer}>
                <TextInput
                  style={styles.input}
                placeholder="Email"
                placeholderTextColor="#7F8589"
                  value={email}
                  onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

                <TextInput
                  style={styles.input}
                placeholder="Password"
                placeholderTextColor="#7F8589"
                  value={password}
                  onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                activeOpacity={0.9}
              >
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerButton}
                onPress={handleRegister}
              >
                <Text style={styles.registerButtonText}>
                  Don't have an account? <Text style={styles.registerButtonHighlight}>Register</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
        </View>
      </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 30,
  },
  formContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    marginTop: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    color: '#18222A',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontFamily: 'ManropeRegular',
  },
  loginButton: {
    backgroundColor: '#1697F5',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'ManropeSemiBold',
  },
  registerButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#7F8589',
    fontSize: 14,
    fontFamily: 'ManropeRegular',
  },
  registerButtonHighlight: {
    color: '#1697F5',
    fontFamily: 'ManropeMedium',
  },
});

export default LoginScreen; 