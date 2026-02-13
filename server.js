// server.js - Backend completo para o Render
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');

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
        
        // Criar tabela users
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
        
        // Criar tabela user_settings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                total_savings DECIMAL(10,2) DEFAULT 0,
                savings_goal DECIMAL(10,2) DEFAULT 0,
                monthly_budget DECIMAL(10,2) DEFAULT 0,
                savings_rate DECIMAL(5,2) DEFAULT 0.3
            )
        `);
        
        // Criar tabela transactions
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
        
        // Criar tabela read_notifications
        await pool.query(`
            CREATE TABLE IF NOT EXISTS read_notifications (
                user_id INTEGER REFERENCES users(id),
                transaction_id INTEGER REFERENCES transactions(id),
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, transaction_id)
            )
        `);
        
        // NOVA TABELA: Categorias personalizadas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_categories (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'investment')),
                icon VARCHAR(50) DEFAULT 'tag',
                color VARCHAR(20) DEFAULT '#3b82f6',
                is_default BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name, type)
            )
        `);
        
        console.log('✅ Tabelas verificadas/criadas com sucesso!');
        
        // Criar usuário admin se não existir
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
        
        // Criar categorias padrão para admin
        await criarCategoriasPadrao();
        
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error.message);
    }
}

// Função para criar categorias padrão
async function criarCategoriasPadrao() {
    try {
        // Buscar todos os usuários que não têm categorias
        const users = await pool.query(
            `SELECT u.id FROM users u 
             WHERE NOT EXISTS (
                 SELECT 1 FROM user_categories uc WHERE uc.user_id = u.id
             )`
        );
        
        for (const user of users.rows) {
            console.log(`📦 Criando categorias padrão para usuário ${user.id}...`);
            
            // Categorias de RECEITA
            const incomeCategories = [
                { name: 'Salário', icon: 'briefcase', color: '#10b981' },
                { name: 'Freelance', icon: 'laptop-code', color: '#3b82f6' },
                { name: 'Investimentos', icon: 'chart-line', color: '#8b5cf6' },
                { name: 'Vendas', icon: 'store', color: '#f59e0b' },
                { name: 'Presentes', icon: 'gift', color: '#ec4899' },
                { name: 'Outros', icon: 'ellipsis-h', color: '#64748b' }
            ];
            
            // Categorias de DESPESA
            const expenseCategories = [
                { name: 'Alimentação', icon: 'utensils', color: '#ef4444' },
                { name: 'Moradia', icon: 'home', color: '#f97316' },
                { name: 'Transporte', icon: 'car', color: '#3b82f6' },
                { name: 'Saúde', icon: 'heartbeat', color: '#ec4899' },
                { name: 'Educação', icon: 'book', color: '#8b5cf6' },
                { name: 'Lazer', icon: 'film', color: '#f59e0b' },
                { name: 'Vestuário', icon: 'tshirt', color: '#6366f1' },
                { name: 'Assinaturas', icon: 'repeat', color: '#14b8a6' },
                { name: 'Outros', icon: 'ellipsis-h', color: '#64748b' }
            ];
            
            // Categorias de INVESTIMENTO
            const investmentCategories = [
                { name: 'Poupança', icon: 'piggy-bank', color: '#10b981' },
                { name: 'Tesouro Direto', icon: 'landmark', color: '#f59e0b' },
                { name: 'Ações', icon: 'chart-line', color: '#3b82f6' },
                { name: 'Fundos Imobiliários', icon: 'building', color: '#8b5cf6' },
                { name: 'CDB/RDB', icon: 'money-bill', color: '#ec4899' },
                { name: 'Criptomoedas', icon: 'bitcoin', color: '#f97316' }
            ];
            
            let order = 0;
            
            // Inserir receitas
            for (const cat of incomeCategories) {
                await pool.query(
                    `INSERT INTO user_categories (user_id, name, type, icon, color, is_default, display_order)
                     VALUES ($1, $2, $3, $4, $5, true, $6)`,
                    [user.id, cat.name, 'income', cat.icon, cat.color, order++]
                );
            }
            
            // Inserir despesas
            for (const cat of expenseCategories) {
                await pool.query(
                    `INSERT INTO user_categories (user_id, name, type, icon, color, is_default, display_order)
                     VALUES ($1, $2, $3, $4, $5, true, $6)`,
                    [user.id, cat.name, 'expense', cat.icon, cat.color, order++]
                );
            }
            
            // Inserir investimentos
            for (const cat of investmentCategories) {
                await pool.query(
                    `INSERT INTO user_categories (user_id, name, type, icon, color, is_default, display_order)
                     VALUES ($1, $2, $3, $4, $5, true, $6)`,
                    [user.id, cat.name, 'investment', cat.icon, cat.color, order++]
                );
            }
        }
        
        if (users.rows.length > 0) {
            console.log(`✅ Categorias padrão criadas para ${users.rows.length} usuário(s)`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar categorias padrão:', error.message);
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

// ==================== ROTAS DE CATEGORIAS PERSONALIZADAS ====================

// Obter todas as categorias do usuário
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM user_categories 
             WHERE user_id = $1 AND is_active = true 
             ORDER BY type, display_order, name`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter categorias por tipo
app.get('/api/categories/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const result = await pool.query(
            `SELECT * FROM user_categories 
             WHERE user_id = $1 AND type = $2 AND is_active = true 
             ORDER BY display_order, name`,
            [req.user.id, type]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar nova categoria
app.post('/api/categories', authenticateToken, async (req, res) => {
    try {
        const { name, type, icon, color } = req.body;
        
        if (!name || !type) {
            return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
        }
        
        // Verificar se já existe
        const check = await pool.query(
            'SELECT id FROM user_categories WHERE user_id = $1 AND name = $2 AND type = $3',
            [req.user.id, name, type]
        );
        
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
        }
        
        // Buscar maior display_order
        const orderResult = await pool.query(
            'SELECT COALESCE(MAX(display_order), 0) as max_order FROM user_categories WHERE user_id = $1 AND type = $2',
            [req.user.id, type]
        );
        const displayOrder = orderResult.rows[0].max_order + 1;
        
        const result = await pool.query(
            `INSERT INTO user_categories (user_id, name, type, icon, color, display_order, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             RETURNING *`,
            [req.user.id, name, type, icon || 'tag', color || '#3b82f6', displayOrder]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar categoria (EDITAR)
app.put('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, icon, color, display_order } = req.body;
        
        // Verificar se pertence ao usuário
        const check = await pool.query(
            'SELECT * FROM user_categories WHERE id = $1 AND user_id = $2',
            [categoryId, req.user.id]
        );
        
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }
        
        const category = check.rows[0];
        
        // Verificar nome duplicado se estiver mudando o nome
        if (name && name !== category.name) {
            const nameCheck = await pool.query(
                'SELECT id FROM user_categories WHERE user_id = $1 AND name = $2 AND type = $3 AND id != $4',
                [req.user.id, name, category.type, categoryId]
            );
            
            if (nameCheck.rows.length > 0) {
                return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
            }
        }
        
        const result = await pool.query(
            `UPDATE user_categories SET
                name = COALESCE($1, name),
                icon = COALESCE($2, icon),
                color = COALESCE($3, color),
                display_order = COALESCE($4, display_order)
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [name, icon, color, display_order, categoryId, req.user.id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir categoria
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        const check = await pool.query(
            'SELECT * FROM user_categories WHERE id = $1 AND user_id = $2',
            [categoryId, req.user.id]
        );
        
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }
        
        const category = check.rows[0];
        
        // Verificar se existem transações usando esta categoria
        const transactionsCheck = await pool.query(
            'SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND category = $2',
            [req.user.id, category.name]
        );
        
        if (parseInt(transactionsCheck.rows[0].count) > 0) {
            // Se tem transações, apenas desativar
            await pool.query(
                'UPDATE user_categories SET is_active = false WHERE id = $1',
                [categoryId]
            );
            return res.json({ message: 'Categoria desativada (possui transações vinculadas)' });
        }
        
        // Se não tem transações, excluir permanentemente
        await pool.query('DELETE FROM user_categories WHERE id = $1', [categoryId]);
        
        res.json({ message: 'Categoria excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== INICIAR SERVIDOR ====================

const PORT = process.env.PORT || 10000;  // MUDE 3000 PARA 10000
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
