const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_TIME: 60000,
    NOTIFICATION_TIMEOUT: 5000,
    LOG_RETENTION_DAYS: 30,
    JSONBIN_URL: 'https://api.jsonbin.io/v3/b/683db3318a456b7966a88cdd',
    JSONBIN_KEY: '$2a$10$/Oqg4nCgjzZhdIp./fBtxuIISi6286hxDKDKuMUUN4gfGy8CGZIMK',
    CARD_JSONBIN_URL: 'https://api.jsonbin.io/v3/b/683dd1e78561e97a501ec0e4',
    CARD_JSONBIN_KEY: '$2a$10$/Oqg4nCgjzZhdIp./fBtxuIISi6286hxDKDKuMUUN4gfGy8CGZIMK'
};

const state = {
    currentUser: null,
    loginAttempts: 0,
    loginBlockedUntil: 0,
    logs: JSON.parse(localStorage.getItem('logs')) || [],
    sessionStart: localStorage.getItem('sessionStart') || Date.now(),
    users: [],
    cards: [],
    userCards: [],
    isAdmin: false,
    theme: localStorage.getItem('theme') || 'dark'
};

// Validações de input
function validateCardNumber(cardNumber) {
    const regex = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/;
    return regex.test(cardNumber);
}

function validateCvv(cvv) {
    return /^\d{3}$/.test(cvv);
}

function validateExpiry(expiry) {
    const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!regex.test(expiry)) return false;
    const [month, year] = expiry.split('/');
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    return parseInt(year) >= currentYear && (parseInt(year) > currentYear || parseInt(month) >= currentMonth);
}

function validateCpf(cpf) {
    const regex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    return regex.test(cpf);
}

// Formatação de inputs
function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    input.value = value.trim();
}

function restrictCvv(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 3) value = value.substring(0, 3);
    input.value = value;
}

function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length > 2) value = value.substring(0, 2) + '/' + value.substring(2);
    input.value = value;
}

function formatCpf(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    input.value = value;
}

// Verifica autenticação
function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    const sessionStart = parseInt(localStorage.getItem('sessionStart') || '0');
    const sessionTimeout = CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;

    if (!currentUser) return false;

    if (Date.now() - sessionStart > sessionTimeout) {
        auth.logout();
        return false;
    }

    state.currentUser = JSON.parse(currentUser);
    state.isAdmin = state.currentUser.is_admin === true;
    return true;
}

// Exibe notificações
function showNotification(message, type = 'error') {
    const notify = document.getElementById('notifications');
    if (notify) {
        notify.innerHTML = `<div class="notification ${type}">${message}</div>`;
        setTimeout(() => notify.innerHTML = '', CONFIG.NOTIFICATION_TIMEOUT);
    }
}

// Alterna estado de botões
function toggleLoadingButton(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.textContent = 'Carregando...';
    } else {
        button.disabled = false;
        button.textContent = originalText;
    }
}

const auth = {
    async login() {
        const loginButton = document.getElementById('loginButton');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const usernameError = document.getElementById('usernameError');
        const passwordError = document.getElementById('passwordError');

        if (!usernameInput || !passwordInput || !loginButton) {
            showNotification('Erro: Elementos de entrada não encontrados.');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (usernameError) usernameError.textContent = '';
        if (passwordError) passwordError.textContent = '';

        if (!username) {
            if (usernameError) usernameError.textContent = 'Por favor, preencha o usuário.';
            showNotification('Preencha o usuário.');
            return;
        }
        if (!password) {
            if (passwordError) passwordError.textContent = 'Por favor, preencha a senha.';
            showNotification('Preencha a senha.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('Senha muito curta.');
            return;
        }

        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            showNotification(`Você está bloqueado. Tente novamente em ${timeLeft} segundos.`);
            return;
        }

        toggleLoadingButton(loginButton, true, 'Entrar');

        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            const { record } = await response.json();
            if (!record || !Array.isArray(record.users)) {
                throw new Error('Estrutura da bin de usuários inválida.');
            }
            state.users = record.users;
            const user = state.users.find(u => u.username === username && u.password === password);
            if (!user) {
                throw new Error('Usuário ou senha inválidos.');
            }
            state.currentUser = {
                username: user.username,
                balance: user.balance || 0,
                is_admin: user.is_admin || false
            };
            state.isAdmin = user.is_admin;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            localStorage.setItem('sessionStart', Date.now().toString());
            state.loginAttempts = 0;
            showNotification('Login bem-sucedido!', 'success');
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            if (passwordError) passwordError.textContent = error.message || 'Usuário ou senha inválidos.';
            showNotification(error.message || 'Erro ao conectar ao servidor.');
            state.loginAttempts++;
            if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_TIME;
                showNotification('Limite de tentativas atingido. Tente novamente após 60 segundos.');
            }
        } finally {
            toggleLoadingButton(loginButton, false, 'Entrar');
        }
    },

    async register() {
        const registerButton = document.getElementById('registerButton');
        const usernameInput = document.getElementById('newUsername');
        const passwordInput = document.getElementById('newPassword');
        const usernameError = document.getElementById('newUsernameError');
        const passwordError = document.getElementById('newPasswordError');

        if (!usernameInput || !passwordInput || !registerButton) {
            showNotification('Erro: Elementos de entrada não encontrados.');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (usernameError) usernameError.textContent = '';
        if (passwordError) passwordError.textContent = '';

        if (!username) {
            if (usernameError) usernameError.textContent = 'Por favor, preencha o usuário.';
            showNotification('Preencha o usuário.');
            return;
        }
        if (!password) {
            if (passwordError) passwordError.textContent = 'Por favor, preencha a senha.';
            showNotification('Preencha a senha.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('Senha muito curta.');
            return;
        }

        toggleLoadingButton(registerButton, true, 'Registrar');

        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            if (users.find(u => u.username === username)) {
                throw new Error('Usuário já existente.');
            }
            const newUser = { username, password, balance: 0, is_admin: false };
            users.push(newUser);
            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Registro bem-sucedido! Faça login para continuar.', 'success');
            setTimeout(() => ui.showLoginForm(), 1000);
        } catch (error) {
            if (usernameError) usernameError.textContent = error.message || 'Erro ao registrar.';
            showNotification(error.message || 'Erro ao registrar.');
        } finally {
            toggleLoadingButton(registerButton, false, 'Registrar');
        }
    },

    logout() {
        state.currentUser = null;
        state.isAdmin = false;
        state.loginAttempts = 0;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionStart');
        window.location.href = 'index.html';
    }
};

const shop = {
    async loadCards() {
        if (!state.currentUser) {
            showNotification('Você precisa estar logado para acessar os cartões.');
            window.location.href = 'index.html';
            return;
        }
        try {
            if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                throw new Error('URL ou chave da bin de cartões não configurada.');
            }
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            const { record } = await response.json();
            if (!record || !Array.isArray(record.cards) || !Array.isArray(record.userCards)) {
                throw new Error('Os cartões não estão em um formato válido.');
            }
            state.cards = record.cards;
            state.userCards = record.userCards;
            const cardList = document.getElementById('cardList');
            if (cardList) {
                ui.filterCards();
            }
        } catch (error) {
            showNotification(error.message || 'Erro ao carregar cartões.');
        }
    },

    showCardDetails(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (card) {
            document.getElementById('cardDetailsContent').innerHTML = `
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-credit-card"></i><strong>Número:</strong> ${card.numero}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-flag"></i><strong>Bandeira:</strong> ${card.bandeira}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-university"></i><strong>Banco:</strong> ${card.banco}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-star"></i><strong>Nível:</strong> ${card.nivel}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-globe"></i><strong>País:</strong> ${card.pais}</p>
                <button onclick="shop.showConfirmPurchase('${card.numero}', 10.00)" class="mt-4 w-full p-2 rounded-lg">Comprar (R$ 10.00)</button>
            `;
            document.getElementById('cardDetailsModal').classList.remove('hidden');
            document.getElementById('cardDetailsModal').classList.add('show');
        }
    },

    showConfirmPurchase(cardNumber, price) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (card) {
            document.getElementById('confirmCardDetails').innerHTML = `
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-credit-card"></i><strong>Número:</strong> ${card.numero}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-flag"></i><strong>Bandeira:</strong> ${card.bandeira}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-university"></i><strong>Banco:</strong> ${card.banco}</p>
                <p class="mb-1 flex items-center gap-2"><i class="fas fa-star"></i><strong>Nível:</strong> ${card.nivel}</p>
            `;
            document.getElementById('confirmTotalAmount').textContent = price.toFixed(2);
            document.getElementById('confirmUserBalance').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('confirmPurchaseModal').setAttribute('data-card-number', cardNumber);
            document.getElementById('confirmPurchaseModal').classList.remove('hidden');
            document.getElementById('confirmPurchaseModal').classList.add('show');
        }
    },

    async purchaseCard(cardNumber, price) {
        if (!checkAuth()) {
            showNotification('Você precisa estar logado para comprar um cartão.');
            window.location.href = 'index.html';
            return;
        }
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.');
            return;
        }
        try {
            const userResponse = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!userResponse.ok) throw new Error(`Erro HTTP: ${userResponse.status}`);
            const { record: userRecord } = await userResponse.json();
            const userIndex = userRecord.users.findIndex(u => u.username === state.currentUser.username);
            if (userIndex === -1) throw new Error('Usuário não encontrado.');

            const cardResponse = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!cardResponse.ok) throw new Error(`Erro HTTP: ${cardResponse.status}`);
            const { record: cardRecord } = await cardResponse.json();
            const cards = cardRecord.cards || [];
            const userCards = cardRecord.userCards || [];

            userRecord.users[userIndex].balance -= price;
            state.currentUser.balance = userRecord.users[userIndex].balance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

            const card = cards.find(c => c.numero === cardNumber);
            if (!card) throw new Error('Cartão não encontrado.');

            cards.splice(cards.findIndex(c => c.numero === cardNumber), 1);
            userCards.push({
                user: state.currentUser.username,
                numero: card.numero,
                cvv: card.cvv,
                validade: card.validade,
                nome: card.nome,
                cpf: card.cpf,
                bandeira: card.bandeira,
                banco: card.banco,
                pais: card.pais,
                nivel: card.nivel,
                bin: card.bin
            });

            const updateUserResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify(userRecord)
            });
            if (!updateUserResponse.ok) throw new Error(`Erro HTTP: ${updateUserResponse.status}`);

            const updateCardResponse = await fetch(CONFIG.CARD_JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.CARD_JSONBIN_KEY
                },
                body: JSON.stringify({ cards, userCards })
            });
            if (!updateCardResponse.ok) throw new Error(`Erro HTTP: ${updateCardResponse.status}`);

            state.cards = cards;
            state.userCards = userCards;
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            ui.loadUserCards();
            ui.loadUserCardsWallet();
            ui.filterCards();
            showNotification('Compra realizada com sucesso!', 'success');
            document.getElementById('confirmPurchaseModal').classList.add('hidden');
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    }
};

const admin = {
    async loadUsers() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado. Apenas admin.', 'error');
            window.location.href = 'shop.html';
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: {闻言('X-Master-Key': CONFIG.JSONBIN_KEY })
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.users = record.users || [];
            ui.displayUsers();
        } catch (error) {
            showNotification(error.message || 'Erro ao carregar usuários.');
        }
    },

    async loadAdminCards() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado. Apenas admin.', 'error');
            window.location.href = 'shop.html';
            return;
        }
        try {
            if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                throw new Error('URL ou chave da bin de cartões não configurada.');
            }
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.cards = record.cards || [];
            ui.displayAdminCards();
        } catch (error) {
            showNotification(error.message || 'Erro ao carregar cartões.');
        }
    },

    async editUserBalance() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado. Apenas admin.');
            return;
        }
        const modal = document.getElementById('editBalanceModal');
        const username = modal.getAttribute('data-username');
        const newBalance = parseFloat(document.getElementById('editBalanceAmount').value.trim());

        if (isNaN(newBalance) || newBalance < 0) {
            showNotification('Digite um saldo válido.');
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

            users[userIndex].balance = newBalance;
            if (state.currentUser.username === username) {
                state.currentUser.balance = newBalance;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            }

            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);

            showNotification('Saldo atualizado com sucesso!', 'success');
            ui.closeModal();
            admin.loadUsers();
            if (document.getElementById('userBalanceHeader')) {
                document.getElementById('userBalanceHeader').textContent = newBalance.toFixed(2);
            }
            if (document.getElementById('userBalanceAccount')) {
                document.getElementById('userBalanceAccount').textContent = `R$ ${newBalance.toFixed(2)}`;
            }
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    async deleteUser(username) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado. Apenas admin.');
            return;
        }
        if (username === state.currentUser.username) {
            showNotification('Você não pode excluir sua própria conta.');
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const users = record.users || [];
            const updatedUsers = users.filter(u => u.username !== username);

            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users: updatedUsers })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Usuário removido com sucesso!', 'success');
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    async deleteCard(cardNumber) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado. Apenas admin.');
            return;
        }
        try {
            if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                throw new Error('URL ou chave do bin de cartões não configurada.');
            }
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            const cards = record.cards || [];
            const userCards = record.userCards || [];
            const updatedCards = cards.filter(c => c.numero !== cardNumber);

            const updateResponse = await fetch(CONFIG.CARD_JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.CARD_JSONBIN_KEY
                },
                body: JSON.stringify({ cards: updatedCards, userCards })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Cartão removido com sucesso!', 'success');
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    }
};

const ui = {
    showLoginForm() {
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('registerContainer').style.display = 'none';
    },

    showRegisterForm() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('registerContainer').style.display = 'block';
    },

    displayUsers() {
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = '';
            state.users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'card-item';
                userElement.innerHTML = `
                    <div>
                        <p class="flex items-center gap-2"><i class="fas fa-user"></i><strong>Usuário:</strong> ${user.username}</p>
                        <p class="flex items-center gap-2"><i class="fas fa-coins"></i><strong>Saldo:</strong> R$ ${user.balance.toFixed(2)}</p>
                        <p class="flex items-center gap-2"><i class="fas fa-crown"></i><strong>Admin:</strong> ${user.is_admin ? 'Sim' : 'Não'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="action-button" onclick="ui.showEditBalanceModal('${user.username}')">Editar</button>
                        <button class="delete-button" onclick="admin.deleteUser('${user.username}')">Excluir</button>
                    </div>
                `;
                userList.appendChild(userElement);
            });
        }
    },

    showEditBalanceModal(username) {
        const modal = document.getElementById('editBalanceModal');
        modal.setAttribute('data-username', username);
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },

    displayAdminCards() {
        const cardList = document.getElementById('adminCardList');
        if (cardList) {
            cardList.innerHTML = '';
            state.cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item';
                cardElement.innerHTML = `
                    <div>
                        <p class="flex items-center gap-2"><i class="fas fa-credit-card"></i><strong>Número:</strong> ${card.number}</p>
                        <p class="flex items-center gap-2"><i class="fas fa-flag"></i><strong>Bandeira:</strong> ${card.bandeira}</p>
                        <p class="flex items-center gap-2"><i class="fas fa-university"></i><strong>Banco:</strong> ${card.banco}</p>
                        <p class="flex items-center gap-2"><i class="fas fa-star"></i><strong>Nível:</strong> ${card.nivel}</p>
                    </div>
                    <div>
                        <button class="delete-button" onclick="admin.deleteCard('${card.numero}')">Excluir</button>
                    </div>
                `;
                cardList.appendChild(cardElement);
            });
        }
    },

    async addUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const balance = parseFloat(document.getElementById('newBalance').value.trim()) || 0;
        const isAdmin = document.getElementById('isAdmin').value === 'true';

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            showNotification(`A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
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
            const newUser = { username, password, balance, is_admin: isAdmin }; // TODO: Criptografar senha em produção (e.g., com bcrypt)
            users.push(newUser);
            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);
            showNotification('Usuário adicionado com sucesso!', 'success');
            ui.closeModal();
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    async saveCard() {
        const cardData = {
            number: document.getElementById('cardNumber').value.trim(),
            cvv: document.getElementById('cardCvv').value.trim(),
            validade: document.getElementById('cardExpiry').value.trim(),
            nome: document.getElementById('cardName').value.trim(),
            cpf: document.getElementById('cardCpf').value.trim(),
            bandeir: document.getElementById('cardBrand').value,
            banco: document.getElementById('cardBank').value.trim(),
            pais: document.getElementById('cardCountry').value.trim(),
            nivel: document.getElementById('cardLevel').value.trim(),
            bin: document.getElementById('cardNumber').value.trim().replace(/\s/g, '').substring(0, 6)
        };

        if (!validateCardNumber(cardData.number)) {
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
        if (!cardData.bandeira || !cardData.banco || !cardData.pais || !cardData.nivel) {
            showNotification('Por favor, preencha todos os campos obrigatórios.');
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
            if (cards.some(c => c.numero === cardData.numero)) {
                throw new Error('Cartão já cadastrado.');
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
            showNotification('Cartão adicionado com sucesso!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    filterCards() {
        const binFilter = document.getElementById('binFilter').value.trim();
        const brandFilter = document.getElementById('brandFilter').value.trim();
        const bankFilter = document.getElementById('bankFilter').value.trim();
        const levelFilter = document.getElementById('levelFilter').value.trim();

        const cardList = document.getElementById('cardList');
        if (cardList) {
            cardList.innerHTML = '';
            const filteredCards = state.cards.filter(card => {
                const matchesBin = binFilter ? card.bin.startsWith(binFilter) : true;
                const matchesBrand = brandFilter === 'all' ? true : card.bandeira === brandFilter;
                const matchesBin = bankFilter === 'all' ? true : card.banco === bankFilter;
                const matchesLevel = levelFilter === 'all' ? true : card.nivel === levelFilter;
                return matchesBin && matchesBrand && matchesBank && matchesLevel;
            });

            if (filteredCards.length === 0) {
                cardList.innerHTML = '<p class="text-center text-gray-400">Nenhum cartão disponível.</p>';
            } else {
                filteredCards.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'card-item';
                    cardElement.innerHTML = `
                        <div class="card-info">
                            <p><i class="fas fa-credit-card"></i><strong>Número:</strong> ${card.numero}</p>
                            <p><i class="fas fa-flag"></i><strong>Bandeira:</strong> ${card.bandeira}</p>
                            <p><i class="fas fa-university"></i><strong>Banco:</strong> ${card.banco}</p>
                            <p><i class="fas fa-star"></i><strong>Nível:</strong> ${card.nivel}</p>
                        </div>
                        <button class="card-button" onclick="shop.showCardDetails('${card.numero}')">Ver Detalhes</button>
                    `;
                    cardList.appendChild(cardElement);
                });
            }
        }
    },

    clearFilters() {
        document.getElementById('binFilter').value = '';
        document.getElementById('brandFilter').value = 'all';
        document.getElementById('bankFilter').value = 'all';
        document.getElementById('levelFilter').value = 'all';
        ui.filterCards();
    },

    loadUserCards() {
        const userCards = document.getElementById('userCards');
        if (userCards) {
            userCards.innerHTML = '';
            const userCardsList = state.userCards.filter(c => c.user === state.currentUser.username);
            if (userCardsList.length === 0) {
                userCards.innerHTML = '<p class="text-center text-gray-400">Você não possui nenhum cartão.</p>';
            } else {
                userCardsList.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'card-item';
                    cardElement.innerHTML = `
                        <p><i class="fas fa-credit-card"></i><strong> Número:</strong> ${card.numero}</p>
                        <p><i class="fas fa-flag"></i><strong>Bandeira:</strong> ${card.bandeira}</p>
                        <p><i class="fas fa-university"></i><strong>Banco:</strong> ${card.banco}</p>
                        <p><i class="fas fa-star"></i><strong>Nível:</strong> ${card.nivel}</p>
                    `;
                    userCards.appendChild(userElement);
                });
            }
        }
    },

    loadUserCardsWallet() {
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (userCardsWallet) {
            userCardsWallet.innerHTML = '';
            const userCardsList = state.userCards.filter(c => c.user === state.currentUser.username);
            if (userCardsList.length === 0) {
                userCardsWallet.innerHTML = '<p class="text-center text-gray-400">Carteira vazia.</p>';
            } else {
                userCardsList.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'card-item';
                    cardElement.innerHTML = `
                        <p><i class="fas fa-credit-card"></i><strong>Número:</strong> ${card.numero}</p>
                        <p><i class="fas fa-flag"></i><strong>Bandeira:</strong> ${card.bandeira}</p>
                        <p><i class="fas fa-university"></i><strong>Banco:</strong> ${card.banco}</p>
                        <p><i class="fas fa-star"></i><strong>Nível:</strong> ${card.nivel}</p>
                        <p><i class="fas fa-calendar"></i><strong>Validade:</strong> ${card.validade}</p>
                        <p><i class="fas fa-lock"></i><strong>CVV:</strong> ${card.cvv}</p>
                    `;
                    userCardsWallet.appendChild(cardElement);
                });
            }
        }
    },

    async addBalance() {
        if (!checkAuth()) {
            showNotification('Você precisa estar logado.');
            window.location.href = 'index.html';
            return;
        }
        const amountInput = document.getElementById('rechargeAmount');
        const amount = parseFloat(amountInput.value.trim());

        if (isNaN(amount) || amount <= 0) {
            showNotification('Digite um valor válido.');
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
            state.currentUser.balance = users[userIndex].balance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Match-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
                });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);

            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            showNotification('Saldo adicionado com sucesso!', 'success');
            ui.closeModal();
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    showAccountInfo() {
        if (!checkAuth()) {
            showNotification('Você precisa estar logado.');
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('cardList').classList.add('hidden');
        const accountInfo = document.getElementById('accountInfo');
        accountInfo.classList.remove('hidden');
        document.getElementById('userName').textContent = state.currentUser.username;
        document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
        ui.loadUserCards();
    },

    showAddBalanceForm() {
        document.getElementById('rechargeModal').classList.remove('hidden');
        document.getElementById('rechargeModal').classList.add('show');
    },

    showWallet() {
        if (!checkAuth()) {
            showNotification('Você precisa estar logado.');
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('walletModal').classList.remove('hidden');
        document.getElementById('walletModal').classList.add('show');
        ui.loadUserCardsWallet();
    },

    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        });
    },

    closeCardDetailsModal() {
        document.getElementById('cardDetailsModal').classList.add('hidden');
        document.getElementById('cardDetailsModal').classList.remove('show');
    },

    confirmPurchase() {
        const modal = document.getElementById('confirmPurchaseModal');
        const cardNumber = modal.getAttribute('data-card-number');
        shop.purchaseCard(cardNumber, 10.00);
    },

    closeConfirmPurchaseModal() {
        document.getElementById('confirmPurchaseModal').classList.add('hidden');
        document.getElementById('confirmPurchaseModal').classList.remove('show');
    }
};

// Inicialização para shop.html
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('shop.html')) {
        if (!checkAuth()) {
            showNotification('Você precisa estar logado.', 'error');
            window.location.href = 'index.html';
        } else {
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userName').textContent = state.currentUser.username;
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            if (state.isAdmin) {
                document.getElementById('adminButton').classList.remove('hidden');
            }
            shop.loadCards();
            ui.loadUserCards();
            ui.loadUserCardsWallet();
        }
    }
});
</script>
