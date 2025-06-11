# Sistema de Autenticação JWT - React Native

Este projeto implementa um sistema completo de autenticação JWT para aplicações React Native, com foco em segurança, resiliência e experiência do usuário.

## Recursos Implementados

### 1. Sistema de Autenticação

- **JWT (JSON Web Token)**: Implementação completa de autenticação baseada em tokens
- **Renovação Automática**: Sistema que monitora e renova tokens de forma transparente
- **Persistência Segura**: Armazenamento local seguro dos tokens de autenticação
- **Manipulação de Erros**: Tratamento adequado de todos os cenários de erro relacionados à autenticação

### 2. Contexto Global de Autenticação

- **AuthContext**: Estado global de autenticação acessível em toda a aplicação
- **Hook useAuth**: Facilita o acesso ao estado e funções de autenticação
- **Navegação Condicional**: Roteamento automático baseado no estado de autenticação

### 3. Serviços HTTP Robustos

- **Interceptores de Requisição**: Adiciona automaticamente tokens às requisições
- **Gerenciamento de Erros**: Tratamento unificado e amigável dos erros de API
- **Retry e Fila**: Reenvio automático de requisições após renovação de token
- **Verificação de Conectividade**: Detecção de estado offline e retentativa quando apropriado

### 4. Utilitários e Ferramentas

- **Sistema de Logs**: Registros detalhados para depuração e monitoramento
- **Tratamento Global de Erros**: Captura e processamento de erros não tratados
- **Verificação de Conectividade**: Monitoramento do estado da rede
- **Configuração de Ambiente**: Gerenciamento centralizado de variáveis de ambiente

## Estrutura de Arquivos

```
src/
├── config/
│   └── environment.js         # Configuração de variáveis de ambiente
├── contexts/
│   └── AuthContext.js         # Contexto global de autenticação
├── navigation/
│   └── AppNavigator.js        # Navegação condicional baseada em autenticação
├── screens/
│   ├── LoginScreen.js         # Tela de login
│   └── ...                    # Outras telas
├── services/
│   ├── apiClient.js           # Cliente HTTP com interceptores
│   ├── authService.js         # Serviço de autenticação
│   └── tokenService.js        # Serviço de monitoramento de tokens
└── utils/
    ├── connectivityUtils.js   # Utilitários de verificação de conectividade
    ├── errorHandler.js        # Tratamento global de erros
    ├── jwtUtils.js            # Utilitários para manipulação de JWT
    └── logUtils.js            # Sistema de logs
```

## Guia de Uso

### Configuração Inicial

1. **Variáveis de Ambiente**

   Crie um arquivo `.env` na raiz do projeto:

   ```
   API_URL=https://seu-backend.com/api
   JWT_SECRET=seu_secret_jwt
   ```

2. **Dependências Necessárias**

   ```bash
   npm install @react-native-async-storage/async-storage jwt-decode react-native-dotenv @react-native-community/netinfo
   ```

3. **Configuração do Babel**

   Atualize seu `babel.config.js` para suportar variáveis de ambiente:

   ```js
   module.exports = function(api) {
     api.cache(true);
     return {
       presets: ['babel-preset-expo'],
       plugins: [
         ["module:react-native-dotenv", {
           "moduleName": "@env",
           "path": ".env",
           "blacklist": null,
           "whitelist": null,
           "safe": false,
           "allowUndefined": true
         }]
       ]
     };
   };
   ```

### Uso do Sistema de Autenticação

1. **Inicialização do Sistema**

   Seu `App.js` deve incluir o provedor de autenticação:

   ```jsx
   import React, { useEffect } from 'react';
   import { AuthProvider } from './src/contexts/AuthContext';
   import AppNavigator from './src/navigation/AppNavigator';
   import { setupGlobalErrorHandler } from './src/utils/errorHandler';
   import './src/config/environment';

   export default function App() {
     useEffect(() => {
       setupGlobalErrorHandler();
     }, []);

     return (
       <AuthProvider>
         <AppNavigator />
       </AuthProvider>
     );
   }
   ```

2. **Uso em Componentes**

   Use o hook `useAuth` para acessar o estado de autenticação:

   ```jsx
   import React, { useEffect, useState } from 'react';
   import { View, Text } from 'react-native';
   import { useAuth } from '../contexts/AuthContext';
   import { leadService } from '../services/leadService';

   export const LeadsScreen = () => {
     const { isAuthenticated, user } = useAuth();
     const [leads, setLeads] = useState([]);
     
     useEffect(() => {
       const loadLeads = async () => {
         if (isAuthenticated) {
           const data = await leadService.getLeads();
           setLeads(data);
         }
       };
       
       loadLeads();
     }, [isAuthenticated]);
     
     return (
       <View>
         <Text>Total de leads: {leads.length}</Text>
         {/* Seu componente aqui */}
       </View>
     );
   };
   ```

3. **Login e Logout**

   ```jsx
   import { useAuth } from '../contexts/AuthContext';
   
   // Em seu componente de login:
   const { login, error, loading } = useAuth();
   
   const handleLogin = async () => {
     const success = await login(email, password);
     if (success) {
       // Navegue para a tela principal
     }
   };
   
   // Para fazer logout:
   const { logout } = useAuth();
   
   const handleLogout = async () => {
     await logout();
     // Usuário será redirecionado automaticamente para login
   };
   ```

## Melhores Práticas

1. **Segurança**
   - Nunca armazene o JWT_SECRET no código cliente
   - Use HTTPS para todas as comunicações com a API
   - Implemente expiração curta para tokens de acesso

2. **Performance**
   - Use o monitoramento proativo de tokens para evitar atrasos na experiência do usuário
   - Implemente cache local de dados para operações offline

3. **Experiência do Usuário**
   - Forneça feedback claro sobre erros de autenticação
   - Mantenha o estado de loading durante operações de autenticação
   - Implemente um fluxo de recuperação quando a autenticação falhar

## Solução de Problemas

**Tokens não são renovados automaticamente**
- Verifique se o serviço `tokenService` está sendo iniciado corretamente
- Confira se as variáveis de ambiente estão corretas

**Erros de autenticação frequentes**
- Verifique se o tempo de expiração do JWT no backend está alinhado com o cliente
- Confira os logs para mensagens detalhadas de erro

**Problemas de conexão**
- Use o hook `useNetworkStatus` para monitorar o estado da conexão
- Implemente um cache local para operações críticas

## Contribuindo

Contribuições são bem-vindas! Por favor, siga estas etapas:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nome-da-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nome-da-feature`)
5. Abra um Pull Request 