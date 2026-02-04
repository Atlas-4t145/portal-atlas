const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend - CAMINHO CORRIGIDO PARA RENDER
const frontendPath = path.join(__dirname, '../../frontend');
console.log(`📂 Procurando frontend em: ${frontendPath}`);

app.use(express.static(frontendPath));

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Atlas Financeiro API'
    });
});

// Rotas da API (simplificado por enquanto)
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando!' });
});

// Todas as outras rotas vão para o frontend
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    console.log(`📄 Servindo: ${indexPath}`);
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('❌ Erro ao servir index.html:', err);
            res.status(500).send('Erro ao carregar página');
        }
    });
});

// Middleware de erro
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Atlas rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
