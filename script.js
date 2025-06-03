const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_TIME: 60000,
    NOTIFICATION_TIMEOUT: 5000,
    SUPABASE_URL: 'https://nphqfkfdjjpiqssdyanb.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g'
};

const state = {
    currentUser: JSON.parse(sessionStorage.getItem('currentUser')) || null,
    loginAttempts: 0,
    loginBlockedUntil: 0,
    sessionStart: parseInt(sessionStorage.getItem('sessionStart') || '0'),
    cards: [],
    userCards: []
};

let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    supabase = Supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    if (window.location.pathname.includes('shop.html')) {
        if (await checkAuth()) {
            shop.loadCards();
        } else {
            showNotification('Por favor, faça login.', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
        }
    } else if (window.location.pathname.includes('dashboard.html')) {
        if (await checkAuth() && state.currentUser?.is_admin) {
            showTab('users');
        } else {
            showNotification('Acesso restrito a administradores.', 'error');
            setTimeout(() => window.location.href = 'shop.html', 1000);
        }
    }
});

let debounceTimer;
function debounceFilterCards() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => ui.filterCards(), 300);
}

function showShopSection() {
    document.getElementById('accountInfo')?.classList.add('hidden');
    document.getElementById('cardList')?.classList.remove('hidden');
    setActiveButton('shopButton');
}

function showAccountSection() {
    document.getElementById('cardList')?.classList.add('hidden');
    document.getElementById('accountInfo')?.classList.remove('hidden');
    ui.showAccountInfo();
    setActiveButton('accountButton');
}

function setActiveButton(buttonId) {
    document.querySelectorAll('.wallet-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(buttonId)?.classList.add('active');
}

function showTab(tab) {
    document.getElementById('usersSection')?.classList.toggle('hidden', tab !== 'users');
    document.getElementById('cardsSection')?.classList.toggle('hidden', tab !== 'cards');
    document.getElementById('usersTab')?.classList.toggle('active', tab === 'users');
    document.getElementById('cardsTab')?.classList.toggle('active', tab === 'cards');
    if (tab === 'users') admin.loadUsers();
    else admin.loadAdminCards();
}

function showAddUserModal() {
    document.getElementById('addUserModal')?.classList.remove('hidden');
    document.getElementById('addUserModal')?.classList.add('show');
}

function showAddCardModal() {
    document.getElementById('addCardModal')?.classList.remove('hidden');
    document.getElementById('addCardModal')?.classList.add('show');
}

function showEditUserModal(userId, username, balance, isAdmin) {
    document.getElementById('editUsername').value = username;
    document.getElementById('editPassword').value = '';
    document.getElementById('editBalance').value = balance;
    document.getElementById('editIsAdmin').value = isAdmin.toString();
    const modal = document.getElementById('editUserModal');
    modal.dataset.userId = userId;
    modal.classList.remove('hidden');
    modal.classList.add('show');
}

function showEditCardModal(cardNumber) {
    supabase.from('cards').select('*').eq('numero', cardNumber).single().then(({ data: card, error }) => {
        if (error) {
            showNotification('Erro ao carregar cartão: ' + error.message, 'error');
            return;
        }
        if (card) {
            document.getElementById('editCardNumber').value = card.numero;
            document.getElementById('editCardCvv').value = card.cvv;
            document.getElementById('editCardExpiry').value = card.validade;
            document.getElementById('editCardName').value = card.nome;
            document.getElementById('editCardCpf').value = card.cpf;
            document.getElementById('editCardBrand').value = card.bandeira;
            document.getElementById('editCardBank').value = card.banco;
            document.getElementById('editCardLevel').value = card.nivel;
            document.getElementById('editCardBin').value = card.bin;
            const modal = document.getElementById('editCardModal');
            modal.dataset.cardNumber = cardNumber;
            modal.classList.remove('hidden');
            modal.classList.add('show');
        } else {
            showNotification('Cartão não encontrado.', 'error');
        }
    });
}

const auth = {
    async login() {
        const loginButton = document.getElementById('loginButton');
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const usernameError = document.getElementById('usernameError');
        const passwordError = document.getElementById('passwordError');

        if (usernameError) usernameError.textContent = '';
        if (passwordError) passwordError.textContent = '';

        if (!username) {
            if (usernameError) usernameError.textContent = 'Preencha o usuário.';
            showNotification('Preencha o usuário.', 'error');
            return;
        }
        if (!password) {
            if (passwordError) passwordError.textContent = 'Preencha a senha.';
            showNotification('Preencha a senha.', 'error');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('Senha inválida.', 'error');
            return;
        }
        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            showNotification(`Bloqueado. Tente novamente em ${timeLeft} segundos.`, 'error');
            return;
        }

        toggleLoadingButton(loginButton, true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: username + '@loganccs.com',
                password
            });
            if (error) {
                state.loginAttempts++;
                if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                    state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_TIME;
                    showNotification('Limite de tentativas atingido. Aguarde 60 segundos.', 'error');
                    if (passwordError) passwordError.textContent = 'Conta bloqueada por 60 segundos.';
                } else {
                    showNotification('Usuário ou senha incorretos.', 'error');
                    if (passwordError) passwordError.textContent = 'Usuário ou senha incorretos.';
                }
                return;
            }
            const { data: userData, error: userError } = await supabase.from('users').select('id, username, balance, is_admin').eq('id', data.user.id).single();
            if (userError) throw new Error(userError.message);
            state.currentUser = {
                id: userData.id,
                username: userData.username,
                balance: userData.balance || 0,
                is_admin: userData.is_admin || false
            };
            state.loginAttempts = 0;
            sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            sessionStorage.setItem('sessionStart', Date.now().toString());
            showNotification('Login bem-sucedido!', 'success');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.', 'error');
            if (passwordError) passwordError.textContent = error.message || 'Erro ao conectar ao servidor.';
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

        if (usernameError) usernameError.textContent = '';
        if (passwordError) passwordError.textContent = '';
        if (confirmPasswordError) confirmPasswordError.textContent = '';

        if (!username) {
            if (usernameError) usernameError.textContent = 'Preencha o usuário.';
            showNotification('Preencha o usuário.', 'error');
            return;
        }
        if (!password) {
            if (passwordError) passwordError.textContent = 'Preencha a senha.';
            showNotification('Preencha a senha.', 'error');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('Senha muito curta.', 'error');
            return;
        }
        if (password !== confirmPassword) {
            if (confirmPasswordError) confirmPasswordError.textContent = 'As senhas não coincidem.';
            showNotification('As senhas não coincidem.', 'error');
            return;
        }

        toggleLoadingButton(registerButton, true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: username + '@loganccs.com',
                password
            });
            if (error) throw new Error(error.message);
            const { error: insertError } = await supabase.from('users').insert({
                id: data.user.id,
                username,
                balance: 0,
                is_admin: false
            });
            if (insertError) throw new Error(insertError.message);
            showNotification('Registro bem-sucedido! Faça login.', 'success');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            ui.showLoginForm();
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.', 'error');
            if (usernameError) usernameError.textContent = error.message || 'Erro ao conectar ao servidor.';
        } finally {
            toggleLoadingButton(registerButton, false);
        }
    },
    async logout() {
        await supabase.auth.signOut();
        state.currentUser = null;
        state.loginAttempts = 0;
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionStart');
        window.location.href = 'index.html';
    }
};

const shop = {
    async loadCards() {
        if (!await checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const loadingSpinner = document.getElementById('loadingSpinner');
        loadingSpinner?.classList.add('active');
        try {
            const { data: cards, error: cardsError } = await supabase.from('cards').select('*');
            const { data: userCards, error: userCardsError } = await supabase.from('user_cards').select('*').eq('user_id', state.currentUser.id);
            if (cardsError || userCardsError) throw new Error(cardsError?.message || userCardsError?.message);
            state.cards = cards || [];
            state.userCards = userCards || [];
            ui.filterCards();
            if (state.currentUser.is_admin) document.getElementById('adminButton')?.classList.remove('hidden');
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userName').textContent = state.currentUser.username;
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            ui.loadUserCards();
            ui.loadUserCardsWallet();
        } catch (error) {
            showNotification(error.message || 'Erro ao carregar dados.', 'error');
        } finally {
            loadingSpinner?.classList.remove('active');
        }
    },
    showConfirmPurchase(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.', 'error');
            return;
        }
        const modal = document.getElementById('confirmPurchaseModal');
        document.getElementById('confirmCardDetails').innerHTML = `
            <p><strong>Número:</strong> ${card.numero}</p>
            <p><strong>Bandeira:</strong> ${card.bandeira}</p>
            <p><strong>Banco:</strong> ${card.banco}</p>
            <p><strong>Nível:</strong> ${card.nivel}</p>
        `;
        document.getElementById('confirmTotalAmount').textContent = '10.00';
        document.getElementById('confirmUserBalance').textContent = state.currentUser.balance.toFixed(2);
        modal.dataset.cardNumber = cardNumber;
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },
    async purchaseCard(cardNumber) {
        if (!await checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const price = 10.00;
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.', 'error');
            return;
        }
        const loading = document.getElementById('confirmPurchaseLoading');
        loading?.classList.add('active');
        try {
            const { data: user, error: userError } = await supabase.from('users').select('balance').eq('id', state.currentUser.id).single();
            if (userError) throw new Error(userError.message);
            const { data: card, error: cardError } = await supabase.from('cards').select('*').eq('numero', cardNumber).single();
            if (cardError) throw new Error(cardError.message);
            if (!card) throw new Error('Cartão não encontrado.');
            const newBalance = user.balance - price;
            const { error: updateUserError } = await supabase.from('users').update({ balance: newBalance }).eq('id', state.currentUser.id);
            if (updateUserError) throw new Error(updateUserError.message);
            const { error: insertUserCardError } = await supabase.from('user_cards').insert({
                user_id: state.currentUser.id,
                numero: card.numero,
                cvv: card.cvv,
                validade: card.validade,
                nome: card.nome,
                cpf: card.cpf,
                bandeira: card.bandeira,
                banco: card.banco,
                nivel: card.nivel,
                bin: card.bin
            });
            if (insertUserCardError) throw new Error(insertUserCardError.message);
            const { error: deleteCardError } = await supabase.from('cards').delete().eq('numero', cardNumber);
            if (deleteCardError) throw new Error(deleteCardError.message);
            state.currentUser.balance = newBalance;
            sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = state.cards.filter(c => c.numero !== cardNumber);
            state.userCards.push({
                user_id: state.currentUser.id,
                numero: card.numero,
                cvv: card.cvv,
                validade: card.validade,
                nome: card.nome,
                cpf: card.cpf,
                bandeira: card.bandeira,
                banco: card.banco,
                nivel: card.nivel,
                bin: card.bin
            });
            ui.closeConfirmPurchaseModal();
            ui.filterCards();
            ui.loadUserCards();
            ui.loadUserCardsWallet();
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            showNotification('Compra realizada!', 'success');
        } catch (error) {
            showNotification(error.message || 'Erro ao processar compra.', 'error');
        } finally {
            loading?.classList.remove('active');
        }
    }
};

const admin = {
    async loadUsers() {
        if (!await checkAuth() || !state.currentUser?.is_admin) {
            showNotification('Acesso negado.', 'error');
            window.location.href = 'shop.html';
            return;
        }
        const loadingSpinner = document.getElementById('loadingSpinner');
        loadingSpinner?.classList.add('active');
        try {
            const { data: users, error } = await supabase.from('users').select('id, username, balance, is_admin');
            if (error) throw new Error(error.message);
            ui.displayUsers(users || []);
        } catch (error) {
            showNotification(error.message || 'Erro ao carregar usuários.', 'error');
        } finally {
            loadingSpinner?.classList.remove('active');
        }
    },
    async loadAdminCards() {
        if (!await checkAuth() || !state.currentUser?.is_admin) {
            showNotification('Acesso negado.', 'error');
            window.location.href = 'shop.html';
            return;
        }
        const loadingSpinner = document.getElementById('loadingSpinner');
        loadingSpinner?.classList.add('active');
        try {
            const { data: cards, error } = await supabase.from('cards').select('*');
            if (error) throw new Error(error.message);
            ui.displayAdminCards(cards || []);
        } catch (error) {
            showNotification(error.message || 'Erro ao carregar cartões.', 'error');
        } finally {
            loadingSpinner?.classList.remove('active');
        }
    },
    async editUser() {
        if (!await checkAuth() || !state.currentUser?.is_admin) {
            showNotification('Acesso negado.', 'error');
            return;
        }
        const modal = document.getElementById('editUserModal');
        const userId = modal.dataset.userId;
        const username = document.getElementById('editUsername').value.trim();
        const password = document.getElementById('editPassword').value.trim();
        const balance = parseFloat(document.getElementById('editBalance').value);
        const isAdmin = document.getElementById('editIsAdmin').value === 'true';
        const loading = document.getElementById('editUserLoading');
        loading?.classList.add('active');

        if (isNaN(balance) || balance < 0) {
            showNotification('Saldo inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }

        try {
            const updates = { balance, is_admin: isAdmin };
            if (password && password.length >= CONFIG.MIN_PASSWORD_LENGTH) {
                const { error } = await supabase.auth.admin.updateUserById(userId, { password });
                if (error) throw new Error(error.message);
            }
            const { error: updateError } = await supabase.from('users').update(updates).eq('id', userId);
            if (updateError) throw new Error(updateError.message);
            if (state.currentUser.id === userId) {
                state.currentUser.balance = balance;
                state.currentUser.is_admin = isAdmin;
                sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser));
                if (!isAdmin) {
                    showNotification('Você não é mais administrador. Redirecionando...', 'success');
                    setTimeout(() => window.location.href = 'shop.html', 1000);
                }
            }
            showNotification('Usuário atualizado!', 'success');
            ui.closeModal();
            admin.loadUsers();
            if (state.currentUser.id === userId) {
                document.getElementById('userBalanceHeader')?.textContent = balance.toFixed(2);
                document.getElementById('userBalanceAccount')?.textContent = `R$ ${balance.toFixed(2)}`;
            }
        } catch (error) {
            showNotification(error.message || 'Erro ao atualizar usuário.', 'error');
        } finally {
            loading?.classList.remove('active');
        }
    },
    async deleteUser(userId) {
        if (!await checkAuth() || !state.currentUser?.is_admin) {
            showNotification('Acesso negado.', 'error');
            return;
        }
        if (userId === state.currentUser.id) {
            showNotification('Não pode excluir a própria conta.', 'error');
            return;
        }
        try {
            const { error: deleteCardsError } = await supabase.from('user_cards').delete().eq('user_id', userId);
            if (deleteCardsError) throw new Error(deleteCardsError.message);
            const { error: deleteUserError } = await supabase.from('users').delete().eq('id', userId);
            if (deleteUserError) throw new Error(deleteUserError.message);
            const { error: authError } = await supabase.auth.admin.deleteUser(userId);
            if (authError) throw new Error(authError.message);
            showNotification('Usuário excluído com sucesso!', 'success');
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message || 'Erro ao excluir usuário.', 'error');
        }
    },
    async editCard() {
        if (!await checkAuth() || !state.currentUser?.is_admin) {
            showNotification('Acesso negado.', 'error');
            return;
        }
        const modal = document.getElementById('editCardModal');
        const originalNumber = modal.dataset.cardNumber;
        const cardData = {
            numero: document.getElementById('editCardNumber').value.trim(),
            cvv: document.getElementById('editCardCvv').value.trim(),
            validade: document.getElementById('editCardExpiry').value.trim(),
            nome: document.getElementById('editCardName').value.trim(),
            cpf: document.getElementById('editCardCpf').value.trim(),
            bandeira: document.getElementById('editCardBrand').value,
            banco: document.getElementById('editCardBank').value,
            pais: 'brasil',
            nivel: document.getElementById('editCardLevel').value,
            bin: document.getElementById('editCardNumber').value.trim().replace(/\s/g, '').substring(0, 6)
        };
        const loading = document.getElementById('editCardLoading');
        loading?.classList.add('active');

        if (!validateCardNumber(cardData.numero)) {
            showNotification('Número de cartão inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!validateCvv(cardData.cvv)) {
            showNotification('CVV inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!validateExpiry(cardData.validade)) {
            showNotification('Validade inválida ou expirada.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!validateCpf(cardData.cpf)) {
            showNotification('CPF inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            showNotification('Preencha todos os campos obrigatórios.', 'error');
            loading?.classList.remove('active');
            return;
        }

        try {
            const { error } = await supabase.from('cards').update(cardData).eq('numero', originalNumber);
            if (error) throw new Error(error.message);
            showNotification('Cartão atualizado!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message || 'Erro ao atualizar cartão.', 'error');
        } finally {
            loading?.classList.remove('active');
        }
    },
    async deleteCard(cardNumber) {
        if (!await checkAuth() || !state.currentUser?.is_admin) {
            showNotification('Acesso negado.', 'error');
            return;
        }
        try {
            const { error } = await supabase.from('cards').delete().eq('numero', cardNumber);
            if (error) throw new Error(error.message);
            showNotification('Cartão excluído com sucesso!', 'success');
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message || 'Erro ao excluir cartão.', 'error');
        }
    }
};

const ui = {
    showLoginForm() {
        document.getElementById('loginContainer')?.classList.remove('hidden');
        document.getElementById('registerContainer')?.classList.add('hidden');
    },
    showRegisterForm() {
        document.getElementById('loginContainer')?.classList.add('hidden');
        document.getElementById('registerContainer')?.classList.remove('hidden');
    },
    filterCards() {
        const cardList = document.getElementById('cardListContent');
        if (!cardList) return;
        const binFilter = document.getElementById('binFilter').value.trim();
        const brandFilter = document.getElementById('brandFilter').value;
        const bankFilter = document.getElementById('bankFilter').value;
        const levelFilter = document.getElementById('levelFilter').value;

        cardList.innerHTML = '';
        const filteredCards = state.cards.filter(card => {
            return (!binFilter || card.bin.startsWith(binFilter)) &&
                   (brandFilter === 'all' || card.bandeira === brandFilter) &&
                   (bankFilter === 'all' || card.banco === bankFilter) &&
                   (levelFilter === 'all' || card.nivel === levelFilter);
        });

        if (filteredCards.length === 0) {
            cardList.innerHTML = '<p class="text-center text-gray-400">Nenhum cartão disponível.</p>';
        } else {
            filteredCards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item';
                cardElement.innerHTML = `
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                    </div>
                    <button class="card-button" onclick="shop.showConfirmPurchase('${card.numero}')">Comprar por R$ 10,00</button>
                `;
                cardList.appendChild(cardElement);
            });
        }
        document.getElementById('loadingSpinner')?.classList.remove('active');
    },
    clearFilters() {
        document.getElementById('binFilter').value = '';
        document.getElementById('brandFilter').value = 'all';
        document.getElementById('bankFilter').value = 'all';
        document.getElementById('levelFilter').value = 'all';
        ui.filterCards();
    },
    showAccountInfo() {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('userName').textContent = state.currentUser.username;
        document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
        ui.loadUserCards();
    },
    showWallet() {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const walletModal = document.getElementById('walletModal');
        if (walletModal) {
            walletModal.classList.remove('hidden');
            walletModal.classList.add('show');
            ui.loadUserCardsWallet();
        }
    },
    showAddBalanceForm() {
        const rechargeModal = document.getElementById('rechargeModal');
        if (rechargeModal) {
            rechargeModal.classList.remove('hidden');
            rechargeModal.classList.add('show');
        }
    },
    async addBalance() {
        if (!await checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const amount = parseFloat(document.getElementById('rechargeAmount').value);
        const loading = document.getElementById('rechargeLoading');
        loading?.classList.add('active');
        if (isNaN(amount) || amount <= 0) {
            showNotification('Valor inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        try {
            const { data: user, error: userError } = await supabase.from('users').select('balance').eq('id', state.currentUser.id).single();
            if (userError) throw new Error(userError.message);
            const newBalance = user.balance + amount;
            const { error: updateError } = await supabase.from('users').update({ balance: newBalance }).eq('id', state.currentUser.id);
            if (updateError) throw new Error(updateError.message);
            state.currentUser.balance = newBalance;
            sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            showNotification('Saldo adicionado!', 'success');
            ui.closeModal();
        } catch (error) {
            showNotification(error.message || 'Erro ao adicionar saldo.', 'error');
        } finally {
            loading?.classList.remove('active');
        }
    },
    loadUserCards() {
        const userCards = document.getElementById('userCards');
        if (userCards) {
            userCards.innerHTML = '';
            const userCardsList = state.userCards.filter(c => c.user_id === state.currentUser.id);
            if (userCardsList.length === 0) {
                userCards.innerHTML = '<p class="text-center text-gray-400">Nenhum cartão adquirido.</p>';
            } else {
                userCardsList.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'card-item';
                    cardElement.innerHTML = `
                        <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                        <div class="card-info">
                            <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                            <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                            <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                        </div>
                    `;
                    userCards.appendChild(cardElement);
                });
            }
        }
    },
    loadUserCardsWallet() {
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (userCardsWallet) {
            userCardsWallet.innerHTML = '';
            const userCardsList = state.userCards.filter(c => c.user_id === state.currentUser.id);
            if (userCardsList.length === 0) {
                userCardsWallet.innerHTML = '<p class="text-center text-gray-400">Carteira vazia.</p>';
            } else {
                userCardsList.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'card-item';
                    cardElement.innerHTML = `
                        <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                        <div class="card-info">
                            <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                            <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                            <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                            <p><i class="fas fa-calendar"></i> Validade: ${card.validade}</p>
                            <p><i class="fas fa-lock"></i> CVV: ${card.cvv}</p>
                        </div>
                    `;
                    userCardsWallet.appendChild(cardElement);
                });
            }
        }
    },
    displayUsers(users) {
        const userList = document.getElementById('userList')?.querySelector('tbody');
        if (userList) {
            userList.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>R$ ${user.balance.toFixed(2)}</td>
                    <td>${user.is_admin ? 'Sim' : 'Não'}</td>
                    <td>
                        <button class="action-button" onclick="showEditUserModal('${user.id}', '${user.username}', ${user.balance}, ${user.is_admin})">Editar</button>
                        <button class="delete-button" onclick="admin.deleteUser('${user.id}')">Excluir</button>
                    </td>
                `;
                userList.appendChild(row);
            });
        }
    },
    displayAdminCards(cards) {
        const cardList = document.getElementById('adminCardList')?.querySelector('tbody');
        if (cardList) {
            cardList.innerHTML = '';
            cards.forEach(card => {
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
        }
    },
    async addUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const balance = parseFloat(document.getElementById('newBalance').value) || 0;
        const isAdmin = document.getElementById('newIsAdmin').value === 'true';
        const loading = document.getElementById('addUserLoading');
        loading?.classList.add('active');

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            showNotification(`A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`, 'error');
            loading?.classList.remove('active');
            return;
        }
        if (isNaN(balance) || balance < 0) {
            showNotification('Saldo inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email: username + '@loganccs.com',
                password
            });
            if (error) throw new Error(error.message);
            const { error: insertError } = await supabase.from('users').insert({
                id: data.user.id,
                username,
                balance,
                is_admin: isAdmin
            });
            if (insertError) throw new Error(insertError.message);
            showNotification('Usuário adicionado!', 'success');
            ui.closeModal();
            admin.loadUsers();
        } catch (error) {
            showNotification(error.message || 'Erro ao adicionar usuário.', 'error');
        } finally {
            loading?.classList.remove('active');
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
        const loading = document.getElementById('addCardLoading');
        loading?.classList.add('active');

        if (!validateCardNumber(cardData.numero)) {
            showNotification('Número de cartão inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!validateCvv(cardData.cvv)) {
            showNotification('CVV inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!validateExpiry(cardData.validade)) {
            showNotification('Validade inválida ou expirada.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!validateCpf(cardData.cpf)) {
            showNotification('CPF inválido.', 'error');
            loading?.classList.remove('active');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            showNotification('Preencha todos os campos obrigatórios.', 'error');
            loading?.classList.remove('active');
            return;
        }

        try {
            const { data: existingCard, error: checkError } = await supabase.from('cards').select('numero').eq('numero', cardData.numero).single();
            if (existingCard) {
                showNotification('Cartão já existe.', 'error');
                loading?.classList.remove('active');
                return;
            }
            if (checkError && checkError.code !== 'PGRST116') throw new Error(checkError.message);
            const { error } = await supabase.from('cards').insert(cardData);
            if (error) throw new Error(error.message);
            showNotification('Cartão adicionado!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message || 'Erro ao adicionar cartão.', 'error');
        } finally {
            loading?.classList.remove('active');
        }
    },
    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('show');
            const inputs = modal.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (!input.hasAttribute('readonly')) input.value = '';
            });
        });
    },
    closeConfirmPurchaseModal() {
        const modal = document.getElementById('confirmPurchaseModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
            modal.dataset.cardNumber = '';
        }
    },
    confirmPurchase() {
        const modal = document.getElementById('confirmPurchaseModal');
        const cardNumber = modal.dataset.cardNumber;
        if (cardNumber) shop.purchaseCard(cardNumber);
    }
};

async function checkAuth() {
    if (!state.currentUser) return false;
    const sessionTimeout = CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    if (Date.now() - state.sessionStart > sessionTimeout) {
        await auth.logout();
        return false;
    }
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || session.user.id !== state.currentUser.id) {
        await auth.logout();
        return false;
    }
    return true;
}

function validateCardNumber(number) {
    number = number.replace(/\s/g, '');
    if (!/^\d{16}$/.test(number)) return false;
    let sum = 0;
    let isEven = false;
    for (let i = number.length - 1; i >= 0; i--) {
        let digit = parseInt(number[i]);
        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
    }
    return sum % 10 === 0;
}

function validateCvv(cvv) {
    return /^\d{3}$/.test(cvv);
}

function validateExpiry(expiry) {
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return false;
    const [month, year] = expiry.split('/').map(Number);
    const expiryDate = new Date(2000 + year, month - 1);
    return expiryDate >= new Date();
}

function validateCpf(cpf) {
    return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
}

function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = value.slice(0, 19);
    const binInput = document.getElementById('editCardBin');
    if (binInput) binInput.value = value.replace(/\s/g, '').substring(0, 6);
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

function showNotification(message, type = 'error') {
    const notifications = document.getElementById('notifications');
    if (!notifications) return;
    const content = document.createElement('p');
    content.className = `notification ${type}`;
    content.textContent = message;
    notifications.appendChild(content);
    setTimeout(() => content.remove(), CONFIG.NOTIFICATION_TIMEOUT);
}

function toggleLoadingButton(button, isLoading) {
    if (!button) return;
    const originalText = button.dataset.originalText || button.textContent;
    if (!button.dataset.originalText) button.dataset.originalText = originalText;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Carregando...' : originalText;
}
