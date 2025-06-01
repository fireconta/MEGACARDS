const API_URL = 'https://script.google.com/macros/s/AKfycbx2DetpI-FBjWOO8vXvQfHXR4dnJCX3wmiklocFR-ppuxIBg1yKmGIUJ8lp3JN9D41jdA/exec';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', username, password })
        });
        const data = await response.json();
        if (data.success) {
          localStorage.setItem('username', username);
          localStorage.setItem('isAdmin', data.isAdmin);
          localStorage.setItem('balance', data.balance);
          window.location.href = 'dashboard.html';
        } else {
          document.getElementById('errorMessage').textContent = data.message || 'Erro ao fazer login';
        }
      } catch (error) {
        document.getElementById('errorMessage').textContent = 'Erro de conexão';
      }
    });
  }

  const username = localStorage.getItem('username');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const balance = localStorage.getItem('balance');

  if (username && window.location.pathname.includes('dashboard.html')) {
    document.getElementById('usernameDisplay').textContent = username;
    document.getElementById('userBalance').textContent = balance;
    loadPurchasedCards(username);
    if (isAdmin) {
      document.getElementById('adminPanel').style.display = 'block';
      loadAllCards();
      setupAddCardForm();
    }
  }

  if (username && window.location.pathname.includes('shop.html')) {
    document.getElementById('userBalance').textContent = balance;
    loadCards();
  }
});

async function loadCards() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getCards' })
    });
    const cards = await response.json();
    const cardsList = document.getElementById('cardsList');
    cardsList.innerHTML = '';
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'col';
      cardDiv.innerHTML = `
        <div class="card h-100">
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Card">
          <div class="card-body">
            <h5 class="card-title">${card.brand}</h5>
            <p class="card-text">Número: ${card.cardNumber}</p>
            <p class="card-text">Valor: R$${card.value.toFixed(2)}</p>
            <button class="btn btn-primary" onclick="purchaseCard('${card.cardNumber}', ${card.value})"><i class="fas fa-shopping-cart me-2"></i>Comprar</button>
          </div>
        </div>
      `;
      cardsList.appendChild(cardDiv);
    });
  } catch (error) {
    console.error('Erro ao carregar cartões:', error);
  }
}

async function purchaseCard(cardNumber, cardValue) {
  const username = localStorage.getItem('username');
  const userBalance = parseFloat(localStorage.getItem('balance'));
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'purchaseCard', username, cardNumber, userBalance })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('balance', data.newBalance);
      document.getElementById('userBalance').textContent = data.newBalance;
      loadCards();
      alert('Cartão comprado com sucesso!');
    } else {
      alert(data.message || 'Erro ao comprar cartão');
    }
  } catch (error) {
    alert('Erro de conexão');
  }
}

async function loadPurchasedCards(username) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPurchasedCards', username })
    });
    const cards = await response.json();
    const purchasedCards = document.getElementById('purchasedCards');
    purchasedCards.innerHTML = '';
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'col';
      cardDiv.innerHTML = `
        <div class="card h-100">
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Card">
          <div class="card-body">
            <h5 class="card-title">${card.brand}</h5>
            <p class="card-text">Número: ${card.cardNumber}</p>
            <p class="card-text">CVV: ${card.cvv}</p>
            <p class="card-text">Validade: ${card.expiry}</p>
          </div>
        </div>
      `;
      purchasedCards.appendChild(cardDiv);
    });
  } catch (error) {
    console.error('Erro ao carregar cartões comprados:', error);
  }
}

async function loadAllCards() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAllCards' })
    });
    const cards = await response.json();
    const allCards = document.getElementById('allCards');
    allCards.innerHTML = '';
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'col';
      cardDiv.innerHTML = `
        <div class="card h-100">
          <img src="https://via.placeholder.com/150?text=Card" class="card-img-top" alt="Card">
          <div class="card-body">
            <h5 class="card-title">${card.brand}</h5>
            <p class="card-text">Número: ${card.cardNumber}</p>
            <p class="card-text">Valor: R$${card.value.toFixed(2)}</p>
            <div class="d-flex gap-2">
              <button class="btn btn-warning" onclick="editCard('${card.cardNumber}')"><i class="fas fa-edit me-2"></i>Editar</button>
              <button class="btn btn-danger" onclick="deleteCard('${card.cardNumber}')"><i class="fas fa-trash me-2"></i>Excluir</button>
            </div>
          </div>
        </div>
      `;
      allCards.appendChild(cardDiv);
    });
  } catch (error) {
    console.error('Erro ao carregar todos os cartões:', error);
  }
}

function setupAddCardForm() {
  const addCardForm = document.getElementById('addCardForm');
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
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addCard', card })
      });
      const data = await response.json();
      if (data.success) {
        loadAllCards();
        addCardForm.reset();
        alert('Cartão adicionado com sucesso!');
      } else {
        alert(data.message || 'Erro ao adicionar cartão');
      }
    } catch (error) {
      alert('Erro de conexão');
    }
  });
}

async function editCard(cardNumber) {
  const newValue = prompt('Novo valor do cartão:');
  if (newValue) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'editCard', card: { cardNumber, value: parseFloat(newValue) } })
      });
      const data = await response.json();
      if (data.success) {
        loadAllCards();
        alert('Cartão editado com sucesso!');
      } else {
        alert(data.message || 'Erro ao editar cartão');
      }
    } catch (error) {
      alert('Erro de conexão');
    }
  }
}

async function deleteCard(cardNumber) {
  if (confirm('Tem certeza que deseja excluir este cartão?')) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteCard', cardNumber })
      });
      const data = await response.json();
      if (data.success) {
        loadAllCards();
        alert('Cartão excluído com sucesso!');
      } else {
        alert(data.message || 'Erro ao excluir cartão');
      }
    } catch (error) {
      alert('Erro de conexão');
    }
  }
}

function goToShop() {
  window.location.href = 'shop.html';
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}
