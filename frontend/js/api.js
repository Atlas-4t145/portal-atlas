<!-- frontend/js/api.js -->
<script>
// Configuração da API para Render
const API_CONFIG = {
  BASE_URL: window.location.hostname.includes('localhost') 
    ? 'http://localhost:3001' 
    : 'https://atlas-api.onrender.com',
  
  // Conexão WebSocket
  WS_URL: window.location.hostname.includes('localhost')
    ? 'ws://localhost:3001'
    : 'wss://atlas-api.onrender.com',
  
  // Headers padrão
  getHeaders() {
    const token = localStorage.getItem('atlas_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'X-Region': 'BR'
    };
  },
  
  // Função para fazer requests
  async request(endpoint, options = {}) {
    const url = `${this.BASE_URL}${endpoint}`;
    const headers = this.getHeaders();
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });
      
      // Tratamento de erros específico para Brasil
      if (response.status === 429) {
        throw new Error('Muitas requisições. Aguarde um momento.');
      }
      
      if (response.status === 403) {
        // Redirecionar para login se token expirou
        localStorage.removeItem('atlas_token');
        window.location.href = '/login.html';
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erro na requisição');
      }
      
      return data;
    } catch (error) {
      console.error('Erro na API:', error);
      throw error;
    }
  }
};

// Conectar WebSocket
function connectWebSocket() {
  const socket = new WebSocket(API_CONFIG.WS_URL);
  
  socket.onopen = () => {
    console.log('WebSocket conectado - Atualizações em tempo real');
    
    // Enviar token de autenticação
    const token = localStorage.getItem('atlas_token');
    if (token) {
      socket.send(JSON.stringify({ type: 'auth', token }));
    }
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Atualizar interface baseado no tipo de mensagem
    switch(data.type) {
      case 'transaction-updated':
        updateTransactionUI(data.payload);
        break;
      case 'notification':
        showNotification(data.payload);
        break;
      case 'balance-updated':
        updateBalanceUI(data.payload);
        break;
    }
  };
  
  socket.onclose = () => {
    console.log('WebSocket desconectado. Reconectando em 5s...');
    setTimeout(connectWebSocket, 5000);
  };
  
  return socket;
}

// Iniciar conexão quando página carregar
document.addEventListener('DOMContentLoaded', () => {
  // Só conectar se usuário estiver logado
  if (localStorage.getItem('atlas_token')) {
    window.atlasSocket = connectWebSocket();
  }
  
  // Carregar dados da API
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    // Substituir dados mockados por API real
    const data = await API_CONFIG.request('/api/dashboard');
    
    // Atualizar toda a interface
    updateFinancialOverview(data.overview);
    updateOffenders(data.offenders);
    updateHealthScore(data.health);
    // ... etc
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    // Manter dados mockados como fallback
  }
}
</script>
