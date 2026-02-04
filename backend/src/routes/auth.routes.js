const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

const router = express.Router();

// Registro de usuário
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('full_name').notEmpty().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, phone_number } = req.body;

    try {
        // Verificar se usuário já existe
        const userExists = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email já cadastrado'
            });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Criar usuário
        const newUser = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, phone_number) 
             VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, plan_type`,
            [email, passwordHash, full_name, phone_number]
        );

        // Criar categorias padrão para o usuário
        const defaultCategories = [
            ['Salário', 'income', 'money-bill-wave', '#10b981', null, true, newUser.rows[0].id],
            ['Alimentação', 'expense', 'utensils', '#ef4444', 800.00, true, newUser.rows[0].id],
            ['Moradia', 'expense', 'home', '#8b5cf6', 1200.00, true, newUser.rows[0].id],
            ['Transporte', 'expense', 'car', '#3b82f6', 400.00, true, newUser.rows[0].id],
            ['Lazer', 'expense', 'film', '#f59e0b', 500.00, false, newUser.rows[0].id],
            ['Saúde', 'expense', 'heartbeat', '#ec4899', 300.00, true, newUser.rows[0].id],
            ['Educação', 'expense', 'graduation-cap', '#8b5cf6', 200.00, false, newUser.rows[0].id],
        ];

        for (const category of defaultCategories) {
            await pool.query(
                `INSERT INTO categories (name, type, icon, color, budget_limit, is_essential, user_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                category
            );
        }

        // Gerar token JWT
        const token = jwt.sign(
            { id: newUser.rows[0].id, email: newUser.rows[0].email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            token,
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar usuário'
        });
    }
});

// Login
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Buscar usuário
        const userResult = await pool.query(
            'SELECT id, email, password_hash, full_name, plan_type FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        const user = userResult.rows[0];

        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                plan_type: user.plan_type
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer login'
        });
    }
});

// Verificar token
router.get('/verify', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ valid: false });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Buscar usuário no banco para confirmar que ainda existe
        const userResult = await pool.query(
            'SELECT id, email, full_name, plan_type FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ valid: false });
        }

        res.json({
            valid: true,
            user: userResult.rows[0]
        });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

module.exports = router;
