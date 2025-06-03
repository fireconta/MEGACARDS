import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { bcrypt } from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

const supabase = createClient('https://nphqfkfdjjpiqssdyanb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXxhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g');

const ui = {
    showLoginForm: () => {
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('registerContainer').classList.add('hidden');
        document.getElementById('username').focus();
    },
    showRegisterForm: () => {
        document.getElementById('registerContainer').classList.remove('hidden');
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('newUsername').focus();
    }
};

const auth = {
    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const loginButton = document.getElementById('loginButton');
        loginButton.disabled = true;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) {
                showNotification('error', 'Usuário não encontrado.');
                loginButton.disabled = false;
                return;
            }

            const isPasswordValid = await bcrypt.compare(password, data.password);
            if (!isPasswordValid) {
                showNotification('error', 'Senha incorreta.');
                loginButton.disabled = false;
                return;
            }

            localStorage.setItem('user', JSON.stringify(data));
            showNotification('success', 'Login bem-sucedido!');
            setTimeout(() => {
                window.location.href = data.is_admin ? 'dashboard.html' : 'shop.html';
            }, 1000);
        } catch (e) {
            console.error('Erro no login:', e);
            showNotification('error', 'Erro ao fazer login. Tente novamente.');
            loginButton.disabled = false;
        }
    },

    async register() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        const registerButton = document.getElementById('registerButton');
        registerButton.disabled = true;

        if (password !== confirmPassword) {
            showNotification('error', 'As senhas não coincidem.');
            registerButton.disabled = false;
            return;
        }

        try {
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (existingUser) {
                showNotification('error', 'Usuário já existe.');
                registerButton.disabled = false;
                return;
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const { data, error } = await supabase
                .from('users')
                .insert([{ username, password: hashedPassword, balance: 0, is_admin: false }])
                .select()
                .single();

            if (error) {
                showNotification('error', 'Erro ao registrar. Tente novamente.');
                registerButton.disabled = false;
                return;
            }

            localStorage.setItem('user', JSON.stringify(data));
            showNotification('success', 'Registro bem-sucedido!');
            setTimeout(() => {
                window.location.href = 'shop.html';
            }, 1000);
        } catch (e) {
            console.error('Erro no registro:', e);
            showNotification('error', 'Erro ao registrar. Tente novamente.');
            registerButton.disabled = false;
        }
    },

    logout() {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
};

function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    return !!user;
}

function showNotification(type, message) {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    container.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        ui.showLoginForm();
        if (checkAuth()) {
            showNotification('success', 'Você já está logado.');
            const user = JSON.parse(localStorage.getItem('user'));
            setTimeout(() => {
                window.location.href = user.is_admin ? 'dashboard.html' : 'shop.html';
            }, 1000);
        }
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => updateButtonState(input.closest('form').id));
        });
    } catch (e) {
        console.error('Erro ao inicializar:', e);
        document.getElementById('errorFallback').classList.add('show');
    }
});

function updateButtonState(formId) {
    const form = document.getElementById(formId);
    const button = form.querySelector('.action-button');
    const inputs = form.querySelectorAll('input');
    const errors = form.querySelectorAll('.error-text.show');
    let isValid = true;
    inputs.forEach(input => {
        if (!input.value.trim() || input.classList.contains('error')) {
            isValid = false;
        }
    });
    if (errors.length > 0) {
        isValid = false;
    }
    button.disabled = !isValid;
}
