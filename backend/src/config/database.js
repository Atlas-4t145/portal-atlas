const { Pool } = require('pg');

// Configuração do PostgreSQL para Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Testar conexão
pool.on('connect', () => {
    console.log('✅ Conectado ao PostgreSQL no Render');
});

pool.on('error', (err) => {
    console.error('❌ Erro na conexão PostgreSQL:', err);
});

module.exports = pool;
