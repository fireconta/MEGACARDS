const API_URL = 'https://script.google.com/macros/s/AKfycbx2DetpI-FBjWOO8vXvQfHXR4dnJCX3wmiklocFR-ppuxIBg1yKmGIUJ8lp3JN9D41jdA/exec';

/**
 * Realiza requisição à API com tratamento de erros.
 */
async function apiRequest(method, action, data = {}) {
  try {
    const url = method === 'GET' 
      ? `${API_URL}?action=${action}&${new URLSearchParams(
          Object.keys(data).reduce((acc, key) => ({
            ...acc,
            [key]: encodeURIComponent(data[key])
          }), {})
        ).toString()}`
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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`${action} error:`, error);
    throw new Error('Failed to connect to server. Please check your network or try again later.');
  }
}

/**
 * Mostra/esconde spinner e desabilita/habilita botão.
 */
function toggleButtonState(buttonId, spinnerId, disable) {
  const button = document.getElementById(buttonId);
  const spinner = document.getElementById(spinnerId);
  if (button && spinner) {
    button.disabled = disable;
    spinner.classList.toggle('d-none', !disable);
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
          errorMessage.textContent = data.message || 'Failed to login';
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
          successMessage.textContent = data.message || 'Registration successful!';
          registerForm.reset();
          alert('Registration successful! Please log in.');
        } else {
          errorMessage.textContent = data.message || 'Failed to register user';
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
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Card">
          <div class="card-body">
            <h5 class="card-title">${card.brand || ''}</h5>
            <p class="card-text">Number: ${card.cardNumber || ''}</p>
            <p class="card-text">Value: R$${card.value?.toFixed(2) || '0.00'}</p>
            <button class="btn btn-primary" onclick="purchaseCard('${card.cardNumber || ''}', ${card.value || 0})"><i class="fas fa-shopping-cart me-2"></i>Buy</button>
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
      alert('Card purchased successfully!');
    } else {
      alert('Error purchasing card: ' + (data.message || 'Unknown error'));
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
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Card">
          <div class="card-body">
            <h5 class="card-title">${card.brand || ''}</h5>
            <p class="card-text">Number: ${card.cardNumber || ''}</p>
            <p class="card-text">CVV: ${card.cvv || ''}</p>
            <p class="card-text">Expiry: ${card.expiry || ''}</p>
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
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Card">
          <div class="card-body">
            <h5 class="card-title">${card.brand || ''}</h5>
            <p class="card-text">Number: ${card.cardNumber || ''}</p>
            <p class="card-text">Value: R$${card.value?.toFixed(2) || '0.00'}</p>
            <div class="d-flex gap-2">
              <button class="btn btn-warning" onclick="editCard('${card.cardNumber || ''}')"><i class="fas fa-edit me-2"></i>Edit</button>
              <button class="btn btn-danger" onclick="deleteCard('${card.cardNumber || ''}')"><i class="fas fa-trash me-2"></i>Delete</button>
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
          alert('Card added successfully!');
        } else {
          alert('Error adding card: ' + (data.message || 'Unknown error'));
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
  const newValue = prompt('Enter new card value:');
  if (newValue && !isNaN(parseFloat(newValue))) {
    try {
      const data = await apiRequest('POST', 'editCard', { card: { cardNumber, value: parseFloat(newValue) } });
      if (data.success) {
        loadAllCards();
        alert('Card edited successfully!');
      } else {
        alert('Error editing card: ' + (data.message || 'Unknown error'));
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
  if (confirm('Are you sure you want to delete this card?')) {
    try {
      const data = await apiRequest('POST', 'deleteCard', { cardNumber });
      if (data.success) {
        loadAllCards();
        alert('Card deleted successfully!');
      } else {
        alert('Error deleting card: ' + (data.message || 'Unknown error'));
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
