# 🧪 Como Acessar a Tela de Teste de Notificações

## Opção 1: Adicionar Botão Temporário em Qualquer Tela

Adicione este código em qualquer tela onde você queira testar:

```javascript
import { TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Dentro do seu componente:
const navigation = useNavigation();

// Adicione este botão temporário:
<TouchableOpacity
  style={{
    backgroundColor: '#2196F3',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  }}
  onPress={() => navigation.navigate('NotificationTest')}
>
  <Text style={{ color: 'white', fontWeight: 'bold' }}>
    🔔 Testar Notificações
  </Text>
</TouchableOpacity>
```

## Opção 2: Adicionar no Menu/Configurações

Se você tem uma tela de configurações ou menu, adicione uma opção:

```javascript
const menuItems = [
  // ... outros itens
  {
    title: 'Teste de Notificações',
    icon: '🔔',
    onPress: () => navigation.navigate('NotificationTest'),
  },
];
```

## Opção 3: Usar o Hook de Notificações Diretamente

Em qualquer tela, você pode usar o hook diretamente:

```javascript
import { useNotifications } from '../contexts/NotificationContext';

const MyScreen = () => {
  const { 
    isInitialized, 
    isRegistered, 
    scheduleTestNotification,
    registerDevice 
  } = useNotifications();

  const testNotification = () => {
    scheduleTestNotification('Teste', 'Funcionando!');
  };

  return (
    <View>
      <Text>Status: {isInitialized ? 'Ativo' : 'Inativo'}</Text>
      <Text>Registrado: {isRegistered ? 'Sim' : 'Não'}</Text>
      
      <TouchableOpacity onPress={testNotification}>
        <Text>Testar Notificação</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## Opção 4: Acesso via Console (Desenvolvimento)

Durante o desenvolvimento, você pode navegar via console:

```javascript
// No console do React Native Debugger ou Metro:
// Assumindo que você tem acesso ao navigation
navigation.navigate('NotificationTest');
```

## 🎯 Recomendação

Para testes rápidos, recomendo a **Opção 1** - adicionar um botão temporário na tela principal ou de dashboard do app. É rápido, fácil e pode ser removido depois dos testes. 