const express = require('express');
const router = express.Router();

// Dashboard data
router.get('/overview', (req, res) => {
    res.json({
        success: true,
        data: {
            currentMonth: "Junho 2023",
            income: 4850.00,
            expenses: 3210.00,
            balance: 1640.00,
            savings: 12580.00,
            healthScore: 72,
            healthPreviousScore: 65
        }
    });
});

router.get('/offenders', (req, res) => {
    res.json({
        success: true,
        data: [
            { name: "Lazer e Entretenimento", amount: 1240, overBudget: 28, percentage: 38 },
            { name: "Delivery e Restaurantes", amount: 920, overBudget: 15, percentage: 29 },
            { name: "Faculdade Particular", amount: 850, installments: "5/24", dueDay: 10 },
            { name: "Plano de Saúde", amount: 480, type: "fixed", dueDay: 5 }
        ]
    });
});

router.get('/categories', (req, res) => {
    res.json({
        success: true,
        data: [
            { name: "Essenciais", amount: 1980, percentage: 62, icon: "home", type: "essential" },
            { name: "Investimentos", amount: 1200, percentage: 25, icon: "chart-line", type: "investment" },
            { name: "Recorrentes", amount: 1450, percentage: 45, icon: "redo", type: "recurring" },
            { name: "Lazer", amount: 760, percentage: 24, icon: "film", type: "leisure" }
        ]
    });
});

router.get('/recurring', (req, res) => {
    res.json({
        success: true,
        data: [
            { name: "Internet Fibra", amount: 120, type: "fixed", dueDay: 5, description: "PIX recorrente • Mensal", icon: "wifi" },
            { name: "Celular Novo", amount: 185, type: "parceled", dueDay: 15, description: "Parcela 8/12 • Loja XYZ", icon: "mobile-alt" },
            { name: "Energia Elétrica", amount: 95, type: "fixed", dueDay: 8, description: "PIX recorrente • Mensal", icon: "lightbulb" },
            { name: "Sofá Novo", amount: 210, type: "parceled", dueDay: 20, description: "Parcela 3/10 • Loja ABC", icon: "couch" },
            { name: "Academia", amount: 90, type: "fixed", dueDay: 3, description: "PIX recorrente • Mensal", icon: "dumbbell" }
        ]
    });
});

router.get('/calendar', (req, res) => {
    res.json({
        success: true,
        data: [
            { day: 1, amount: 240, status: "soon" },
            { day: 3, amount: 90, status: "today" },
            { day: 5, amount: 480, status: "today" },
            { day: 8, amount: 95, status: "today" },
            { day: 10, amount: 850, status: "today" },
            { day: 15, amount: 185, status: "today" },
            { day: 20, amount: 210, status: "today" }
        ]
    });
});

module.exports = router;
