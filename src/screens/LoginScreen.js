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
  Animated,
  Dimensions,
  ImageBackground,
  TouchableWithoutFeedback,
  Keyboard,
  Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logUtils';

const logger = createLogger('LoginScreen');
const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const { login, isAuthenticated, loading: authLoading, error: authError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (isAuthenticated) {
      logger.info('Usuário já autenticado, redirecionando para MainApp');
      navigation.replace('MainApp');
    } else if (!authLoading) {
      // Animar a entrada da tela
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isAuthenticated, authLoading, navigation, fadeAnim, slideAnim]);

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
        <StatusBar style="dark" />
        <View style={styles.mainContent}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <Animated.View 
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
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
                  color={emailFocused ? "#0088FE" : "#94A3B8"} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[
                    styles.input, 
                    emailFocused && styles.inputFocused
                  ]}
                  placeholder="Your email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => {
                    setEmailFocused(true);
                    setKeyboardVisible(true);
                  }}
                  onBlur={() => {
                    setEmailFocused(false);
                    setKeyboardVisible(false);
                  }}
                />
              </View>

              <View style={styles.inputContainer}>
                <Icon 
                  name="lock-outline" 
                  size={20} 
                  color={passwordFocused ? "#0088FE" : "#94A3B8"} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[
                    styles.input, 
                    passwordFocused && styles.inputFocused
                  ]}
                  placeholder="Your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={secureTextEntry}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="none"
                  passwordRules=""
                  onFocus={() => {
                    setPasswordFocused(true);
                    setKeyboardVisible(true);
                  }}
                  onBlur={() => {
                    setPasswordFocused(false);
                    setKeyboardVisible(false);
                  }}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={toggleSecureEntry}
                >
                  <Icon 
                    name={secureTextEntry ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#94A3B8" 
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
                <Icon name="account-plus" size={20} color="#0088FE" style={styles.registerButtonIcon} />
                <Text style={styles.registerButtonText}>Create New Account</Text>
              </TouchableOpacity>
            </Animated.View>

            {!isKeyboardVisible && (
              <Animated.View 
                style={[
                  styles.footer,
                  {
                    opacity: fadeAnim
                  }
                ]}
              >
                <View style={styles.securityInfo}>
                  <Icon name="shield-check" size={16} color="#64748B" />
                  <Text style={styles.securityText}>Secure connection</Text>
                </View>
                <Text style={styles.footerText}>
                  Your account is protected and secure
                </Text>
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 30,
    borderRadius: 12,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    padding: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingRight: 15,
    fontSize: 16,
    color: '#1E293B',
  },
  inputFocused: {
    color: '#0F172A',
  },
  passwordToggle: {
    padding: 15,
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
    backgroundColor: '#0088FE',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: "#0088FE",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginButtonIcon: {
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityText: {
    color: '#64748B',
    fontSize: 14,
    marginLeft: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#0088FE',
    shadowColor: "#0088FE",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  registerButtonIcon: {
    marginRight: 8,
  },
  registerButtonText: {
    color: '#0088FE',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default LoginScreen; 