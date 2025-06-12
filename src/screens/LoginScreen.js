import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('LoginScreen');

const LoginScreen = ({ navigation }) => {
  const { login, isAuthenticated, loading: authLoading, error: authError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (isAuthenticated) {
      logger.info('Usuário já autenticado, redirecionando para MainApp');
      navigation.replace('MainApp');
    }
  }, [isAuthenticated, navigation]);

  // Mostrar erro de autenticação quando necessário
  useEffect(() => {
    if (authError) {
      logger.error('Erro de autenticação:', authError);
      Alert.alert('Login Error', authError);
    }
  }, [authError]);

  const handleLogin = async () => {
    // Esconder teclado
    Keyboard.dismiss();

    if (!email || !password) {
      logger.warn('Tentativa de login com campos vazios');
      Alert.alert(
        'Required Fields', 
        'Please fill in your email and password to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setLoading(true);
      logger.debug('Iniciando processo de login', { email });
      const success = await login(email, password);
      
      if (success) {
        // Login bem-sucedido - o hook de autenticação já atualizará o estado
        logger.info('Login bem-sucedido');
      } else {
        // Erro já está sendo tratado pelo hook de autenticação
        logger.warn('Falha no login');
      }
    } catch (error) {
      logger.error('Erro no processo de login:', error);
      
      let errorMessage = 'Unable to login at the moment.';
      let errorTitle = 'Login Error';
      
      if (error.message?.includes('Não autorizado') || error.message?.includes('Credenciais inválidas')) {
        errorTitle = 'Invalid Credentials';
        errorMessage = 'Incorrect email or password. Please check your credentials and try again.';
      } else if (error.message?.includes('Network')) {
        errorTitle = 'Connection Problem';
        errorMessage = 'Please check your internet connection and try again. Our servers may be temporarily unavailable.';
      } else if (error.message?.includes('timeout')) {
        errorTitle = 'Timeout Exceeded';
        errorMessage = 'The request took longer than expected. Please check your connection and try again.';
      }
      
      Alert.alert(
        errorTitle,
        errorMessage + '\n\nIf the problem persists, please contact our support team.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleSecureEntry = () => {
    setSecureTextEntry(!secureTextEntry);
  };

  const handleForgotPassword = () => {
    const forgotPasswordUrl = 'https://app.cxlus.com/auth/forgot-password';
    
    Linking.canOpenURL(forgotPasswordUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(forgotPasswordUrl);
        } else {
          Alert.alert(
            'Error',
            'Unable to open the forgot password page. Please try again later.',
            [{ text: 'OK' }]
          );
        }
      })
      .catch((err) => {
        logger.error('Error opening forgot password URL:', err);
        Alert.alert(
          'Error',
          'Unable to open the forgot password page. Please try again later.',
          [{ text: 'OK' }]
        );
      });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.mainContent}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.formContainer}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Icon 
                  name="email-outline" 
                  size={20} 
                  color="#cccccc" 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Your email"
                  placeholderTextColor="#888888"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Icon 
                  name="lock-outline" 
                  size={20} 
                  color="#cccccc" 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Your password"
                  placeholderTextColor="#888888"
                  secureTextEntry={secureTextEntry}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={toggleSecureEntry}
                >
                  <Icon 
                    name={secureTextEntry ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#cccccc" 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <Icon name="arrow-right" size={20} color="#FFFFFF" style={styles.loginButtonIcon} />
                  </>
                )}
              </TouchableOpacity>

              {/* Botão de Registro */}
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.8}
              >
                <Text style={styles.registerButtonText}>Create New Account</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <View style={styles.securityInfo}>
                <Icon name="shield-check" size={16} color="#cccccc" />
                <Text style={styles.securityText}>Secure connection</Text>
              </View>
              <Text style={styles.footerText}>
                Your account is protected and secure
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  formContainer: {
    backgroundColor: 'transparent', // Same as background for minimalist look
    padding: 24,
    marginBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80, // Smaller logo
    height: 80, // Smaller logo
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#1a2332', // Slightly lighter navy
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3441', // Subtle navy border
    minHeight: 56,
  },
  inputIcon: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingRight: 15,
    fontSize: 16,
    color: '#ffffff',
  },
  passwordToggle: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#0088FE',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginButtonIcon: {
    marginLeft: 10,
    color: '#ffffff',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityText: {
    color: '#888888',
    fontSize: 12,
    marginLeft: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
  },
  registerButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
  registerButtonText: {
    color: '#8892a0',
    fontSize: 14,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen; 