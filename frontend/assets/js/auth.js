class AuthService {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
        this.token = localStorage.getItem('atlas_token');
        this.user = JSON.parse(localStorage.getItem('atlas_user') || 'null');
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.setToken(data.token);
                this.setUser(data.user);
                return { success: true, data };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erro no registro:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    async verifyToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${this.baseUrl}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            if (data.valid) {
                this.setUser(data.user);
                return true;
            }
        } catch (error) {
            console.error('Erro na verificação do token:', error);
        }

        this.clearAuth();
        return false;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('atlas_token', token);
    }

    setUser(user) {
        this.user = user;
        localStorage.setItem('atlas_user', JSON.stringify(user));
    }

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('atlas_token');
        localStorage.removeItem('atlas_user');
    }

    getAuthHeader() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }
}

const authService = new AuthService();
