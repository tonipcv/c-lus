import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface LoadingSpinnerProps {
  message?: string;
  showLogo?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = '', 
  showLogo = true 
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animação de fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Animação de scale
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 20,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Animação de rotação contínua
    const startRotation = () => {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    };

    // Animação de pulso
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startRotation();
    startPulse();
  }, [rotateAnim, fadeAnim, scaleAnim, pulseAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: -20 } // Move um pouco para cima
            ],
          }
        ]}
      >
        {showLogo && (
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [
                  { scale: pulseAnim },
                  { rotate: spin }
                ],
              }
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        )}
        
        <View style={styles.spinnerContainer}>
          <Animated.View 
            style={[
              styles.spinner,
              {
                transform: [{ rotate: spin }]
              }
            ]} 
          />
        </View>

        {message && (
          <Animated.Text 
            style={[
              styles.message,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            {message}
          </Animated.Text>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16171b',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 30,
    shadowColor: '#1697F5',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  spinnerContainer: {
    marginBottom: 20,
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(22, 151, 245, 0.2)',
    borderTopColor: '#1697F5',
    alignSelf: 'center',
    shadowColor: '#1697F5',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  message: {
    fontSize: 16,
    color: '#f8fafc',
    fontFamily: 'ManropeMedium',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default LoadingSpinner;
