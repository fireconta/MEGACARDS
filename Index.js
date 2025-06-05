const CONFIG = {
    SUPABASE_URL: 'https://iritzeslrciinopmhqgn.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaXR6ZXNscmNpaW5vcG1ocWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMjYyNjAsImV4cCI6MjA2NDcwMjI2MH0.me1stNa7TUuR0tdpLlJT1hVjVvePTzReYfY8_jRO1xo',
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 4,
    NOTIFICATION_TIMEOUT_MS: 5000,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY_MS: 1000,
};

const state = {
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    sessionStart: parseInt(localStorage.getItem('sessionStart') || '0'),
};

const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const utils = {
    async withRetry(queryFn) {
        for (let i = 0; i <= CONFIG.RETRY_ATTEMPTS; i++) {
            try {
                return await queryFn();
            } catch (error) {
                if (i === CONFIG.RETRY_ATTEMPTS) throw error;
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
            }
        }
    },

    checkAuth() {
        if (!state.currentUser?.id) {
            return false;
        }
        const sessionDuration = (Date.now() - state.sessionStart) / 1000 / 60;
        if (sessionDuration > CONFIG.SESSION_TIMEOUT_MINUTES) {
            auth.logout();
            return false;
        }
        return true;
    },

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input.replace(/[<>]/g, '').replace(/&/g, '&').replace(/"/g, '"');
    },

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

const auth = {
    async login(username, password) {
        if (!username || !password) {
            ui.showError('login', 'Usuário e senha são obrigatórios.');
            return;
        }

        ui.toggleLoading('loginButton', true);
        ui.showNotification('Verificando usuário...', 'info');

        try {
            const { data: user, error } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id, username, password, balance, is_admin')
                    .eq('username', username)
                    .eq('password', password)
                    .single()
            );

            if (error || !user) {
                throw new Error('Usuário ou senha incorretos.');
            }

            state.currentUser = {
                id: user.id,
                username: user.username,
                balance: user.balance || 0,
                is_admin: user.is_admin || false
            };
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            localStorage.setItem('sessionStart', Date.now().toString());
            ui.showSuccess(`Bem-vindo, ${user.username}!`);
            ui.clearForm('login');
            setTimeout(() => window.location.href = 'Shop.html', 1000);
        } catch (error) {
            let mensagemErro = 'Erro ao conectar. Tente novamente.';
            if (error.message.includes('Usuário ou senha incorretos')) {
                mensagemErro = 'Usuário ou senha incorretos.';
            } else if (error.message.includes('network')) {
                mensagemErro = 'Sem conexão com a internet.';
            }
            ui.showError('login', mensagemErro);
        } finally {
            ui.toggleLoading('loginButton', false);
        }
    },

    async register(username, password, confirmPassword) {
        if (!username || !password || !confirmPassword) {
            ui.showError('register', 'Todos os campos são obrigatórios.');
            return;
        }

        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            ui.showError('register', `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }

        if (password !== confirmPassword) {
            ui.showError('register', 'As senhas não coincidem.');
            return;
        }

        ui.toggleLoading('registerButton', true);
        ui.showNotification('Criando conta...', 'info');

        try {
            const { data: existingUser, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .single()
            );

            if (existingUser) {
                throw new Error('Usuário já existe.');
            }

            const { error: insertError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .insert([{
                        id: utils.generateUUID(),
                        username,
                        password,
                        balance: 0,
                        is_admin: false
                    }])
            );

            if (insertError) throw insertError;

            ui.showSuccess('Conta criada! Faça login para continuar.');
            ui.clearForm('register');
            ui.toggleForms();
        } catch (error) {
            let mensagemErro = 'Erro ao registrar. Tente novamente.';
            if (error.message.includes('Usuário já existe')) {
                mensagemErro = 'Usuário já registrado.';
            } else if (error.message.includes('network')) {
                mensagemErro = 'Sem conexão com a internet.';
            }
            ui.showError('register', mensagemErro);
        } finally {
            ui.toggleLoading('registerButton', false);
        }
    },

    logout() {
        state.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionStart');
        ui.showSuccess('Logout realizado com sucesso!');
        window.location.href = 'Index.html';
    }
};

const ui = {
    showNotification(message, type = 'error') {
        const notificationsDiv = document.getElementById('notifications');
        if (!notificationsDiv) return;

        const notification = document.createElement('div');
        notification.className = `notification p-4 rounded-lg text-white shadow-lg ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`;
        notification.textContent = utils.sanitizeInput(message);
        notificationsDiv.appendChild(notification);
        setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_TIMEOUT_MS);
    },

    showError(context, message) {
        this.showNotification(message, 'error');
        const errorElement = document.getElementById(`${context}Error`);
        if (errorElement) {
            errorElement.textContent = utils.sanitizeInput(message);
            errorElement.classList.remove('hidden');
        }
    },

    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    toggleLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = isLoading;
            button.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin mr-2"></i> Carregando...'
                : button.dataset.originalText || button.innerHTML;
            if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
        }
    },

    showLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.classList.add('show');
    },

    hideLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.classList.remove('show');
    },

    toggleForms() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.toggle('hidden');
            registerContainer.classList.toggle('hidden');
            this.showNotification('Formulário alterado.', 'info');
        }
    },

    clearForm(context) {
        const fields = {
            login: ['username', 'password'],
            register: ['newUsername', 'newPassword', 'confirmPassword']
        }[context] || [];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        const errorElement = document.getElementById(`${context}Error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            auth.login(
                document.getElementById('username').value.trim(),
                document.getElementById('password').value.trim()
            );
        });
    }

    const registerButton = document.getElementById('registerButton');
    if (registerButton) {
        registerButton.addEventListener('click', () => {
            auth.register(
                document.getElementById('newUsername').value.trim(),
                document.getElementById('newPassword').value.trim(),
                document.getElementById('confirmPassword').value.trim()
            );
        });
    }

    const toggleRegister = document.getElementById('toggleRegister');
    if (toggleRegister) {
        toggleRegister.addEventListener('click', e => {
            e.preventDefault();
            ui.toggleForms();
        });
    }

    const toggleLogin = document.getElementById('toggleLogin');
    if (toggleLogin) {
        toggleLogin.addEventListener('click', e => {
            e.preventDefault();
            ui.toggleForms();
        });
    }
});
