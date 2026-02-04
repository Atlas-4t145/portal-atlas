const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware básico
app.use(express.json());

// Tentar servir frontend de diferentes lugares
const frontendPaths = [
    path.join(__dirname, '../../frontend'),
    path.join(__dirname, '../frontend'),
    path.join(process.cwd(), 'frontend'),
    path.join(process.cwd(), '../frontend')
];

let frontendFound = false;
for (const frontendPath of frontendPaths) {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        console.log(`✅ Frontend encontrado em: ${frontendPath}`);
        app.use(express.static(frontendPath));
        frontendFound = true;
        break;
    }
}

// Se não encontrar frontend, criar um básico
if (!frontendFound) {
    console.log('⚠️ Frontend não encontrado. Servindo página básica.');
    
    app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Atlas Financeiro</title>
                <style>
                    body { font-family: Arial; padding: 40px; text-align: center; }
                    h1 { color: #3b82f6; }
                    .btn { background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 10px; }
                </style>
            </head>
            <body>
                <h1>🚀 Atlas Financeiro</h1>
                <p>Backend funcionando! Mas frontend não encontrado.</p>
                <p>Verifique se o arquivo <code>frontend/index.html</code> está no repositório.</p>
                <a href="/api/health" class="btn">Verificar API</a>
                <a href="https://github.com/Atlas-4t145/portal-atlas" class="btn" target="_blank">GitHub</a>
            </body>
            </html>
        `);
    });
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Atlas Financeiro',
        timestamp: new Date().toISOString(),
        frontend: frontendFound ? 'encontrado' : 'não encontrado'
    });
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando!', user: 'demo' });
});

// Default route
app.get('*', (req, res) => {
    if (frontendFound) {
        res.sendFile('index.html', { root: './frontend' });
    } else {
        res.redirect('/');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Atlas rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: https://atlas-database.onrender.com`);
});
