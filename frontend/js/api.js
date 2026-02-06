// frontend/js/api.js
const API_URL = 'https://atlas-database.onrender.com'; // URL do seu backend no Render

class FinancialAPI {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userId = localStorage.getItem('userId');
    }

    async request(endpoint, method = 'GET', data = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            method,
            headers,
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, config);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro na requisição');
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Autenticação
    async register(userData) {
        return this.request('/auth/register', 'POST', userData);
    }

    async login(email, password) {
        const response = await this.request('/auth/login', 'POST', { email, password });
        if (response.token) {
            this.token = response.token;
            this.userId = response.userId;
            localStorage.setItem('token', response.token);
            localStorage.setItem('userId', response.userId);
            localStorage.setItem('userName', response.name);
        }
        return response;
    }

    async logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        this.token = null;
        this.userId = null;
    }

    // Transações
    async getTransactions(month, year) {
        return this.request(`/transactions?month=${month}&year=${year}`);
    }

    async createTransaction(transaction) {
        return this.request('/transactions', 'POST', transaction);
    }

    async updateTransaction(id, transaction) {
        return this.request(`/transactions/${id}`, 'PUT', transaction);
    }

    async deleteTransaction(id) {
        return this.request(`/transactions/${id}`, 'DELETE');
    }

    // Recorrências
    async getRecurrences() {
        return this.request('/recurrences');
    }

    async createRecurrence(recurrence) {
        return this.request('/recurrences', 'POST', recurrence);
    }

    async updateRecurrence(id, recurrence) {
        return this.request(`/recurrences/${id}`, 'PUT', recurrence);
    }

    async deleteRecurrence(id) {
        return this.request(`/recurrences/${id}`, 'DELETE');
    }

    // Configurações do usuário
    async getUserSettings() {
        return this.request('/settings');
    }

    async updateUserSettings(settings) {
        return this.request('/settings', 'PUT', settings);
    }

    // Verificar autenticação
    isAuthenticated() {
        return !!this.token;
    }

    getCurrentUser() {
        return {
            id: this.userId,
            name: localStorage.getItem('userName')
        };
    }
}

// Instância global
window.financialAPI = new FinancialAPI();
