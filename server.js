// server.js - Backend completo para o Render
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');

// ==================== FUNÇÃO PARA GERAR PDF ====================
const PDFDocument = require('pdfkit');

async function gerarPDFCredenciais(nome, telefone, senha) {
    return new Promise((resolve) => {
        const chunks = [];
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        
        doc.on('data', chunks.push.bind(chunks));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        
        // CABEÇALHO
        doc.fontSize(25).fillColor('#2563eb').text('ATLAS FINANCEIRO', { align: 'center' });
        doc.moveDown();
        doc.fontSize(18).fillColor('#0f172a').text('Seus dados de acesso', { align: 'center' });
        doc.moveDown(2);
        
        // DADOS
        doc.fontSize(14).fillColor('#334155');
        doc.text(`Olá ${nome},`, { align: 'left' });
        doc.moveDown();
        doc.text('Sua assinatura foi confirmada! Aqui estão seus dados:', { align: 'left' });
        doc.moveDown();
        
        doc.fontSize(16).fillColor('#0f172a');
        doc.text(`📱 Telefone: ${telefone}`, { continued: false });
        doc.text(`🔑 Senha: ${senha}`);
        doc.moveDown();
        
        // LINKS
        doc.fontSize(14).fillColor('#2563eb');
        doc.text('🔗 Dashboard: https://seu-site.com/dashboard');
        doc.text('🤖 Bot: https://t.me/seu_bot');
        doc.moveDown(2);
        
        // RODAPÉ
        doc.fontSize(10).fillColor('#94a3b8').text('Guarde este PDF. Se perder, use "Esqueci senha" no dashboard.', { align: 'center' });
        
        doc.end();
    });
}


// ==================== FUNÇÃO PARA UPLOAD NA KIWIFY ====================
async function uploadPDFParaKiwify(orderId, pdfBuffer, nomeArquivo) {
    // 1. Primeiro, obter URL de upload da Kiwify
    const uploadUrl = `https://api.kiwify.com/v2/orders/${orderId}/files`;
    
    const formData = new FormData();
    formData.append('file', pdfBuffer, {
        filename: nomeArquivo,
        contentType: 'application/pdf'
    });
    formData.append('section', 'area-de-membros'); // Ou o nome da seção
    formData.append('title', 'Seus Dados de Acesso');
    
    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.KIWIFY_API_KEY}`
        },
        body: formData
    });
    
    return response.json();
}




const app = express();
app.use(cors());
app.use(express.json());

// Configuração do banco de dados Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ==================== CRIAR TABELAS AUTOMATICAMENTE ====================

async function criarTabelasSeNaoExistem() {
    try {
        console.log('🔄 Verificando/criando tabelas...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                total_savings DECIMAL(10,2) DEFAULT 0,
                savings_goal DECIMAL(10,2) DEFAULT 0,
                monthly_budget DECIMAL(10,2) DEFAULT 0,
                savings_rate DECIMAL(5,2) DEFAULT 0.3
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type VARCHAR(20) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                name VARCHAR(200) NOT NULL,
                category VARCHAR(50),
                date DATE NOT NULL,
                due_day INTEGER,
                recurrence_type VARCHAR(20),
                master_id VARCHAR(100),
                current_installment INTEGER,
                total_installments INTEGER,
                end_date DATE,
                notes TEXT,
                auto_debit BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS read_notifications (
                user_id INTEGER REFERENCES users(id),
                transaction_id INTEGER REFERENCES transactions(id),
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, transaction_id)
            )
        `);
        
        // ÚNICA TABELA NOVA - SÓ ISSO
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_categories (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL,
                icon VARCHAR(50) DEFAULT 'tag',
                color VARCHAR(20) DEFAULT '#3b82f6',
                is_default BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name, type)
            )
        `);

                // Tabela de assinaturas Kiwify
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                kiwify_subscription_id VARCHAR(100) UNIQUE,
                kiwify_order_id VARCHAR(100),
                plan_type VARCHAR(50),
                plan_frequency VARCHAR(20),
                plan_price DECIMAL(10,2),
                status VARCHAR(20) DEFAULT 'active',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                next_billing_date TIMESTAMP,
                cancelled_at TIMESTAMP,
                expired_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        
        
        console.log('✅ Tabelas verificadas/criadas com sucesso!');
        
        const adminCheck = await pool.query(
            "SELECT id FROM users WHERE phone = '11999999999'"
        );
        
        if (adminCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await pool.query(
                `INSERT INTO users (phone, email, name, password, is_admin) 
                 VALUES ($1, $2, $3, $4, $5)`,
                ['11999999999', 'admin@email.com', 'Administrador', hashedPassword, true]
            );
            console.log('✅ Usuário admin criado: 11999999999 / admin123');
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error.message);
    }
}

// Chamar a função para criar tabelas
criarTabelasSeNaoExistem();

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// Middleware de admin
const isAdmin = (req, res, next) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores' });
    }
    next();
};

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM users WHERE phone = $1',
            [phone]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Telefone ou senha incorretos' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Telefone ou senha incorretos' });
        }
        
        const token = jwt.sign(
            { 
                id: user.id, 
                phone: user.phone,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token,
            user: {
                id: user.id,
                phone: user.phone,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verificar token
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ===========================================
// ROTA PARA BUSCAR USUÁRIO POR TELEFONE
// ===========================================
app.get('/api/usuario-por-telefone/:numero', async (req, res) => {
    try {
        const numero = req.params.numero.replace(/\D/g, '');
        
        const result = await pool.query(
            'SELECT id, name, phone, email FROM users WHERE phone = $1',
            [numero]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// ==================== ROTAS DE USUÁRIOS (ADMIN) ====================

// Listar todos os usuários (apenas admin)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, phone, email, name, is_admin, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar novo usuário (apenas admin)
app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { phone, email, name, password, is_admin } = req.body;
        
        // Verificar se telefone já existe
        const phoneCheck = await pool.query(
            'SELECT id FROM users WHERE phone = $1',
            [phone]
        );
        
        if (phoneCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Telefone já cadastrado' });
        }
        
        // Verificar se email já existe
        const emailCheck = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
        }
        
        // Criptografar senha
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Inserir usuário
        const result = await pool.query(
            `INSERT INTO users (phone, email, name, password, is_admin) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, phone, email, name, is_admin, created_at`,
            [phone, email, name, hashedPassword, is_admin || false]
        );
        
        // Criar configurações padrão
        await pool.query(
            'INSERT INTO user_settings (user_id) VALUES ($1)',
            [result.rows[0].id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar usuário (apenas admin)
app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { phone, email, name, password, is_admin } = req.body;
        const userId = req.params.id;
        
        // Verificar se telefone já existe (excluindo o usuário atual)
        if (phone) {
            const phoneCheck = await pool.query(
                'SELECT id FROM users WHERE phone = $1 AND id != $2',
                [phone, userId]
            );
            
            if (phoneCheck.rows.length > 0) {
                return res.status(400).json({ error: 'Telefone já cadastrado' });
            }
        }
        
        // Verificar se email já existe (excluindo o usuário atual)
        if (email) {
            const emailCheck = await pool.query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [email, userId]
            );
            
            if (emailCheck.rows.length > 0) {
                return res.status(400).json({ error: 'E-mail já cadastrado' });
            }
        }
        
        // Montar query dinâmica
        const updateFields = [];
        const values = [];
        let valueIndex = 1;
        
        if (phone) {
            updateFields.push(`phone = $${valueIndex}`);
            values.push(phone);
            valueIndex++;
        }
        
        if (email) {
            updateFields.push(`email = $${valueIndex}`);
            values.push(email);
            valueIndex++;
        }
        
        if (name) {
            updateFields.push(`name = $${valueIndex}`);
            values.push(name);
            valueIndex++;
        }
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push(`password = $${valueIndex}`);
            values.push(hashedPassword);
            valueIndex++;
        }
        
        if (is_admin !== undefined) {
            updateFields.push(`is_admin = $${valueIndex}`);
            values.push(is_admin);
            valueIndex++;
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }
        
        values.push(userId);
        
        const result = await pool.query(
            `UPDATE users 
             SET ${updateFields.join(', ')} 
             WHERE id = $${valueIndex}
             RETURNING id, phone, email, name, is_admin, created_at`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir usuário (apenas admin)
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Verificar se é o último admin
        const user = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
        if (user.rows[0].is_admin) {
            const adminCount = await pool.query('SELECT COUNT(*) FROM users WHERE is_admin = true');
            if (adminCount.rows[0].count <= 1) {
                return res.status(400).json({ error: 'Não é possível excluir o único administrador' });
            }
        }
        
        // Excluir dependências
        await pool.query('DELETE FROM read_notifications WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
        
        // Excluir usuário
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROTAS DE TRANSAÇÕES ====================

// Obter todas as transações do usuário
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter transações por mês
app.get('/api/transactions/:year/:month', authenticateToken, async (req, res) => {
    try {
        const { year, month } = req.params;
        
        const result = await pool.query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
             AND EXTRACT(YEAR FROM date) = $2 
             AND EXTRACT(MONTH FROM date) = $3
             ORDER BY date DESC`,
            [req.user.id, year, month]
        );
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar transação
app.post('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { 
            type, amount, name, category, date, due_day, 
            recurrence_type, master_id, current_installment, 
            total_installments, end_date, notes, auto_debit 
        } = req.body;
        
        const result = await pool.query(
            `INSERT INTO transactions 
             (user_id, type, amount, name, category, date, due_day, 
              recurrence_type, master_id, current_installment, 
              total_installments, end_date, notes, auto_debit)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                req.user.id, type, amount, name, category, date, due_day,
                recurrence_type, master_id, current_installment,
                total_installments, end_date, notes, auto_debit || false
            ]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar transação
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const { 
            type, amount, name, category, date, due_day, 
            recurrence_type, master_id, current_installment, 
            total_installments, end_date, notes, auto_debit 
        } = req.body;
        
        // Verificar se a transação pertence ao usuário
        const check = await pool.query(
            'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
            [transactionId, req.user.id]
        );
        
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }
        
        const result = await pool.query(
            `UPDATE transactions SET
             type = $1, amount = $2, name = $3, category = $4, 
             date = $5, due_day = $6, recurrence_type = $7, 
             master_id = $8, current_installment = $9, 
             total_installments = $10, end_date = $11, 
             notes = $12, auto_debit = $13
             WHERE id = $14 AND user_id = $15
             RETURNING *`,
            [
                type, amount, name, category, date, due_day,
                recurrence_type, master_id, current_installment,
                total_installments, end_date, notes, auto_debit || false,
                transactionId, req.user.id
            ]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir transação
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const transactionId = req.params.id;
        
        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
            [transactionId, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }
        
        // Excluir das notificações lidas
        await pool.query(
            'DELETE FROM read_notifications WHERE transaction_id = $1 AND user_id = $2',
            [transactionId, req.user.id]
        );
        
        res.json({ message: 'Transação excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROTAS DE CONFIGURAÇÕES ====================

// Obter configurações do usuário
app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM user_settings WHERE user_id = $1',
            [req.user.id]
        );
        
        res.json(result.rows[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar configurações do usuário
app.put('/api/settings', authenticateToken, async (req, res) => {
    try {
        const { total_savings, savings_goal, monthly_budget, savings_rate } = req.body;
        
        const result = await pool.query(
            `INSERT INTO user_settings (user_id, total_savings, savings_goal, monthly_budget, savings_rate)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) 
             DO UPDATE SET 
                total_savings = EXCLUDED.total_savings,
                savings_goal = EXCLUDED.savings_goal,
                monthly_budget = EXCLUDED.monthly_budget,
                savings_rate = EXCLUDED.savings_rate
             RETURNING *`,
            [req.user.id, total_savings, savings_goal, monthly_budget, savings_rate]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROTAS DE NOTIFICAÇÕES ====================

// Marcar notificação como lida
app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        const { transaction_id } = req.body;
        
        await pool.query(
            `INSERT INTO read_notifications (user_id, transaction_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, transaction_id) DO NOTHING`,
            [req.user.id, transaction_id]
        );
        
        res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Marcar todas as notificações como lidas
app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        const upcomingResult = await pool.query(
            `SELECT t.id FROM transactions t
             WHERE t.user_id = $1 
             AND t.type = 'expense'
             AND t.date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '10 days'
             AND t.auto_debit = false
             AND NOT EXISTS (
                 SELECT 1 FROM read_notifications rn 
                 WHERE rn.transaction_id = t.id AND rn.user_id = $1
             )`,
            [req.user.id]
        );
        
        for (const row of upcomingResult.rows) {
            await pool.query(
                `INSERT INTO read_notifications (user_id, transaction_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id, transaction_id) DO NOTHING`,
                [req.user.id, row.id]
            );
        }
        
        res.json({ message: 'Todas as notificações marcadas como lidas' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TESTE DE CONEXÃO ====================

// Teste de conexão com o banco
app.get('/api/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
        res.json({ 
            status: 'online', 
            users: result.rows[0].user_count,
            port: process.env.PORT || 10000,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ==================== ROTA DE TESTE ====================
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date().toISOString() 
    });
});



// ==================== ROTAS DE INTEGRAÇÃO KIWIFY ====================

// Endpoint para receber webhooks
app.post('/api/kiwify-webhook', async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('📩 Webhook recebido:', JSON.stringify(webhookData, null, 2));
        
        // KIWIFY USA webhook_event_type, NÃO event!
        const eventType = webhookData.webhook_event_type || webhookData.event;
        
        console.log('🎯 Tipo de evento:', eventType);
        
        switch(eventType) {
            case 'order_approved':  // <-- KIWIFY USA ISSO!
            case 'purchase_approved':
            case 'subscription_created':
                await processarNovaAssinatura(webhookData);
                break;
                
            case 'subscription_cancelled':
                await processarCancelamento(webhookData);
                break;
                
            case 'subscription_expired':
                await processarExpiracao(webhookData);
                break;
                
            default:
                console.log('ℹ️ Evento não processado:', eventType);
        }
        
        res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(200).json({ error: error.message });
    }
});

// Função para processar assinatura
async function processarNovaAssinatura(data) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Pegar dados do cliente (adaptado pro formato que chegou)
        const customer = data.Customer || {};
        const subscription = data.Subscription || {};
        const product = data.Product || {};
        
        const nome = customer.full_name || 'Usuário';
        const email = customer.email;
        let telefoneRaw = customer.mobile || '';
        
        // Limpar telefone (deixar só números)
        let telefone = telefoneRaw.replace(/\D/g, '');
        
        // Se não tiver DDI, adicionar 55
        if (telefone && !telefone.startsWith('55')) {
            telefone = '55' + telefone;
        }
        
        // Se não tiver telefone, gerar um placeholder
        if (!telefone || telefone.length < 10) {
            telefone = '5511999999999';
        }
        
        // Determinar plano
        const planName = product.product_name || '';
        let planType = 'Mensal';
        let planPrice = 19.90;
        
        if (planName.toLowerCase().includes('anual')) {
            planType = 'Anual';
            planPrice = 199.90;
        }
        
        console.log('📦 Processando:', { nome, email, telefone, planType });
        
        // Verificar se usuário existe
        const userExists = await client.query(
            'SELECT id FROM users WHERE email = $1 OR phone = $2',
            [email, telefone]
        );
        
        let userId;
        let senhaGerada = null;
        
        if (userExists.rows.length > 0) {
            userId = userExists.rows[0].id;
            console.log('👤 Usuário já existe. ID:', userId);
        } else {
            // Criar novo usuário
            senhaGerada = Math.random().toString(36).slice(-8) + 
                          Math.random().toString(36).slice(-8).toUpperCase();
            const hashedPassword = await bcrypt.hash(senhaGerada, 10);
            
            const newUser = await client.query(
                `INSERT INTO users (phone, email, name, password, is_admin) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [telefone, email, nome, hashedPassword, false]
            );
            
            userId = newUser.rows[0].id;
            console.log('✅ Novo usuário criado. ID:', userId);
            console.log('🔑 SENHA GERADA:', senhaGerada); // IMPORTANTE: anotar isso!
            
            // Criar configurações padrão
            await client.query(
                'INSERT INTO user_settings (user_id) VALUES ($1)',
                [userId]
            );

                        
            // GERAR PDF E ENVIAR PARA KIWIFY
            const pdfBuffer = await gerarPDFCredenciais(nome, telefone, senhaGerada);
            await uploadPDFParaKiwify(data.order_id, pdfBuffer, `credenciais-${telefone}.pdf`);
            console.log('✅ PDF enviado para área de membros');
            
        }
        
        // Registrar assinatura
        await client.query(
            `INSERT INTO user_subscriptions 
             (user_id, kiwify_subscription_id, kiwify_order_id, plan_type, plan_price, status, next_billing_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (kiwify_subscription_id) DO NOTHING`,
            [
                userId,
                data.subscription_id || subscription.id,
                data.order_id,
                planType,
                planPrice,
                subscription.status || 'active',
                subscription.next_payment ? new Date(subscription.next_payment) : null
            ]
        );
        
        await client.query('COMMIT');
        console.log('✅ Assinatura processada com sucesso!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao processar:', error);
    } finally {
        client.release();
    }
}



// Função para processar cancelamento
async function processarCancelamento(data) {
    try {
        const subscriptionId = data.subscription_id || data.id;
        
        if (!subscriptionId) return;
        
        await pool.query(
            `UPDATE user_subscriptions 
             SET status = 'cancelled', cancelled_at = $1
             WHERE kiwify_subscription_id = $2`,
            [new Date(), subscriptionId]
        );
        
        console.log('❌ Assinatura cancelada:', subscriptionId);
        
    } catch (error) {
        console.error('❌ Erro ao processar cancelamento:', error);
    }
}

// Função para processar expiração
async function processarExpiracao(data) {
    try {
        const subscriptionId = data.subscription_id || data.id;
        
        if (!subscriptionId) return;
        
        await pool.query(
            `UPDATE user_subscriptions 
             SET status = 'expired', expired_at = $1
             WHERE kiwify_subscription_id = $2`,
            [new Date(), subscriptionId]
        );
        
        console.log('⚠️ Assinatura expirada:', subscriptionId);
        
    } catch (error) {
        console.error('❌ Erro ao processar expiração:', error);
    }
}



// ==================== INICIAR SERVIDOR ====================

const PORT = process.env.PORT || 10000;  // MUDE 3000 PARA 10000
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
