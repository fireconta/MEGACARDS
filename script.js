const API_URL = 'https://script.google.com/macros/s/AKfycbx2DetpI-FBjWOO8vX9fHXR4dnJCJS3wmiklocFR-ppuxIBg1yKmGIUJ8lp3JN9D41jdA/exec';

/**
 * Realiza requisição à API com timeout e tratamento de erros.
 */
async function apiRequest(method, action, data = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const url = method === 'GET' 
      ? `${API_URL}?action=${action}&${Object.keys(data)
          .map(key => `${key}=${encodeURIComponent(data[key])}`)
          .join('&')}`
      : API_URL;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    };
    if (method === 'POST') {
      options.body = JSON.stringify({ action, ...data });
    }
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erro na ação ${action}:`, error);
    if (error.name === 'AbortError') {
      throw new Error('Tempo de conexão excedido. Tente novamente.');
    }
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente.');
  }
}

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

document.addEventListener('DOMContentLoaded', () => {
  // Proteger rotas
  const username = localStorage.getItem('username');
  if (!username && !window.location.pathname.includes('index.html')) {
    window.location.href = 'index.html';
  }

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorMessage = document.getElementById('loginErrorMessage');
      errorMessage.textContent = '';
      toggleButtonState('loginButton', 'loginSpinner', true);
      try {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const data = await apiRequest('GET', 'login', { username, password });
        if (data.success) {
          localStorage.setItem('username', username);
          localStorage.setItem('isAdmin', data.isAdmin);
          localStorage.setItem('balance', data.balance);
          window.location.href = 'dashboard.html';
        } else {
          errorMessage.textContent = data.message || 'Falha ao fazer login';
        }
      } catch (error) {
        errorMessage.textContent = error.message;
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
      errorMessage.textContent = '';
      toggleButtonState('registerButton', 'registerSpinner', true);
      try {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const data = await apiRequest('POST', 'register', { username, password });
        if (data.success) {
          successMessage.textContent = data.message || 'Usuário registrado com sucesso!';
          registerForm.reset();
          alert('Registro concluído com sucesso! Faça login para continuar.');
        } else {
          errorMessage.textContent = data.message || 'Erro ao registrar usuário';
        }
      } catch (error) {
        errorMessage.textContent = error.message;
      } finally {
        toggleButtonState('registerButton', 'registerSpinner', false);
      }
    });
  }
});
