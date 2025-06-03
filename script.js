import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_DURATION: 60000,
    NOTIFICATION_DURATION: 5000,
    SUPABASE_URL: 'https://nphqfkfdjjpiqssdyanb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXxhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g'
};

// Inicializa o cliente Supabase
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const state = {
    users: [],
    cards: [],
    userCards: [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    isAdmin: localStorage.getItem('isAdmin') === 'true',
    loginAttempts: 0,
    loginBlockedUntil: 0,
    sessionStart: parseInt(localStorage.getItem('sessionStart') || '0'),
    selectedCard: null
};

function showNotification(type, message) {
    const notifications = document.getElementById('notifications');
    if (!notifications) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    notifications.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, CONFIG.NOTIFICATION_DURATION);
}

function toggleLoadingButton(button, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    button.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i> Carregando...' : button.dataset.originalText || button.innerHTML;
    if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
}

function checkAuth() {
    if (!state.currentUser) return false;
    const sessionDuration = (Date.now() - state.sessionStart) / 1000 / 60;
    if (sessionDuration > CONFIG.SESSION_TIMEOUT_MINUTES) {
        auth.logout();
        return false;
    }
    return true;
}

const auth = {
    async login() {
        const loginButton = document.getElementById('loginButton');
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const usernameError = document.getElementById('usernameError');
        const passwordError = document.getElementById('passwordError');

        usernameError.textContent = '';
        passwordError.textContent = '';

        if (!username) {
            usernameError.textContent = 'Preencha o usuário.';
            showNotification('error', 'Preencha o usuário.');
            return;
        }
        if (!password) {
            passwordError.textContent = 'Preencha a senha.';
            showNotification('error', 'Preencha a senha.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('error', 'Senha inválida.');
            return;
        }
        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            showNotification('error', `Bloqueado. Tente novamente em ${timeLeft} segundos.`);
            return;
        }

        toggleLoadingButton(loginButton, true);

        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password);

            if (error) throw error;
            if (!users || users.length === 0) {
                state.loginAttempts++;
                if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                    state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_DURATION;
                    showNotification('error', 'Limite de tentativas atingido. Aguarde 60 segundos.');
                    passwordError.textContent = 'Conta bloqueada por 60 segundos.';
                } else {
                    showNotification('error', 'Usuário ou senha incorretos.');
                    passwordError.textContent = 'Usuário ou senha incorretos.';
                }
                return;
            }

            const user = users[0];
            state.currentUser = {
                username: user.username,
                balance: user.balance || 0,
                is_admin: user.is_admin || false
            };
            state.isAdmin = user.is_admin;
            state.loginAttempts = 0;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            localStorage.setItem('isAdmin', state.isAdmin);
            localStorage.setItem('sessionStart', Date.now().toString());
            showNotification('success', 'Login bem-sucedido!');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            showNotification('error', error.message || 'Erro ao conectar ao servidor.');
            passwordError.textContent = error.message || 'Erro ao conectar ao servidor.';
        } finally {
            toggleLoadingButton(loginButton, false);
        }
    },
    async register() {
        const registerButton = document.getElementById('registerButton');
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        const usernameError = document.getElementById('newUsernameError');
        const passwordError = document.getElementById('newPasswordError');
        const confirmPasswordError = document.getElementById('confirmPasswordError');

        usernameError.textContent = '';
        passwordError.textContent = '';
        confirmPasswordError.textContent = '';

        if (!username) {
            usernameError.textContent = 'Preencha o usuário.';
            showNotification('error', 'Preencha o usuário.');
            return;
        }
        if (!password) {
            passwordError.textContent = 'Preencha a senha.';
            showNotification('error', 'Preencha a senha.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('error', 'Senha muito curta.');
            return;
        }
        if (password !== confirmPassword) {
            confirmPasswordError.textContent = 'As senhas não coincidem.';
            showNotification('error', 'As senhas não coincidem.');
            return;
        }

        toggleLoadingButton(registerButton, true);

        try {
            const { data: existingUsers, error: fetchError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username);

            if (fetchError) throw new Error(fetchError.message);
            if (existingUsers.length > 0) {
                usernameError.textContent = 'Usuário já existe.';
                showNotification('error', 'Usuário já existe.');
                return;
            }

            const { error: insertError } = await supabase
                .from('users')
                .insert([{ username, password, balance: 0, is_admin: false }]);

            if (insertError) throw new Error(insertError.message);

            showNotification('success', 'Registro bem-sucedido! Faça login.');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            ui.showLoginForm();
        } catch (error) {
            showNotification('error', error.message || 'Erro ao registrar usuário.');
            usernameError.textContent = error.message || 'Erro ao registrar usuário.';
        } finally {
            toggleLoadingButton(registerButton, false);
        }
    },
    logout() {
        state.currentUser = null;
        state.isAdmin = false;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('sessionStart');
        showNotification('success', 'Logout realizado com sucesso.');
        window.location.href = 'index.html';
    }
};

const ui = {
    showLoginForm() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.remove('hidden');
            registerContainer.classList.add('hidden');
        }
    },
    showRegisterForm() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.add('hidden');
            registerContainer.classList.remove('hidden');
        }
    },
    async loadCards() {
        try {
            const { data: cards, error } = await supabase.from('cards').select('*');
            if (error) throw error;
            state.cards = cards || [];
            ui.renderCards();
        } catch (error) {
            showNotification('error', 'Erro ao carregar cartões.');
        }
    },
    renderCards() {
        const cardList = document.getElementById('cardList');
        if (!cardList) return;

        cardList.innerHTML = state.cards.length ? '' : '<p class="text-center">Nenhum cartão disponível.</p>';
        state.cards.forEach(card => {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            cardItem.innerHTML = `
                <div class="card-brand"><i class="fab fa-cc-${card.brand}"></i></div>
                <div class="card-info">
                    <p><i class="fas fa-university"></i> Banco: ${card.bank}</p>
                    <p><i class="fas fa-star"></i> Nível: ${card.level}</p>
                    <p><i class="fas fa-barcode"></i> BIN: ${card.bin || 'N/A'}</p>
                    <p><i class="fas fa-money-bill"></i> Preço: R$${card.price || '0.00'}</p>
                </div>
                <button class="card-button" onclick="ui.showConfirmPurchaseModal('${card.id}')" aria-label="Comprar cartão">Comprar</button>
            `;
            cardList.appendChild(cardItem);
        });
    },
    filterCards() {
        const binFilter = document.getElementById('binFilter').value.toLowerCase();
        const brandFilter = document.getElementById('brandFilter').value;
        const bankFilter = document.getElementById('bankFilter').value;
        const levelFilter = document.getElementById('levelFilter').value;

        const filteredCards = state.cards.filter(card => {
            return (
                (binFilter === '' || (card.bin && card.bin.toLowerCase().includes(binFilter))) &&
                (brandFilter === 'all' || card.brand === brandFilter) &&
                (bankFilter === 'all' || card.bank === bankFilter) &&
                (levelFilter === 'all' || card.level === levelFilter)
            );
        });

        const cardList = document.getElementById('cardList');
        if (!cardList) return;

        cardList.innerHTML = filteredCards.length ? '' : '<p class="text-center">Nenhum cartão encontrado.</p>';
        filteredCards.forEach(card => {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            cardItem.innerHTML = `
                <div class="card-brand"><i class="fab fa-cc-${card.brand}"></i></div>
                <div class="card-info">
                    <p><i class="fas fa-university"></i> Banco: ${card.bank}</p>
                    <p><i class="fas fa-star"></i> Nível: ${card.level}</p>
                    <p><i class="fas fa-barcode"></i> BIN: ${card.bin || 'N/A'}</p>
                    <p><i class="fas fa-money-bill"></i> Preço: R$${card.price || '0.00'}</p>
                </div>
                <button class="card-button" onclick="ui.showConfirmPurchaseModal('${card.id}')" aria-label="Comprar cartão">Comprar</button>
            `;
            cardList.appendChild(cardItem);
        });
    },
    clearFilters() {
        document.getElementById('binFilter').value = '';
        document.getElementById('brandFilter').value = 'all';
        document.getElementById('bankFilter').value = 'all';
        document.getElementById('levelFilter').value = 'all';
        ui.renderCards();
    },
    showConfirmPurchaseModal(cardId) {
        const card = state.cards.find(c => c.id === cardId);
        if (!card) return;

        state.selectedCard = card;
        const modal = document.getElementById('confirmPurchaseModal');
        const details = document.getElementById('confirmCardDetails');
        const total = document.getElementById('confirmTotalAmount');
        const balance = document.getElementById('confirmUserBalance');

        if (modal && details && total && balance) {
            details.innerHTML = `
                <p><strong>Bandeira:</strong> ${card.brand}</p>
                <p><strong>Banco:</strong> ${card.bank}</p>
                <p><strong>Nível:</strong> ${card.level}</p>
                <p><strong>BIN:</strong> ${card.bin || 'N/A'}</p>
            `;
            total.textContent = card.price || '0.00';
            balance.textContent = state.currentUser.balance.toFixed(2);
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    },
    async confirmPurchase() {
        const card = state.selectedCard;
        if (!card || !state.currentUser) return;

        if (state.currentUser.balance < card.price) {
            showNotification('error', 'Saldo insuficiente.');
            return;
        }

        try {
            const { error: userError } = await supabase
                .from('users')
                .update({ balance: state.currentUser.balance - card.price })
                .eq('username', state.currentUser.username);

            if (userError) throw userError;

            const { error: cardError } = await supabase
                .from('cards')
                .delete()
                .eq('id', card.id);

            if (cardError) throw cardError;

            const { error: userCardError } = await supabase
                .from('user_cards')
                .insert({
                    user_id: state.currentUser.username,
                    card_number: card.number,
                    cvv: card.cvv,
                    expiry: card.expiry,
                    name: card.name,
                    cpf: card.cpf,
                    brand: card.brand,
                    bank: card.bank,
                    level: card.level,
                    bin: card.bin
                });

            if (userCardError) throw userCardError;

            state.currentUser.balance -= card.price;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = state.cards.filter(c => c.id !== card.id);
            ui.renderCards();
            ui.closeModal();
            showNotification('success', 'Compra realizada com sucesso!');
            ui.updateUserInfo();
        } catch (error) {
            showNotification('error', 'Erro ao processar compra.');
        }
    },
    async showWalletModal() {
        const modal = document.getElementById('walletModal');
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (!modal || !userCardsWallet) return;

        try {
            const { data: userCards, error } = await supabase
                .from('user_cards')
                .select('*')
                .eq('user_id', state.currentUser.username);

            if (error) throw error;

            userCardsWallet.innerHTML = userCards.length ? '' : '<p class="text-center">Nenhum cartão adquirido.</p>';
            userCards.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                cardItem.innerHTML = `
                    <div class="card-brand"><i class="fab fa-cc-${card.brand}"></i></div>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${card.card_number.slice(-4)}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.bank}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.level}</p>
                        <p><i class="fas fa-barcode"></i> BIN: ${card.bin || 'N/A'}</p>
                    </div>
                `;
                userCardsWallet.appendChild(cardItem);
            });

            modal.classList.remove('hidden');
            modal.classList.add('show');
        } catch (error) {
            showNotification('error', 'Erro ao carregar carteira.');
        }
    },
    async showAccountInfo() {
        const accountInfo = document.getElementById('accountInfo');
        const userName = document.getElementById('userName');
        const userBalance = document.getElementById('userBalanceAccount');
        const userCards = document.getElementById('userCards');
        if (!accountInfo || !userName || !userBalance || !userCards) return;

        try {
            const { data: userCardsData, error } = await supabase
                .from('user_cards')
                .select('*')
                .eq('user_id', state.currentUser.username);

            if (error) throw error;

            userName.textContent = state.currentUser.username;
            userBalance.textContent = state.currentUser.balance.toFixed(2);
            userCards.innerHTML = userCardsData.length ? '' : '<p class="text-center">Nenhum cartão adquirido.</p>';
            userCardsData.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                cardItem.innerHTML = `
                    <div class="card-brand"><i class="fab fa-cc-${card.brand}"></i></div>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${card.card_number.slice(-4)}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.bank}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.level}</p>
                        <p><i class="fas fa-barcode"></i> BIN: ${card.bin || 'N/A'}</p>
                    </div>
                `;
                userCards.appendChild(cardItem);
            });

            accountInfo.classList.remove('hidden');
        } catch (error) {
            showNotification('error', 'Erro ao carregar informações da conta.');
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
        const amountInput = document.getElementById('rechargeAmount');
        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showNotification('error', 'Insira um valor válido.');
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .update({ balance: state.currentUser.balance + amount })
                .eq('username', state.currentUser.username);

            if (error) throw error;

            state.currentUser.balance += amount;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            ui.updateUserInfo();
            ui.closeModal();
            showNotification('success', 'Saldo adicionado com sucesso!');
            amountInput.value = '';
        } catch (error) {
            showNotification('error', 'Erro ao adicionar saldo.');
        }
    },
    updateUserInfo() {
        const userBalanceHeader = document.getElementById('userBalanceHeader');
        const userBalanceAccount = document.getElementById('userBalanceAccount');
        const adminButton = document.getElementById('adminButton');
        if (userBalanceHeader) userBalanceHeader.textContent = state.currentUser.balance.toFixed(2);
        if (userBalanceAccount) userBalanceAccount.textContent = state.currentUser.balance.toFixed(2);
        if (adminButton) adminButton.classList.toggle('hidden', !state.isAdmin);
    },
    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        });
        state.selectedCard = null;
    },
    async addUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const balance = parseFloat(document.getElementById('newBalance').value) || 0;
        const isAdmin = document.getElementById('newIsAdmin').value === 'true';

        if (!username || !password) {
            showNotification('error', 'Preencha todos os campos.');
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .insert([{ username, password, balance, is_admin: isAdmin }]);

            if (error) throw error;

            admin.loadUsers();
            ui.closeModal();
            showNotification('success', 'Usuário adicionado com sucesso!');
        } catch (error) {
            showNotification('error', error.message || 'Erro ao adicionar usuário.');
        }
    },
    async saveCard() {
        const card = {
            number: document.getElementById('cardNumber').value.trim(),
            cvv: document.getElementById('cardCvv').value.trim(),
            expiry: document.getElementById('cardExpiry').value.trim(),
            name: document.getElementById('cardName').value.trim(),
            cpf: document.getElementById('cardCpf').value.trim(),
            brand: document.getElementById('cardBrand').value,
            bank: document.getElementById('cardBank').value,
            level: document.getElementById('cardLevel').value,
            bin: document.getElementById('cardNumber').value.trim().slice(0, 6),
            price: 50.00 // Preço fixo para exemplo
        };

        if (!card.number || !card.cvv || !card.expiry || !card.name || !card.cpf || !card.brand || !card.bank || !card.level) {
            showNotification('error', 'Preencha todos os campos.');
            return;
        }

        try {
            const { error } = await supabase.from('cards').insert([card]);
            if (error) throw error;

            admin.loadCards();
            ui.closeModal();
            showNotification('success', 'Cartão adicionado com sucesso!');
        } catch (error) {
            showNotification('error', error.message || 'Erro ao adicionar cartão.');
        }
    },
    showEditCardModal(cardId) {
        const card = state.cards.find(c => c.id === cardId);
        if (!card) return;

        state.selectedCard = card;
        const modal = document.getElementById('editCardModal');
        if (modal) {
            document.getElementById('editCardNumber').value = card.number;
            document.getElementById('editCardCvv').value = card.cvv;
            document.getElementById('editCardExpiry').value = card.expiry;
            document.getElementById('editCardName').value = card.name;
            document.getElementById('editCardCpf').value = card.cpf;
            document.getElementById('editCardBrand').value = card.brand;
            document.getElementById('editCardBank').value = card.bank;
            document.getElementById('editCardLevel').value = card.level;
            document.getElementById('editCardBin').value = card.bin || '';
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    },
    async saveEditedCard() {
        const card = state.selectedCard;
        if (!card) return;

        const updatedCard = {
            number: document.getElementById('editCardNumber').value.trim(),
            cvv: document.getElementById('editCardCvv').value.trim(),
            expiry: document.getElementById('editCardExpiry').value.trim(),
            name: document.getElementById('editCardName').value.trim(),
            cpf: document.getElementById('editCardCpf').value.trim(),
            brand: document.getElementById('editCardBrand').value,
            bank: document.getElementById('editCardBank').value,
            level: document.getElementById('editCardLevel').value,
            bin: document.getElementById('editCardBin').value.trim() || document.getElementById('editCardNumber').value.trim().slice(0, 6)
        };

        if (!updatedCard.number || !updatedCard.cvv || !updatedCard.expiry || !updatedCard.name || !updatedCard.cpf || !updatedCard.brand || !updatedCard.bank || !updatedCard.level) {
            showNotification('error', 'Preencha todos os campos.');
            return;
        }

        try {
            const { error } = await supabase
                .from('cards')
                .update(updatedCard)
                .eq('id', card.id);

            if (error) throw error;

            admin.loadCards();
            ui.closeModal();
            showNotification('success', 'Cartão atualizado com sucesso!');
        } catch (error) {
            showNotification('error', error.message || 'Erro ao atualizar cartão.');
        }
    }
};

const admin = {
    async loadUsers() {
        const userList = document.getElementById('userList');
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (!userList || !loadingSpinner) return;

        loadingSpinner.classList.add('active');
        try {
            const { data: users, error } = await supabase.from('users').select('*');
            if (error) throw error;

            state.users = users || [];
            userList.querySelector('tbody').innerHTML = '';
            state.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>R$${user.balance.toFixed(2)}</td>
                    <td>${user.is_admin ? 'Sim' : 'Não'}</td>
                    <td>
                        <button class="action-button" onclick="showEditBalanceModal('${user.username}')" aria-label="Editar saldo">Editar</button>
                        <button class="delete-button" onclick="admin.deleteUser('${user.username}')" aria-label="Excluir usuário">Excluir</button>
                    </td>
                `;
                userList.querySelector('tbody').appendChild(row);
            });
        } catch (error) {
            showNotification('error', 'Erro ao carregar usuários.');
        } finally {
            loadingSpinner.classList.remove('active');
        }
    },
    async loadCards() {
        const adminCardList = document.getElementById('adminCardList');
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (!adminCardList || !loadingSpinner) return;

        loadingSpinner.classList.add('active');
        try {
            const { data: cards, error } = await supabase.from('cards').select('*');
            if (error) throw error;

            state.cards = cards || [];
            adminCardList.querySelector('tbody').innerHTML = '';
            state.cards.forEach(card => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${card.number.slice(-4)}</td>
                    <td>${card.brand}</td>
                    <td>${card.bank}</td>
                    <td>${card.level}</td>
                    <td>
                        <button class="action-button" onclick="ui.showEditCardModal('${card.id}')" aria-label="Editar cartão">Editar</button>
                        <button class="delete-button" onclick="admin.deleteCard('${card.id}')" aria-label="Excluir cartão">Excluir</button>
                    </td>
                `;
                adminCardList.querySelector('tbody').appendChild(row);
            });
        } catch (error) {
            showNotification('error', 'Erro ao carregar cartões.');
        } finally {
            loadingSpinner.classList.remove('active');
        }
    },
    async editUserBalance() {
        const modal = document.getElementById('editBalanceModal');
        const amountInput = document.getElementById('editBalanceAmount');
        const username = modal.dataset.username;
        const amount = parseFloat(amountInput.value);

        if (!username || isNaN(amount)) {
            showNotification('error', 'Insira um valor válido.');
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .update({ balance: amount })
                .eq('username', username);

            if (error) throw error;

            admin.loadUsers();
            ui.closeModal();
            showNotification('success', 'Saldo atualizado com sucesso!');
        } catch (error) {
            showNotification('error', error.message || 'Erro ao atualizar saldo.');
        }
    },
    async deleteUser(username) {
        if (confirm(`Deseja excluir o usuário ${username}?`)) {
            try {
                const { error } = await supabase
                    .from('users')
                    .delete()
                    .eq('username', username);

                if (error) throw error;

                admin.loadUsers();
                showNotification('success', 'Usuário excluído com sucesso!');
            } catch (error) {
                showNotification('error', error.message || 'Erro ao excluir usuário.');
            }
        }
    },
    async deleteCard(cardId) {
        if (confirm('Deseja excluir este cartão?')) {
            try {
                const { error } = await supabase
                    .from('cards')
                    .delete()
                    .eq('id', cardId);

                if (error) throw error;

                admin.loadCards();
                showNotification('success', 'Cartão excluído com sucesso!');
            } catch (error) {
                showNotification('error', error.message || 'Erro ao excluir cartão.');
            }
        }
    }
};

function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    input.value = value.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
}

function restrictCvv(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    input.value = value;
}

function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) value = value.slice(0, 2) + '/' + value.slice(2);
    input.value = value;
}

function formatCpf(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    input.value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('shop.html')) {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        ui.loadCards();
        ui.updateUserInfo();
    } else if (window.location.pathname.includes('dashboard.html')) {
        if (!checkAuth() || !state.isAdmin) {
            window.location.href = 'index.html';
            return;
        }
        admin.loadUsers();
    }
});
