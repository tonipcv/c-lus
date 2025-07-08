# CXLUS API Documentation

## Base URL
```
https://app.cxlus.com/api
```

## Authentication
A API utiliza autenticação JWT (JSON Web Token). Para acessar endpoints protegidos, você precisa:

1. Fazer login para obter o token
2. Incluir o token no header `Authorization` em todas as requisições subsequentes

### Login
```http
POST /api/auth/mobile/login
Content-Type: application/json

{
  "email": "seu_email@exemplo.com",
  "password": "sua_senha"
}
```

**Resposta de Sucesso:**
```json
{
  "token": "seu_jwt_token",
  "user": {
    "id": "user_id",
    "name": "Nome do Usuário",
    "email": "email@exemplo.com"
    // ... outros dados do usuário
  }
}
```

## Endpoints

### Protocolos

#### Listar Protocolos do Paciente
```http
GET /api/protocols/assignments
Authorization: Bearer seu_jwt_token
```

**Resposta:**
```json
[
  {
    "id": "protocol_id",
    "protocol": {
      "name": "Nome do Protocolo",
      "description": "Descrição do Protocolo",
      "duration": "Duração em dias",
      "doctor": {
        "name": "Nome do Médico"
      }
    },
    "status": "ACTIVE|INACTIVE",
    "startDate": "2024-01-01",
    "endDate": "2024-02-01",
    "currentDay": 1
  }
]
```

#### Progresso do Protocolo
```http
GET /api/protocols/progress?protocolId=protocol_id
Authorization: Bearer seu_jwt_token
```

### Perfil do Paciente

#### Obter Perfil
```http
GET /api/patient/profile
Authorization: Bearer seu_jwt_token
```

#### Atualizar Perfil
```http
PUT /api/patient/profile
Authorization: Bearer seu_jwt_token
Content-Type: application/json

{
  "name": "Novo Nome",
  "email": "novo_email@exemplo.com"
  // ... outros campos do perfil
}
```

### Check-in Diário

#### Obter Dados do Check-in
```http
GET /api/mobile/daily-checkin?protocolId=protocol_id
Authorization: Bearer seu_jwt_token
```

#### Enviar Check-in
```http
POST /api/mobile/daily-checkin
Authorization: Bearer seu_jwt_token
Content-Type: application/json

{
  "protocolId": "protocol_id",
  "responses": [
    {
      "questionId": "id_da_questao",
      "answer": "resposta"
    }
  ]
}
```

### Relatórios de Sintomas

#### Listar Relatórios
```http
GET /api/mobile/symptom-reports?protocolId=protocol_id&limit=20&offset=0
Authorization: Bearer seu_jwt_token
```

## Tratamento de Erros

A API retorna os seguintes códigos de status HTTP:

- 200: Sucesso
- 400: Erro de validação ou requisição inválida
- 401: Não autorizado (token inválido ou expirado)
- 403: Acesso proibido
- 404: Recurso não encontrado
- 500: Erro interno do servidor

## Exemplo de Implementação

### JavaScript/TypeScript
```javascript
const API_URL = 'https://app.cxlus.com/api';

async function apiRequest(endpoint, options = {}) {
  try {
    // Adicionar token de autenticação se disponível
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Request Error (${endpoint}):`, error);
    throw error;
  }
}

// Exemplo de uso:
const api = {
  // Login
  login: (email, password) => 
    apiRequest('/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  // Listar protocolos
  getProtocols: () => 
    apiRequest('/api/protocols/assignments', {
      method: 'GET'
    }),

  // Obter perfil
  getProfile: () => 
    apiRequest('/api/patient/profile', {
      method: 'GET'
    })
};
```

## Boas Práticas

1. **Armazenamento Seguro do Token**
   - Armazene o token JWT de forma segura
   - Em aplicações web, use `localStorage` ou `sessionStorage`
   - Em apps móveis, use armazenamento seguro nativo

2. **Renovação de Token**
   - Implemente lógica para renovar o token antes da expiração
   - Trate erros 401 adequadamente, redirecionando para login quando necessário

3. **Tratamento de Erros**
   - Implemente tratamento de erros consistente
   - Forneça feedback adequado ao usuário
   - Mantenha logs para debugging

4. **Headers Padrão**
   - Sempre inclua `Content-Type: application/json`
   - Inclua o token JWT no header `Authorization`

5. **Validação de Dados**
   - Valide dados antes de enviar para a API
   - Trate respostas de erro adequadamente

## Considerações de Segurança

1. **Nunca armazene senhas**
   - Envie senhas apenas no login
   - Não armazene senhas localmente

2. **Proteção do Token**
   - Armazene tokens de forma segura
   - Limpe tokens ao fazer logout
   - Não envie tokens em URLs

3. **HTTPS**
   - Sempre use HTTPS para todas as requisições
   - Verifique certificados SSL

4. **Sanitização de Dados**
   - Sanitize dados de entrada
   - Valide tipos e formatos
   - Escape caracteres especiais 