// backend/routes/transactions.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Middleware de autenticação
router.use(auth);

// Obter transações do mês
router.get('/', async (req, res) => {
    try {
        const { month, year } = req.query;
        const userId = req.userId;

        let query = `
            SELECT * FROM transactions 
            WHERE user_id = $1 
            AND EXTRACT(MONTH FROM date) = $2 
            AND EXTRACT(YEAR FROM date) = $3
            ORDER BY date DESC
        `;

        const result = await pool.query(query, [userId, month, year]);

        res.json({
            transactions: result.rows,
            count: result.rowCount
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Erro ao buscar transações' });
    }
});

// Criar transação
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const {
            name, type, category, amount, date, due_day,
            installments, notes, auto_debit, master_id
        } = req.body;

        const result = await pool.query(
            `INSERT INTO transactions 
             (user_id, name, type, category, amount, date, due_day, 
              installments, notes, auto_debit, master_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [userId, name, type, category, amount, date, due_day,
             installments, notes, auto_debit, master_id]
        );

        res.status(201).json({
            message: 'Transação criada com sucesso',
            transaction: result.rows[0]
        });

    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ message: 'Erro ao criar transação' });
    }
});

// Atualizar transação
router.put('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const transactionId = req.params.id;
        const updateData = req.body;

        // Verificar se a transação pertence ao usuário
        const checkOwnership = await pool.query(
            'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
            [transactionId, userId]
        );

        if (checkOwnership.rowCount === 0) {
            return res.status(404).json({ message: 'Transação não encontrada' });
        }

        // Construir query dinâmica
        const fields = [];
        const values = [];
        let paramCount = 1;

        Object.keys(updateData).forEach(key => {
            fields.push(`${key} = $${paramCount}`);
            values.push(updateData[key]);
            paramCount++;
        });

        values.push(transactionId, userId);
        paramCount++;

        const query = `
            UPDATE transactions 
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        res.json({
            message: 'Transação atualizada com sucesso',
            transaction: result.rows[0]
        });

    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ message: 'Erro ao atualizar transação' });
    }
});

// Excluir transação
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const transactionId = req.params.id;

        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *',
            [transactionId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Transação não encontrada' });
        }

        res.json({
            message: 'Transação excluída com sucesso',
            transaction: result.rows[0]
        });

    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ message: 'Erro ao excluir transação' });
    }
});

module.exports = router;
