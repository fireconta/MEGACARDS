const API_URL = 'https://script.google.com/macros/s/AKfycbx2DetpI-FBjWOO8vX9fHXR4dnJCJS3wmiklocFR-ppuxIBg1yKmGIUJ8lp3JN9D41jdA/exec';

/**
 * Realiza requisição à API com tratamento de erros.
 */
async function apiRequest(method, action, data = {}) {
  try {
    const url = method === 'GET' 
      ? `${API_URL}?action=${action}&${Object.keys(data)
          .map(key => `${key}=${encodeURIComponent(data[key])}`)
          .join('&')}`
      : API_URL;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (method === 'POST') {
      options.body = JSON.stringify({ action, ...data });
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erro na ação ${action}:`, error);
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente.');
  }
}

/**
 * Mostra ou esconde spinner e habilita/desabilita botão.
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

  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const balance = localStorage.getItem('balance');

  if (username && window.location.pathname.includes('dashboard.html')) {
    document.getElementById('usernameDisplay').textContent = username;
    document.getElementById('userBalance').textContent = parseFloat(balance).toFixed(2);
    loadPurchasedCards(username);
    if (isAdmin) {
      document.getElementById('adminPanel').style.display = 'block';
      loadAllCards();
      setupAddCardForm();
    }
  }

  if (username && window.location.pathname.includes('shop.html')) {
    document.getElementById('userBalance').textContent = parseFloat(balance).toFixed(2);
    loadCards();
  }
});

/**
 * Carrega cartões disponíveis.
 */
async function loadCards() {
  const cardsList = document.getElementById('cardsList');
  const loading = document.getElementById('loadingCards');
  const error = document.getElementById('cardsError');
  if (!cardsList || !loading || !error) return;

  loading.classList.remove('d-none');
  error.textContent = '';
  try {
    const cards = await apiRequest('POST', 'getCards');
    cardsList.innerHTML = '';
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'col';
      cardDiv.innerHTML = `
        <div class="card h-100">
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Cartão">
          <div class="card-body">
            <h5 class="card-title">${card.brand || ''}</h5>
            <p class="card-text">Número: ${card.cardNumber || ''}</p>
            <p class="card-text">Valor: R$${card.value?.toFixed(2) || '0.00'}</p>
            <button class="btn btn-primary" onclick="purchaseCard('${card.cardNumber || ''}', ${card.value || 0})"><i class="fas fa-shopping-cart me-1"></i> Comprar</button>
          </div>
        </div>
      `;
      cardsList.appendChild(cardDiv);
    });
  } catch (error) {
    error.textContent = error.message;
  } finally {
    loading.classList.add('d-none');
  }
}

/**
 * Realiza compra de cartão.
 */
async function purchaseCard(cardNumber, cardValue) {
  const username = localStorage.getItem('username');
  const userBalance = parseFloat(localStorage.getItem('balance'));
  try {
    const data = await apiRequest('POST', 'purchaseCard', { username, cardNumber, userBalance });
    if (data.success) {
      localStorage.setItem('balance', data.newBalance);
      document.getElementById('userBalance').textContent = data.newBalance.toFixed(2);
      loadCards();
      alert('Cartão comprado com sucesso!');
    } else {
      alert('Erro ao comprar cartão: ' + (data.message || 'Erro desconhecido'));
    }
  } catch (error) {
    alert(error.message);
  }
}

/**
 * Carrega cartões comprados.
 */
async function loadPurchasedCards(username) {
  const purchasedCards = document.getElementById('purchasedCards');
  const loading = document.getElementById('loadingPurchased');
  const error = document.getElementById('purchasedError');
  if (!purchasedCards || !loading || !error) return;

  loading.classList.remove('d-none');
  error.textContent = '';
  try {
    const cards = await apiRequest('POST', 'getPurchasedCards', { username });
    purchasedCards.innerHTML = '';
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'col';
      cardDiv.innerHTML = `
        <div class="card h-100">
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Cartão">
          <div class="card-body">
            <h5 class="card-title">${card.brand || ''}</h5>
            <p class="card-text">Número: ${card.cardNumber || ''}</p>
            <p class="card-text">CVV: ${card.cvv || ''}</p>
            <p class="card-text">Validade: ${card.expiry || ''}</p>
          </div>
        </div>
      `;
      purchasedCards.appendChild(cardDiv);
    });
  } catch (error) {
    error.textContent = error.message;
  } finally {
    loading.classList.add('d-none');
  }
}

/**
 * Carrega todos os cartões (admin).
 */
async function loadAllCards() {
  const allCards = document.getElementById('allCards');
  const loading = document.getElementById('loadingAllCards');
  const error = document.getElementById('allCardsError');
  if (!allCards || !loading || !error) return;

  loading.classList.remove('d-none');
  error.textContent = '';
  try {
    const cards = await apiRequest('POST', 'getAllCards');
    allCards.innerHTML = '';
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'col';
      cardDiv.innerHTML = `
        <div class="card h-100">
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Cartão">
          <div class="card-body">
            <h5 class="card-title">${card.brand || ''}</h5>
            <p class="card-text">Número: ${card.cardNumber || ''}</p>
            <p class="card-text">Valor: R$${card.value?.toFixed(2) || '0.00'}</p>
            <div class="d-flex gap-1">
              <button class="btn btn-primary" onclick="editCard('${card.cardNumber || ''}')"><i class="fas fa-edit me-1"></i> Editar</button>
              <button class="btn btn-danger" onclick="deleteCard('${card.cardNumber || ''}')"><i class="fas fa-trash me-1"></i> Excluir</button>
            </div>
          </div>
        </div>
      `;
      allCards.appendChild(cardDiv);
    });
  } catch (error) {
    error.textContent = error.message;
  } finally {
    loading.classList.add('d-none');
  }
}

/**
 * Configura formulário de adição de cartão.
 */
function setupAddCardForm() {
  const addCardForm = document.getElementById('addCardForm');
  if (addCardForm) {
    addCardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addCardForm);
      const card = {
        cardNumber: formData.get('cardNumber'),
        cvv: formData.get('cvv'),
        expiry: formData.get('expiry'),
        brand: formData.get('brand'),
        country: formData.get('country'),
        type: formData.get('type'),
        level: formData.get('level'),
        bin: formData.get('bin'),
        value: parseFloat(formData.get('value'))
      };
      try {
        const data = await apiRequest('POST', 'addCard', { card });
        if (data.success) {
          loadAllCards();
          addCardForm.reset();
          alert('Cartão adicionado com sucesso!');
        } else {
          alert('Erro ao adicionar cartão: ' + (data.message || 'Erro desconhecido'));
        }
      } catch (error) {
        alert(error.message);
      }
    });
  }
}

/**
 * Edita um cartão.
 */
async function editCard(cardNumber) {
  const newValue = prompt('Digite o novo valor do cartão:');
  if (newValue && !isNaN(newValue)) {
    try {
      const data = await apiRequest('POST', 'editCard', { card: { cardNumber, value: parseFloat(newValue) } });
      if (data.success) {
        loadAllCards();
        alert('Cartão editado com sucesso!');
      } else {
        alert('Erro ao editar cartão: ' + (data.message || 'Erro desconhecido'));
      }
    } catch (error) {
      alert(error.message);
    }
  }
}

/**
 * Deleta um cartão.
 */
async function deleteCard(cardNumber) {
  if (confirm('Tem certeza que deseja excluir este cartão?')) {
    try {
      const data = await apiRequest('POST', 'deleteCard', { cardNumber });
      if (data.success) {
        loadAllCards();
        alert('Cartão excluído com sucesso!');
      } else {
        alert('Erro ao excluir cartão: ' + (data.message || 'Erro desconhecido'));
      }
    } catch (error) {
      alert(error.message);
    }
  }
}

/**
 * Navega para a loja.
 */
function goToShop() {
  window.location.href = 'shop.html';
}

/**
 * Realiza logout.
 */
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}
