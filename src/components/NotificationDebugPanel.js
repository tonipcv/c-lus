import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

const NotificationDebugPanel = () => {
  const {
    isInitialized,
    isRegistered,
    fcmToken,
    notificationStats,
    loading,
    error,
    registerDevice,
    scheduleTestNotification,
    cancelAllNotifications,
    updateNotificationStats,
    reinitialize,
    canReceiveNotifications,
    tokenPreview,
  } = useNotifications();

  const { user, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await updateNotificationStats();
    setRefreshing(false);
  };

  const handleRegisterDevice = async () => {
    const success = await registerDevice(true); // Force register
    if (success) {
      Alert.alert('Sucesso', 'Dispositivo registrado com sucesso!');
    }
  };

  const handleTestNotification = () => {
    scheduleTestNotification('🔔 Teste CXLUS', 'Sua notificação está funcionando perfeitamente!');
  };

  const copyTokenToClipboard = () => {
    if (fcmToken) {
      // Em um app real, você usaria Clipboard.setString(fcmToken)
      Alert.alert('Token FCM', fcmToken, [
        { text: 'OK' }
      ]);
    }
  };

  const getStatusColor = (status) => {
    return status ? '#4CAF50' : '#F44336';
  };

  const getStatusText = (status) => {
    return status ? '✅ Ativo' : '❌ Inativo';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>🔔 Debug de Notificações</Text>
        <Text style={styles.subtitle}>Painel de controle e monitoramento</Text>
      </View>

      {/* Status Geral */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Status Geral</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Serviço Inicializado:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(isInitialized) }]}>
            {getStatusText(isInitialized)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Dispositivo Registrado:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(isRegistered) }]}>
            {getStatusText(isRegistered)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Pode Receber Notificações:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(canReceiveNotifications) }]}>
            {getStatusText(canReceiveNotifications)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Usuário Autenticado:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(isAuthenticated) }]}>
            {getStatusText(isAuthenticated)}
          </Text>
        </View>

        {loading && (
          <Text style={styles.loadingText}>⏳</Text>
        )}

        {error && (
          <Text style={styles.errorText}>❌ Erro: {error}</Text>
        )}
      </View>

      {/* Informações do Token */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 Token FCM</Text>
        
        {tokenPreview ? (
          <TouchableOpacity onPress={copyTokenToClipboard} style={styles.tokenContainer}>
            <Text style={styles.tokenText}>{tokenPreview}</Text>
            <Text style={styles.tokenHint}>Toque para ver o token completo</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noTokenText}>Nenhum token disponível</Text>
        )}
      </View>

      {/* Informações do Usuário */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Dados do Usuário</Text>
        
        {user ? (
          <>
            <Text style={styles.userInfo}>ID: {user.id || user.userId || user._id || 'N/A'}</Text>
            <Text style={styles.userInfo}>Email: {user.email || 'N/A'}</Text>
            <Text style={styles.userInfo}>Nome: {user.name || user.firstName || 'N/A'}</Text>
          </>
        ) : (
          <Text style={styles.noUserText}>Usuário não autenticado</Text>
        )}
      </View>

      {/* Estatísticas Detalhadas */}
      {notificationStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Estatísticas</Text>
          
          <Text style={styles.statText}>Plataforma: {notificationStats.platform}</Text>
          <Text style={styles.statText}>
            Registrado em: {notificationStats.registrationData?.registeredAt 
              ? new Date(notificationStats.registrationData.registeredAt).toLocaleString('pt-BR')
              : 'N/A'
            }
          </Text>
        </View>
      )}

      {/* Ações */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎮 Ações</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleRegisterDevice}
          disabled={!isInitialized}
        >
          <Text style={styles.buttonText}>🔄 Registrar Dispositivo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestNotification}
          disabled={!isInitialized}
        >
          <Text style={styles.buttonText}>🧪 Testar Notificação</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={cancelAllNotifications}
        >
          <Text style={styles.buttonText}>🗑️ Cancelar Todas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={reinitialize}
        >
          <Text style={styles.buttonText}>🔄 Reinicializar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Última atualização: {new Date().toLocaleTimeString('pt-BR')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 10,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  tokenContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tokenText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  tokenHint: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  noTokenText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  userInfo: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  noUserText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  statText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  button: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  infoButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});

export default NotificationDebugPanel; 