const CONFIG = {
    JSONBIN_URL: 'https://api.jsonbin.io/v3/b/672a90f3e41b4d270f9c23c0',
    JSONBIN_KEY: '$2a$10$v2H0FKB6qH0T8H4l0J9h6u8f6U6b6K6Q6Y6Z6a6b6c6d6e6f6g6h',
    CARD_JSONBIN_URL: 'https://api.jsonbin.io/v3/b/672a9160e41b4d270f9c23ca',
    CARD_JSONBIN_KEY: '$2a$10$v2H0FKB6qH0T8H4l0J9h6u8f6U6b6K6Q6Y6Z6a6b6c6d6e6f6g6h'
};

const state = {
    users: [],
    cards: [],
    userCards: [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    isAdmin: false
};

const auth = {
    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        if (!username || !password) {
            showNotification('Preencha todos os campos.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            const user = users.find(u => u.username === username && u.password === password);
            if (!user) {
                showNotification('Credenciais inválidas.');
                return;
            }
            state.currentUser = user;
            state.isAdmin = user.is_admin || false;
            localStorage.setItem('currentUser', JSON.stringify(user));
            window.location.href = 'shop.html';
        } catch (error) {
            showNotification(error.message);
        }
    },
    logout() {
        state.currentUser = null;
        state.isAdmin = false;
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
};

const shop = {
    async loadCards() {
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.classList.add('active');
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        try {
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.cards = record.cards || [];
            state.userCards = record.userCards || [];
            ui.displayCards();
            if (state.isAdmin) document.getElementById('adminButton').classList.remove('hidden');
            ui.updateBalance();
            if (loadingSpinner) loadingSpinner.classList.remove('active');
        } catch (error) {
            showNotification(error.message);
            if (loadingSpinner) loadingSpinner.classList.remove('active');
        }
    }
};

const admin = {
    async loadUsers() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            window.location.href = 'shop.html';
            return;
        }
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.classList.add('active');
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.users = record.users || [];
            const userList = document.getElementById('userList').querySelector('tbody');
            userList.innerHTML = '';
            state.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>R$ ${user.balance.toFixed(2)}</td>
                    <td>${user.is_admin ? 'Sim' : 'Não'}</td>
                    <td>
                        <button class="action-button" onclick="showEditUserModal('${user.username}')">Editar</button>
                        <button class="delete-button" onclick="admin.deleteUser('${user.username}')">Excluir</button>
                    </td>
                `;
                userList.appendChild(row);
            });
            if (loadingSpinner) loadingSpinner.classList.remove('active');
        } catch (error) {
            showNotification(error.message);
            if (loadingSpinner) loadingSpinner.classList.remove('active');
        }
    },
    async loadAdminCards() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            window.location.href = 'shop.html';
            return;
        }
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.classList.add('active');
        try {
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.cards = record.cards || [];
            const cardList = document.getElementById('adminCardList').querySelector('tbody');
            cardList.innerHTML = '';
            state.cards.forEach(card => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${card.numero}</td>
                    <td>${card.bandeira}</td>
                    <td>${card.banco}</td>
                    <td>${card.nivel}</td>
                    <td>
                        <button class="action-button" onclick="showEditCardModal('${card.numero}')">Editar</button>
                        <button class="delete-button" onclick="admin.deleteCard('${card.numero}')">Excluir</button>
                    </td>
                `;
                cardList.appendChild(row);
            });
            if (loadingSpinner) loadingSpinner.classList.remove('active');
        } catch (error) {
            showNotification(error.message);
            if (loadingSpinner) loadingSpinner.classList.remove('active');
        }
    },
    async deleteUser(username) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (username === state.currentUser.username) {
            showNotification('Não pode excluir o próprio usuário.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            const userIndex = users.findIndex(u => u.username === username);
            if (userIndex === -1) throw new Error('Usuário não encontrado.');
            users.splice(userIndex, 1);
            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Usuário excluído!', 'success');
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message);
        }
    },
    async deleteCard(cardNumber) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const cards = record.cards || [];
            const userCards = record.userCards || [];
            const cardIndex = cards.findIndex(c => c.numero === cardNumber);
            if (cardIndex === -1) throw new Error('Cartão não encontrado.');
            cards.splice(cardIndex, 1);
            const userCardIndex = userCards.findIndex(uc => uc.numero === cardNumber);
            if (userCardIndex !== -1) userCards.splice(userCardIndex, 1);
            const updateResponse = await fetch(CONFIG.CARD_JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.CARD_JSONBIN_KEY
                },
                body: JSON.stringify({ cards, userCards })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Cartão excluído!', 'success');
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    },
    async editUser(username, password, balance, isAdmin) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            const userIndex = users.findIndex(u => u.username === username);
            if (userIndex === -1) throw new Error('Usuário não encontrado.');
            users[userIndex].balance = balance;
            users[userIndex].is_admin = isAdmin;
            if (password) users[userIndex].password = password;
            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            if (state.currentUser.username === username) {
                state.currentUser.balance = balance;
                state.currentUser.is_admin = isAdmin;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            }
            showNotification('Usuário atualizado!', 'success');
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message);
        }
    },
    async editCard(cardData) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const cards = record.cards || [];
            const userCards = record.userCards || [];
            const cardIndex = cards.findIndex(c => c.numero === cardData.numero);
            if (cardIndex === -1) throw new Error('Cartão não encontrado.');
            cards[cardIndex] = cardData;
            const updateResponse = await fetch(CONFIG.CARD_JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.CARD_JSONBIN_KEY
                },
                body: JSON.stringify({ cards, userCards })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Cartão atualizado!', 'success');
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    }
};

const ui = {
    displayCards() {
        const cardList = document.getElementById('cardList');
        if (!cardList) return;
        cardList.innerHTML = '';
        const filteredCards = state.cards.filter(card => {
            const binFilter = document.getElementById('binFilter').value.trim().toLowerCase();
            const brandFilter = document.getElementById('brandFilter').value;
            const bankFilter = document.getElementById('bankFilter').value;
            const levelFilter = document.getElementById('levelFilter').value;
            return (!binFilter || card.bin.includes(binFilter)) &&
                   (brandFilter === 'all' || card.bandeira === brandFilter) &&
                   (bankFilter === 'all' || card.banco === bankFilter) &&
                   (levelFilter === 'all' || card.nivel === levelFilter);
        });
        filteredCards.forEach(card => {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            cardItem.innerHTML = `
                <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                <div class="card-info">
                    <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                    <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                    <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                </div>
                <button class="card-button" onclick="ui.showConfirmPurchaseModal('${card.numero}')">Comprar por R$ 10,00</button>
            `;
            cardList.appendChild(cardItem);
        });
    },
    filterCards() {
        ui.displayCards();
    },
    clearFilters() {
        document.getElementById('binFilter').value = '';
        document.getElementById('brandFilter').value = 'all';
        document.getElementById('bankFilter').value = 'all';
        document.getElementById('levelFilter').value = 'all';
        ui.displayCards();
    },
    updateBalance() {
        const balanceHeader = document.getElementById('userBalanceHeader');
        const balanceAccount = document.getElementById('userBalanceAccount');
        const confirmBalance = document.getElementById('confirmUserBalance');
        if (balanceHeader) balanceHeader.textContent = state.currentUser.balance.toFixed(2);
        if (balanceAccount) balanceAccount.textContent = state.currentUser.balance.toFixed(2);
        if (confirmBalance) confirmBalance.textContent = state.currentUser.balance.toFixed(2);
    },
    showAccountInfo() {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const userName = document.getElementById('userName');
        const balanceAccount = document.getElementById('userBalanceAccount');
        const userCards = document.getElementById('userCards');
        if (userName) userName.textContent = state.currentUser.username;
        if (balanceAccount) balanceAccount.textContent = state.currentUser.balance.toFixed(2);
        if (userCards) {
            userCards.innerHTML = '';
            const userCardList = state.userCards.filter(uc => uc.username === state.currentUser.username);
            if (userCardList.length === 0) {
                userCards.innerHTML = '<p>Nenhum cartão adquirido.</p>';
            } else {
                userCardList.forEach(uc => {
                    const card = state.cards.find(c => c.numero === uc.numero);
                    if (card) {
                        const cardItem = document.createElement('div');
                        cardItem.className = 'card-item';
                        cardItem.innerHTML = `
                            <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                            <div class="card-info">
                                <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                                <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                                <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                            </div>
                            <button class="card-button" onclick="ui.showCardDetailsModal('${card.numero}')">Ver Detalhes</button>
                        `;
                        userCards.appendChild(cardItem);
                    }
                });
            }
        }
    },
    showWallet() {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const walletModal = document.getElementById('walletModal');
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (walletModal && userCardsWallet) {
            userCardsWallet.innerHTML = '';
            const userCardList = state.userCards.filter(uc => uc.username === state.currentUser.username);
            if (userCardList.length === 0) {
                userCardsWallet.innerHTML = '<p>Nenhum cartão na carteira.</p>';
            } else {
                userCardList.forEach(uc => {
                    const card = state.cards.find(c => c.numero === uc.numero);
                    if (card) {
                        const cardItem = document.createElement('div');
                        cardItem.className = 'card-item';
                        cardItem.innerHTML = `
                            <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                            <div class="card-info">
                                <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                                <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                                <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                            </div>
                        `;
                        userCardsWallet.appendChild(cardItem);
                    }
                });
            }
            walletModal.classList.remove('hidden');
            walletModal.classList.add('show');
        }
    },
    showConfirmPurchaseModal(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const modal = document.getElementById('confirmPurchaseModal');
        const confirmDetails = document.getElementById('confirmCardDetails');
        const confirmTotal = document.getElementById('confirmTotalAmount');
        const confirmBalance = document.getElementById('confirmUserBalance');
        if (modal && confirmDetails && confirmTotal && confirmBalance) {
            confirmDetails.innerHTML = `
                <p><strong>Número:</strong> ${card.numero}</p>
                <p><strong>Bandeira:</strong> ${card.bandeira}</p>
                <p><strong>Banco:</strong> ${card.banco}</p>
                <p><strong>Nível:</strong> ${card.nivel}</p>
            `;
            confirmTotal.textContent = '10.00';
            confirmBalance.textContent = state.currentUser.balance.toFixed(2);
            modal.dataset.cardNumber = cardNumber;
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    },
    async confirmPurchase() {
        const modal = document.getElementById('confirmPurchaseModal');
        const cardNumber = modal.dataset.cardNumber;
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const price = 10.00;
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.');
            return;
        }
        try {
            const cardResponse = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!cardResponse.ok) throw new Error(`Erro HTTP: ${cardResponse.status}`);
            const { record: cardRecord } = await cardResponse.json();
            const cards = cardRecord.cards || [];
            const userCards = cardRecord.userCards || [];
            const cardIndex = cards.findIndex(c => c.numero === cardNumber);
            if (cardIndex === -1) throw new Error('Cartão não encontrado.');
            userCards.push({ username: state.currentUser.username, numero: cardNumber });
            cards.splice(cardIndex, 1);
            const updateCardResponse = await fetch(CONFIG.CARD_JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.CARD_JSONBIN_KEY
                },
                body: JSON.stringify({ cards, userCards })
            });
            if (!updateCardResponse.ok) throw new Error(`Erro HTTP: ${updateCardResponse.status}`);
            const userResponse = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!userResponse.ok) throw new Error(`Erro HTTP: ${userResponse.status}`);
            const { record: userRecord } = await userResponse.json();
            const users = userRecord.users || [];
            const userIndex = users.findIndex(u => u.username === state.currentUser.username);
            if (userIndex === -1) throw new Error('Usuário não encontrado.');
            users[userIndex].balance -= price;
            const updateUserResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateUserResponse.ok) throw new Error(`Erro HTTP: ${updateUserResponse.status}`);
            state.currentUser.balance -= price;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = cards;
            state.userCards = userCards;
            ui.closeConfirmPurchaseModal();
            ui.updateBalance();
            ui.displayCards();
            showNotification('Compra realizada!', 'success');
        } catch (error) {
            showNotification(error.message);
        }
    },
    closeConfirmPurchaseModal() {
        const modal = document.getElementById('confirmPurchaseModal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
            modal.dataset.cardNumber = '';
        }
    },
    showCardDetailsModal(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const modal = document.getElementById('cardDetailsModal');
        const content = document.getElementById('cardDetailsContent');
        if (modal && content) {
            content.innerHTML = `
                <p><strong>Número:</strong> ${card.numero}</p>
                <p><strong>CVV:</strong> ${card.cvv}</p>
                <p><strong>Validade:</strong> ${card.validade}</p>
                <p><strong>Nome:</strong> ${card.nome}</p>
                <p><strong>CPF:</strong> ${card.cpf}</p>
                <p><strong>Bandeira:</strong> ${card.bandeira}</p>
                <p><strong>Banco:</strong> ${card.banco}</p>
                <p><strong>Nível:</strong> ${card.nivel}</p>
                <p><strong>BIN:</strong> ${card.bin}</p>
            `;
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    },
    closeCardDetailsModal() {
        const modal = document.getElementById('cardDetailsModal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    },
    showAddBalanceForm() {
        const modal = document.getElementById('rechargeModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    },
    async addBalance() {
        const amount = parseFloat(document.getElementById('rechargeAmount').value);
        if (isNaN(amount) || amount <= 0) {
            showNotification('Valor inválido.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            const userIndex = users.findIndex(u => u.username === state.currentUser.username);
            if (userIndex === -1) throw new Error('Usuário não encontrado.');
            users[userIndex].balance += amount;
            const updateUserResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateUserResponse.ok) throw new Error(`Erro HTTP: ${updateUserResponse.status}`);
            state.currentUser.balance += amount;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            ui.closeModal();
            ui.updateBalance();
            showNotification('Saldo adicionado!', 'success');
        } catch (error) {
            showNotification(error.message);
        }
    },
    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        });
    },
    async addUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const balance = parseFloat(document.getElementById('newBalance').value) || 0;
        const isAdmin = document.getElementById('newIsAdmin').value === 'true';
        if (!username || !password) {
            showNotification('Preencha todos os campos obrigatórios.');
            return;
        }
        if (isNaN(balance) || balance < 0) {
            showNotification('Saldo inválido.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            if (users.find(u => u.username === username)) {
                showNotification('Usuário já existe.');
                return;
            }
            users.push({ username, password, balance, is_admin: isAdmin });
            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Usuário adicionado!', 'success');
            ui.closeModal();
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message);
        }
    },
    async saveCard() {
        const cardData = {
            numero: document.getElementById('cardNumber').value.trim(),
            cvv: document.getElementById('cardCvv').value.trim(),
            validade: document.getElementById('cardExpiry').value.trim(),
            nome: document.getElementById('cardName').value.trim(),
            cpf: document.getElementById('cardCpf').value.trim(),
            bandeira: document.getElementById('cardBrand').value,
            banco: document.getElementById('cardBank').value,
            pais: 'brasil',
            nivel: document.getElementById('cardLevel').value,
            bin: document.getElementById('cardNumber').value.trim().replace(/\s/g, '').substring(0, 6)
        };
        if (!validateCardNumber(cardData.numero)) {
            showNotification('Número de cartão inválido.');
            return;
        }
        if (!validateCvv(cardData.cvv)) {
            showNotification('CVV inválido.');
            return;
        }
        if (!validateExpiry(cardData.validade)) {
            showNotification('Validade inválida ou expirada.');
            return;
        }
        if (!validateCpf(cardData.cpf)) {
            showNotification('CPF inválido.');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            showNotification('Preencha todos os campos obrigatórios.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const cards = record.cards || [];
            const userCards = record.userCards || [];
            if (cards.find(c => c.numero === cardData.numero)) {
                showNotification('Cartão já existe.');
                return;
            }
            cards.push(cardData);
            const updateResponse = await fetch(CONFIG.CARD_JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.CARD_JSONBIN_KEY
                },
                body: JSON.stringify({ cards, userCards })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Cartão adicionado!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    }
};

function checkAuth() {
    return !!state.currentUser;
}

function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = value.slice(0, 19);
}

function restrictCvv(input) {
    input.value = input.value.replace(/\D/g, '').slice(0, 3);
}

function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 2) value = value.slice(0, 2) + '/' + value.slice(2, 4);
    input.value = value.slice(0, 5);
}

function formatCpf(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 3) value = value.slice(0, 3) + '.' + value.slice(3);
    if (value.length > 7) value = value.slice(0, 7) + '.' + value.slice(7);
    if (value.length > 11) value = value.slice(0, 11) + '-' + value.slice(11);
    input.value = value.slice(0, 14);
}

function validateCardNumber(number) {
    number = number.replace(/\s/g, '');
    if (!/^\d{16}$/.test(number)) return false;
    let sum = 0;
    let even = false;
    for (let i = number.length - 1; i >= 0; i--) {
        let digit = parseInt(number[i]);
        if (even) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        even = !even;
    }
    return sum % 10 === 0;
}

function validateCvv(cvv) {
    return /^\d{3}$/.test(cvv);
}

function validateExpiry(expiry) {
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return false;
    const [month, year] = expiry.split('/').map(Number);
    if (month < 1 || month > 12) return false;
    const currentDate = new Date();
    const expiryDate = new Date(2000 + year, month - 1);
    return expiryDate > currentDate;
}

function validateCpf(cpf) {
    return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
}

function showNotification(message, type = 'error') {
    const notifications = document.getElementById('notifications');
    const content = document.createElement('div');
    div.className = `notification ${type}`;
    div.textContent = message;
    notifications.appendChild(div);
    setTimeout(() => div.remove(), timeout: 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('shop.html')) {
        shop.loadCards();
    } else if (window.location.pathname.includes('dashboard.html')) {
        admin.loadUsers();
    }
});
