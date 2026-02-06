// api.js - COLOCA ESSE ARQUIVO NA MESMA PASTA
const API_URL = 'https://atlas-database.onrender.com/api';

class API {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
    }

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    clearAuth() {
        this.token = null;
        this.user = {};
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.clearAuth();
                window.location.href = 'index.html';
                return null;
            }
            
            const error = await response.json();
            throw new Error(error.error || 'Erro na requisição');
        }

        return response.json();
    }

    // Autenticação
    async login(phone, password) {
        const data = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });
        
        if (data) {
            this.setAuth(data.token, data.user);
        }
        
        return data;
    }

    async verify() {
        return this.request('/verify');
    }

    // Transações
    async getTransactions(year = null, month = null) {
        if (year && month) {
            return this.request(`/transactions/${year}/${month}`);
        }
        return this.request('/transactions');
    }

    async createTransaction(transaction) {
        return this.request('/transactions', {
            method: 'POST',
            body: JSON.stringify(transaction)
        });
    }

    async updateTransaction(id, transaction) {
        return this.request(`/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(transaction)
        });
    }

    async deleteTransaction(id) {
        return this.request(`/transactions/${id}`, {
            method: 'DELETE'
        });
    }

    // Configurações
    async getSettings() {
        return this.request('/settings');
    }

    async updateSettings(settings) {
        return this.request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // Notificações
    async markNotificationAsRead(transactionId) {
        return this.request('/notifications/read', {
            method: 'POST',
            body: JSON.stringify({ transaction_id: transactionId })
        });
    }

    async markAllNotificationsAsRead() {
        return this.request('/notifications/read-all', {
            method: 'POST'
        });
    }

    // Admin
    async getUsers() {
        return this.request('/admin/users');
    }

    async createUser(user) {
        return this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(user)
        });
    }

    async updateUser(id, user) {
        return this.request(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(user)
        });
    }

    async deleteUser(id) {
        return this.request(`/admin/users/${id}`, {
            method: 'DELETE'
        });
    }
}

// Exportar
const api = new API();
export default api;
