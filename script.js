const API_URL = 'https://script.google.com/macros/s/AKfycbx2DetpI-FBjWOO8vXvQfHXR4dnJCX3wmiklocFR-ppuxIBg1yKmGIUJ8lp3JN9D41jdA/exec';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;
      try {
        const response = await fetch(`${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
          method: 'GET'
        });
        const data = await response.json();
        if (data.success) {
          localStorage.setItem('username', username);
          localStorage.setItem('isAdmin', data.isAdmin);
          localStorage.setItem('balance', data.balance);
          window.location.href = 'dashboard.html';
        } else {
          document.getElementById('loginErrorMessage').textContent = data.message || 'Error logging in';
        }
      } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginErrorMessage').textContent = 'Connection error. Check network or server.';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value;
      const password = document.getElementById('registerPassword').value;
      try {
        const response = await fetch(`${API_URL}?action=register&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
          method: 'GET'
        });
        const data = await response.json();
        if (data.success) {
          document.getElementById('registerMessage').textContent = data.message || 'User registered successfully';
          document.getElementById('registerErrorMessage').textContent = '';
          registerForm.reset();
        } else {
          document.getElementById('registerErrorMessage').textContent = data.message || 'Error registering user';
          document.getElementById('registerMessage').textContent = '';
        }
      } catch (error) {
        console.error('Register error:', error);
        document.getElementById('registerErrorMessage').textContent = 'Connection error. Check network or server.';
        document.getElementById('registerMessage').textContent = '';
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
            <p class="card-text">Number: ${card.cardNumber}</p>
            <p class="card-text">Value: R$${card.value.toFixed(2)}</p>
            <button class="btn btn-primary" onclick="purchaseCard('${card.cardNumber}', ${card.value})"><i class="fas fa-shopping-cart me-2"></i>Buy</button>
          </div>
        </div>
      `;
      cardsList.appendChild(cardDiv);
    });
  } catch (error) {
    console.error('Error loading cards:', error);
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
      alert('Card purchased successfully!');
    } else {
      alert(data.message || 'Error purchasing card');
    }
  } catch (error) {
    alert('Connection error');
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
            <p class="card-text">Number: ${card.cardNumber}</p>
            <p class="card-text">CVV: ${card.cvv}</p>
            <p class="card-text">Expiry: ${card.expiry}</p>
          </div>
        </div>
      `;
      purchasedCards.appendChild(cardDiv);
    });
  } catch (error) {
    console.error('Error loading purchased cards:', error);
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
            <p class="card-text">Number: ${card.cardNumber}</p>
            <p class="card-text">Value: R$${card.value.toFixed(2)}</p>
            <div class="d-flex gap-2">
              <button class="btn btn-warning" onclick="editCard('${card.cardNumber}')"><i class="fas fa-edit me-2"></i>Edit</button>
              <button class="btn btn-danger" onclick="deleteCard('${card.cardNumber}')"><i class="fas fa-trash me-2"></i>Delete</button>
            </div>
          </div>
        </div>
      `;
      allCards.appendChild(cardDiv);
    });
  } catch (error) {
    console.error('Error loading all cards:', error);
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
        alert('Card added successfully!');
      } else {
        alert(data.message || 'Error adding card');
      }
    } catch (error) {
      alert('Connection error');
    }
  });
}

async function editCard(cardNumber) {
  const newValue = prompt('New card value:');
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
        alert('Card edited successfully!');
      } else {
        alert(data.message || 'Error editing card');
      }
    } catch (error) {
      alert('Connection error');
    }
  }
}

async function deleteCard(cardNumber) {
  if (confirm('Are you sure you want to delete this card?')) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteCard', cardNumber })
      });
      const data = await response.json();
      if (data.success) {
        loadAllCards();
        alert('Card deleted successfully!');
      } else {
        alert(data.message || 'Error deleting card');
      }
    } catch (error) {
      alert('Connection error');
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
