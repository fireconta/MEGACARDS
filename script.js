const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/683db3318a456b7966a88cdd';
const JSONBIN_KEY = '$2a$10$/Oqg4nCgjzZhdIp./fBtxuIISi6286hxDKDKuMUUN4gfGy8CGZIMK';

/**
 * Alterna estado do botão e spinner.
 */
function toggleButtonState(buttonId, spinnerId, state) {
  const button = document.getElementById(buttonId);
  const spinner = document.getElementById(spinnerId);
  if (button && spinner) {
    button.disabled = state;
    spinner.classList.toggle('d-none', !state);
  }
}

/**
 * Função de logout
 */
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

/**
 * Carrega dados do dashboard
 */
async function loadDashboard() {
  const username = localStorage.getItem('username');
  if (username && window.location.pathname.includes('dashboard.html')) {
    try {
      const response = await fetch(`${JSONBIN_URL}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });
      if (!response.ok) throw new Error('Falha ao carregar dados');
      const { record: users } = await response.json();
      const user = users.find(u => u.username === username);
      if (!user) throw new Error('Usuário não encontrado');
      document.getElementById('usernameDisplay').textContent = user.username;
      document.getElementById('userBalance').textContent = user.balance.toFixed(2);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    }
  }
}

/**
 * Navega para a loja
 */
function goToShop() {
  window.location.href = 'shop.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // Proteger rotas
  const user = localStorage.getItem('username');
  if (!user && !window.location.pathname.includes('index.html') && !window.location.pathname.includes('404.html')) {
    window.location.href = 'index.html';
  }

  // Carregar dashboard
  loadDashboard();

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorMessage = document.getElementById('loginErrorMessage');
      errorMessage.textContent = '';
      errorMessage.style.display = 'none';
      toggleButtonState('loginButton', 'loginSpinner', true);
      try {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const response = await fetch(`${JSONBIN_URL}/latest`, {
          headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        if (!response.ok) throw new Error('Falha ao conectar ao servidor');
        const { record: users } = await response.json();
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) throw new Error('Usuário ou senha inválidos');
        localStorage.setItem('username', user.username);
        localStorage.setItem('isAdmin', user.is_admin);
        localStorage.setItem('balance', user.balance);
        window.location.href = 'dashboard.html';
      } catch (error) {
        errorMessage.textContent = error.message || 'Falha ao fazer login';
        errorMessage.style.display = 'block';
      } finally {
        toggleButtonState('loginButton', 'loginSpinner', false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const successMessage = document.getElementById('registerMessage');
      const errorMessage = document.getElementById('registerErrorMessage');
      successMessage.textContent = '';
      successMessage.style.display = 'none';
      errorMessage.textContent = '';
      errorMessage.style.display = 'none';
      toggleButtonState('registerButton', 'registerSpinner', true);
      try {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        // Carregar usuários existentes
        const response = await fetch(`${JSONBIN_URL}/latest`, {
          headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        if (!response.ok) throw new Error('Falha ao conectar ao servidor');
        const { record: users } = await response.json();
        if (users.find(u => u.username === username)) {
          throw new Error('Usuário já existe');
        }
        // Adicionar novo usuário
        const newUser = { username, password, balance: 0, is_admin: false };
        users.push(newUser);
        const updateResponse = await fetch(JSONBIN_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_KEY
          },
          body: JSON.stringify(users)
        });
        if (!updateResponse.ok) throw new Error('Falha ao registrar usuário');
        successMessage.textContent = 'Usuário registrado com sucesso!';
        successMessage.style.display = 'block';
        registerForm.reset();
        alert('Registro concluído com sucesso! Faça login para continuar.');
      } catch (error) {
        errorMessage.textContent = error.message || 'Erro ao registrar usuário';
        errorMessage.style.display = 'block';
      } finally {
        toggleButtonState('registerButton', 'registerSpinner', false);
      }
    });
  }
});
