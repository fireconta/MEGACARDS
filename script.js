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

function showNotification(message, type = 'error') {
    const notify = document.getElementById('notifications');
    if (notify) {
        notify.innerHTML = `<div class="p-2 rounded ${type === 'error' ? 'bg-red-600' : 'bg-cyan-600'}">${message}</div>`;
        setTimeout(() => notify.innerHTML = '', CONFIG.NOTIFICATION_TIMEOUT);
    }
}

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
        console.log('Função de login chamada em ' + new Date().toLocaleString());
        const loginButton = document.getElementById('loginButton');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const usernameError = document.getElementById('usernameError');
        const passwordError = document.getElementById('passwordError');

        if (!usernameInput || !passwordInput || !loginButton) {
            console.error('Elementos de entrada não encontrados em ' + new Date().toLocaleString());
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
                const errorText = await response.text();
                throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
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
            console.log('Login bem-sucedido, redirecionando para shop.html em ' + new Date().toLocaleString());
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            console.error('Erro ao fazer login:', error.message, 'em ' + new Date().toLocaleString());
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
        console.log('Função de registro chamada em ' + new Date().toLocaleString());
        const registerButton = document.getElementById('registerButton');
        const usernameInput = document.getElementById('newUsername');
        const passwordInput = document.getElementById('newPassword');
        const usernameError = document.getElementById('newUsernameError');
        const passwordError = document.getElementById('newPasswordError');

        if (!usernameInput || !passwordInput || !registerButton) {
            console.error('Elementos de entrada de registro não encontrados.');
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
                throw new Error('Usuário já existe');
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
            console.error('Erro ao registrar:', error.message);
            if (usernameError) usernameError.textContent = error.message || 'Erro ao registrar.';
            if (passwordError) passwordError.textContent = error.message || 'Erro ao registrar.';
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
                const errorText = await response.text();
                throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
            }
            const { record } = await response.json();
            console.log('Resposta da bin de cartões:', record);
            if (!record || !Array.isArray(record.cards)) {
                throw new Error('Os cartões não estão em um formato válido. Verifique a estrutura da bin.');
            }
            state.cards = record.cards;
            console.log('Cartões carregados:', state.cards);
            const cardList = document.getElementById('cardList');
            if (cardList) {
                cardList.innerHTML = '';
                if (state.cards.length === 0) {
                    cardList.innerHTML = '<p class="text-gray-400 text-center">Nenhum cartão disponível no momento.</p>';
                } else {
                    state.cards.forEach(card => {
                        const cardElement = document.createElement('div');
                        cardElement.className = 'card-item p-4 text-left';
                        cardElement.innerHTML = `
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-300">${card.banco}</span>
                                <span class="text-white font-bold">${card.bandeira}</span>
                            </div>
                            <div class="text-2xl font-semibold mb-2">${card.numero}</div>
                            <div class="text-gray-400 mb-2">${card.nome}</div>
                            <div class="text-white font-medium mb-4">R$ ${card.balance || '0.00'}</div>
                            <div class="flex space-x-2">
                                <button onclick="shop.showCardDetails('${card.numero}')" class="card-button">Ver Detalhes</button>
                            </div>
                        `;
                        cardList.appendChild(cardElement);
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar cartões:', error);
            showNotification(error.message || 'Erro ao carregar cartões.');
        }
    },

    showCardDetails(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (card) {
            document.getElementById('cardDetailsContent').innerHTML = `
                <p class="mb-1"><strong>Número:</strong> ${card.numero}</p>
                <p class="mb-1"><strong>CVV:</strong> ${card.cvv}</p>
                <p class="mb-1"><strong>Validade:</strong> ${card.validade}</p>
                <p class="mb-1"><strong>Nome:</strong> ${card.nome}</p>
                <p class="mb-1"><strong>CPF:</strong> ${card.cpf}</p>
                <p class="mb-1"><strong>Bandeira:</strong> ${card.bandeira}</p>
                <p class="mb-1"><strong>Banco:</strong> ${card.banco}</p>
                <p class="mb-1"><strong>País:</strong> ${card.pais}</p>
                <p class="mb-1"><strong>BIN:</strong> ${card.bin}</p>
                <p class="mb-1"><strong>Nível:</strong> ${card.nivel}</p>
                <button onclick="shop.showConfirmPurchase('${card.numero}', 10.00)" class="mt-4 w-full bg-cyan-500 p-2 rounded-lg hover:bg-cyan-600 transition">Comprar (R$ 10.00)</button>
            `;
            document.getElementById('cardDetailsModal').classList.remove('hidden');
        }
    },

    showConfirmPurchase(cardNumber, price) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (card) {
            document.getElementById('confirmCardDetails').innerHTML = `
                <p class="mb-1"><strong>Número:</strong> ${card.numero}</p>
                <p class="mb-1"><strong>Bandeira:</strong> ${card.bandeira}</p>
                <p class="mb-1"><strong>Banco:</strong> ${card.banco}</p>
                <p class="mb-1"><strong>Nível:</strong> ${card.nivel}</p>
            `;
            document.getElementById('confirmTotalAmount').textContent = price.toFixed(2);
            document.getElementById('confirmUserBalance').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('confirmPurchaseModal').setAttribute('data-card-number', cardNumber);
            document.getElementById('confirmPurchaseModal').classList.remove('hidden');
        }
    },

    async purchaseCard(cardNumber, price) {
        if (!state.currentUser) {
            showNotification('Você precisa estar logado para comprar um cartão.');
            window.location.href = 'index.html';
            return;
        }
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.');
            return;
        }
        try {
            if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                throw new Error('URL ou chave da bin de cartões não configurada.');
            }
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record: userRecord } = await response.json();
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
                nome: card.nome
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
            document.getElementById('userBalanceFooter').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            ui.loadUserCardsFooter();
            shop.loadCards();
            showNotification('Compra realizada com sucesso!', 'success');
            document.getElementById('confirmPurchaseModal').classList.add('hidden');
        } catch (error) {
            console.error('Erro ao comprar cartão:', error);
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    }
};

const admin = {
    async loadUsers() {
        if (!state.isAdmin) {
            showNotification('Acesso negado. Apenas administradores podem acessar esta funcionalidade.');
            window.location.href = 'shop.html';
            return;
        }
        try {
            const response = await fetch(`${CONFIG.JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.users = record.users || [];
            ui.displayUsers();
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            showNotification('Erro ao carregar usuários.');
        }
    },

    async loadAdminCards() {
        if (!state.isAdmin) {
            showNotification('Acesso negado. Apenas administradores podem acessar esta funcionalidade.');
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
            console.error('Erro ao carregar cartões:', error);
            showNotification(error.message || 'Erro ao carregar cartões.');
        }
    },

    async editUserBalance() {
        if (!state.isAdmin) {
            showNotification('Acesso negado. Apenas administradores podem editar saldos.');
            return;
        }
        const modal = document.getElementById('editBalanceModal');
        const username = modal.getAttribute('data-username');
        const newBalance = parseFloat(document.getElementById('editBalanceAmount').value.trim());

        if (isNaN(newBalance) || newBalance < 0) {
            showNotification('Digite um valor válido para o saldo.');
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
            document.getElementById('userBalanceFooter').textContent = `R$ ${newBalance.toFixed(2)}`;
            if (document.getElementById('userBalanceAccount')) {
                document.getElementById('userBalanceAccount').textContent = `R$ ${newBalance.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Erro ao editar saldo:', error);
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    async deleteUser(username) {
        if (!state.isAdmin) {
            showNotification('Acesso negado. Apenas administradores podem excluir usuários.');
            return;
        }
        if (confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) {
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
                showNotification('Usuário excluído com sucesso!', 'success');
                admin.loadUsers();
            } catch (error) {
                console.error('Erro ao excluir usuário:', error);
                showNotification(error.message || 'Erro ao conectar ao servidor.');
            }
        }
    },

    async deleteCard(cardNumber) {
        if (!state.isAdmin) {
            showNotification('Acesso negado. Apenas administradores podem excluir cartões.');
            return;
        }
        if (confirm(`Tem certeza que deseja excluir o cartão ${cardNumber}?`)) {
            try {
                if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                    throw new Error('URL ou chave da bin de cartões não configurada.');
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
                showNotification('Cartão excluído com sucesso!', 'success');
                admin.loadAdminCards();
            } catch (error) {
                console.error('Erro ao excluir cartão:', error);
                showNotification(error.message || 'Erro ao conectar ao servidor.');
            }
        }
    }
};

const ui = {
    showLoginForm() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    },

    showRegisterForm() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    },

    displayUsers(searchTerm = '') {
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = '';
            const filteredUsers = state.users.filter(user =>
                user.username.toLowerCase().includes(searchTerm.toLowerCase())
            );
            filteredUsers.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'card-item p-4 text-left';
                userElement.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-gray-300">Usuário</span>
                        <span class="text-white font-bold">${user.username}</span>
                    </div>
                    <div class="text-white font-medium mb-2">Saldo: R$ ${user.balance.toFixed(2)}</div>
                    <div class="text-gray-400 mb-4">Admin: ${user.is_admin ? 'Sim' : 'Não'}</div>
                    <div class="flex space-x-2">
                        <button onclick="ui.showEditBalanceModal('${user.username}')" class="action-button">Editar Saldo</button>
                        <button onclick="admin.deleteUser('${user.username}')" class="delete-button">Excluir</button>
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
    },

    displayAdminCards(searchTerm = '') {
        const cardList = document.getElementById('adminCardList');
        if (cardList) {
            cardList.innerHTML = '';
            const filteredCards = state.cards.filter(card =>
                card.numero.toLowerCase().includes(searchTerm.toLowerCase())
            );
            filteredCards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item p-4 text-left';
                cardElement.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-gray-300">${card.banco}</span>
                        <span class="text-white font-bold">${card.bandeira}</span>
                    </div>
                    <div class="text-2xl font-semibold mb-2">${card.numero}</div>
                    <div class="text-gray-400 mb-2">${card.nome}</div>
                    <div class="text-white font-medium mb-4">R$ ${card.balance || '0.00'}</div>
                    <div class="flex space-x-2">
                        <button onclick="admin.deleteCard('${card.numero}')" class="delete-button">Excluir</button>
                    </div>
                `;
                cardList.appendChild(cardElement);
            });
        }
    },

    async addUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const balance = document.getElementById('newBalance').value.trim();
        const isAdmin = document.getElementById('isAdmin').value === 'true';

        if (!username || !password || !balance) {
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
            if (users.find(u => u.username === username)) {
                throw new Error('Usuário já existe');
            }
            const newUser = { username, password, balance: parseFloat(balance), is_admin: isAdmin };
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
            document.getElementById('addUserModal').classList.add('hidden');
            admin.loadUsers();
        } catch (error) {
            console.error('Erro ao adicionar usuário:', error);
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    async saveCard() {
        const cardData = {
            numero: document.getElementById('cardNumber').value.trim(),
            cvv: document.getElementById('cardCvv').value.trim(),
            validade: document.getElementById('cardExpiry').value.trim(),
            nome: document.getElementById('cardName').value.trim(),
            cpf: document.getElementById('cardCpf').value.trim(),
            bandeira: document.getElementById('cardBrand').value.trim(),
            banco: document.getElementById('cardBank').value.trim(),
            pais: document.getElementById('cardCountry').value.trim(),
            nivel: document.getElementById('cardLevel').value.trim(),
            bin: document.getElementById('cardNumber').value.trim().replace(/\s/g, '').substring(0, 6)
        };

        if (!cardData.numero || !cardData.cvv || !cardData.validade || !cardData.nome || !cardData.cpf || !cardData.bandeira || !cardData.banco || !cardData.pais || !cardData.nivel) {
            showNotification('Preencha todos os campos.');
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
            const cards = record.cards || [];
            const userCards = record.userCards || [];
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
            document.getElementById('cardModal').classList.add('hidden');
            admin.loadAdminCards();
        } catch (error) {
            console.error('Erro ao salvar cartão:', error);
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    filterCards() {
        const binFilter = document.getElementById('binFilter').value.toLowerCase();
        const brandFilter = document.getElementById('brandFilter').value.toLowerCase();
        const bankFilter = document.getElementById('bankFilter').value.toLowerCase();
        const levelFilter = document.getElementById('levelFilter').value.toLowerCase();
        const cardList = document.getElementById('cardList');
        if (cardList) {
            cardList.innerHTML = '';
            state.cards.filter(card => {
                return (binFilter === '' || card.bin.toLowerCase().includes(binFilter)) &&
                       (brandFilter === 'all' || card.bandeira.toLowerCase() === brandFilter) &&
                       (bankFilter === 'all' || card.banco.toLowerCase() === bankFilter) &&
                       (levelFilter === 'all' || card.nivel.toLowerCase() === levelFilter);
            }).forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item p-4 text-left';
                cardElement.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-gray-300">${card.banco}</span>
                        <span class="text-white font-bold">${card.bandeira}</span>
                    </div>
                    <div class="text-2xl font-semibold mb-2">${card.numero}</div>
                    <div class="text-gray-400 mb-2">${card.nome}</div>
                    <div class="text-white font-medium mb-4">R$ ${card.balance || '0.00'}</div>
                    <div class="flex space-x-2">
                        <button onclick="shop.showCardDetails('${card.numero}')" class="card-button">Ver Detalhes</button>
                    </div>
                `;
                cardList.appendChild(cardElement);
            });
        }
    },

    clearFilters() {
        document.getElementById('binFilter').value = '';
        document.getElementById('brandFilter').value = 'all';
        document.getElementById('bankFilter').value = 'all';
        document.getElementById('levelFilter').value = 'all';
        ui.filterCards();
    },

    showAccountInfo() {
        const accountInfo = document.getElementById('accountInfo');
        if (accountInfo) {
            accountInfo.classList.remove('hidden');
            accountInfo.innerHTML = `
                <h2 class="text-2xl font-bold mb-4 text-cyan-500">Minha Conta</h2>
                <div class="bg-gray-800 p-6 rounded-lg shadow-2xl">
                    <p class="mb-2"><strong>Usuário:</strong> <span id="userName">${state.currentUser.username}</span></p>
                    <p class="mb-4"><strong>Saldo:</strong> <span id="userBalanceAccount">R$ ${state.currentUser.balance.toFixed(2)}</span></p>
                    <div id="userCards" class="mt-4"></div>
                </div>
                <button onclick="ui.showAddBalanceForm()" class="mt-4 bg-cyan-500 p-2 rounded-lg hover:bg-cyan-600 transition w-full">Adicionar Saldo</button>
            `;
            ui.loadUserCards();
        }
    },

    async loadUserCards() {
        if (!state.currentUser) return;
        try {
            if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                throw new Error('URL ou chave da bin de cartões não configurada.');
            }
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.userCards = (record.userCards || []).filter(uc => uc.user === state.currentUser.username);
            const userCardsDiv = document.getElementById('userCards');
            if (userCardsDiv) {
                userCardsDiv.innerHTML = state.userCards.map(card => `
                    <div class="card-item p-4 text-left mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-gray-300">${card.banco || 'N/A'}</span>
                            <span class="text-white font-bold">${card.bandeira || 'N/A'}</span>
                        </div>
                        <div class="text-2xl font-semibold mb-2">${card.numero}</div>
                        <div class="text-gray-400 mb-2">${card.nome}</div>
                        <div class="text-white font-medium mb-4">R$ 0.00</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar cartões do usuário:', error);
            showNotification(error.message || 'Erro ao carregar cartões do usuário.');
        }
    },

    async loadUserCardsFooter() {
        if (!state.currentUser) return;
        try {
            if (!CONFIG.CARD_JSONBIN_URL || !CONFIG.CARD_JSONBIN_KEY) {
                throw new Error('URL ou chave da bin de cartões não configurada.');
            }
            const response = await fetch(`${CONFIG.CARD_JSONBIN_URL}/latest`, {
                headers: { 'X-Master-Key': CONFIG.CARD_JSONBIN_KEY }
            });
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const { record } = await response.json();
            state.userCards = (record.userCards || []).filter(uc => uc.user === state.currentUser.username);
            const userCardsList = document.getElementById('userCardsList');
            if (userCardsList) {
                userCardsList.innerHTML = state.userCards.map(card => `
                    <div class="text-sm text-gray-300">${card.numero}</div>
                `).join('');
                const userCardsFooter = document.getElementById('userCardsFooter');
                if (state.userCards.length > 0) {
                    userCardsFooter.classList.remove('hidden');
                } else {
                    userCardsFooter.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Erro ao carregar cartões do usuário:', error);
            showNotification(error.message || 'Erro ao carregar cartões do usuário.');
        }
    },

    showAddBalanceForm() {
        document.getElementById('rechargeModal').classList.remove('hidden');
    },

    closeModal() {
        document.querySelectorAll('.fixed').forEach(modal => modal.classList.add('hidden'));
    },

    async addBalance() {
        const amount = document.getElementById('rechargeAmount').value.trim();
        if (!amount || parseFloat(amount) <= 0) {
            showNotification('Digite um valor válido para recarga.');
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

            users[userIndex].balance = parseFloat(users[userIndex].balance) + parseFloat(amount);
            state.currentUser.balance = users[userIndex].balance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

            const updateResponse = await fetch(CONFIG.JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN_KEY
                },
                body: JSON.stringify({ users })
            });
            if (!updateResponse.ok) throw new Error(`Erro HTTP: ${updateResponse.status}`);

            showNotification('Saldo adicionado com sucesso!', 'success');
            document.getElementById('userBalanceFooter').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            ui.closeModal();
            ui.loadUserCardsFooter();
        } catch (error) {
            console.error('Erro ao adicionar saldo:', error);
            showNotification(error.message || 'Erro ao conectar ao servidor.');
        }
    },

    toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.className = state.theme;
        localStorage.setItem('theme', state.theme);
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.textContent = state.theme === 'dark' ? '🌙' : '☀️';
    }
};

function closeCardDetailsModal() {
    document.getElementById('cardDetailsModal').classList.add('hidden');
}

function closeConfirmPurchaseModal() {
    document.getElementById('confirmPurchaseModal').classList.add('hidden');
}

function confirmPurchase() {
    const modal = document.getElementById('confirmPurchaseModal');
    const cardNumber = modal.getAttribute('data-card-number');
    shop.purchaseCard(cardNumber, 10.00);
    closeConfirmPurchaseModal();
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    console.log('Script.js carregado em ' + new Date().toLocaleString());

    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            console.log('Botão de login clicado em ' + new Date().toLocaleString());
            auth.login();
        });
        console.log('Evento de clique adicionado ao botão de login em ' + new Date().toLocaleString());
    } else {
        console.error('Botão de login não encontrado. Verifique se o ID "loginButton" está presente no HTML.');
    }

    const registerButton = document.getElementById('registerButton');
    if (registerButton) {
        registerButton.addEventListener('click', () => {
            console.log('Botão de registro clicado em ' + new Date().toLocaleString());
            auth.register();
        });
        console.log('Evento de clique adicionado ao botão de registro em ' + new Date().toLocaleString());
    } else {
        console.error('Botão de registro não encontrado. Verifique se o ID "registerButton" está presente no HTML.');
    }

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    if (usernameInput && passwordInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo de usuário em ' + new Date().toLocaleString());
                auth.login();
            }
        });
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo de senha em ' + new Date().toLocaleString());
                auth.login();
            }
        });
    }

    const newUsernameInput = document.getElementById('newUsername');
    const newPasswordInput = document.getElementById('newPassword');
    if (newUsernameInput && newPasswordInput) {
        newUsernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo de novo usuário em ' + new Date().toLocaleString());
                auth.register();
            }
        });
        newPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo de nova senha em ' + new Date().toLocaleString());
                auth.register();
            }
        });
    }

    const page = window.location.pathname.split('/').pop();
    if (page === 'shop.html' && state.currentUser) shop.loadCards();
    if (page === 'dashboard.html' && state.currentUser) {
        if (state.isAdmin) {
            admin.loadUsers();
            admin.loadAdminCards();
        } else {
            window.location.href = 'shop.html';
        }
    }
});
