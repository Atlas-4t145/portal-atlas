require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://atlas-frontend.onrender.com", "http://localhost:3000"],
    credentials: true
  }
});

// Configuração de segurança
app.use(helmet());
app.use(cors({
  origin: ["https://atlas-frontend.onrender.com", "http://localhost:3000"],
  credentials: true
}));

// Rate limiting para APIs brasileiras
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP (Brasil tem mais requests)
  message: { 
    error: 'Muitas requisições. Por favor, aguarde 15 minutos.',
    code: 'BR_RATE_LIMIT'
  }
});
app.use('/api/', limiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rota de saúde (Render precisa disso)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    server: 'atlas-api-br',
    region: 'sao-paulo',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// WebSocket para atualizações em tempo real
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);
  
  socket.on('join-user', (userId) => {
    socket.join(`user:${userId}`);
  });
  
  socket.on('new-transaction', (data) => {
    io.to(`user:${data.userId}`).emit('transaction-updated', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Rotas da API (vamos criar depois)
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/transactions', require('./src/routes/transactionRoutes'));
app.use('/api/accounts', require('./src/routes/accountRoutes'));
app.use('/api/webhooks', require('./src/routes/webhookRoutes'));

// Rota para WhatsApp Webhook (Kiwify também)
app.post('/api/webhooks/kiwify', (req, res) => {
  console.log('Webhook Kiwify recebido:', req.body);
  // Lógica de criação de usuário via pagamento
  res.status(200).json({ received: true });
});

// Rota padrão para evitar erro no Render
app.get('/', (req, res) => {
  res.redirect('https://atlas-frontend.onrender.com');
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor Atlas rodando na porta ${PORT} (Região: São Paulo)`);
  console.log(`📡 WebSocket ativo`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});
