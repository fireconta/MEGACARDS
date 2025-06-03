import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_TIME: 60000,
    NOTIFICATION_TIMEOUT: 5000,
    SUPABASE_URL: 'https://nphqfkfdjjpiqssdyanb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g'
};

// Inicializa o cliente Supabase
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const state = {
    users: [],
    cards: [],
    userCards: [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    isAdmin: false,
    loginAttempts: 0,
    loginBlockedUntil: 0,
    sessionStart: parseInt(localStorage.getItem('sessionStart') || '0')
};

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
            showNotification('Preencha o usuário.');
            return;
        }
        if (!password) {
            if (passwordError) passwordError.textContent = 'Preencha a senha.';
            showNotification('Preencha a senha.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('Senha inválida.');
            return;
        }
        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            showNotification(`Bloqueado. Tente novamente em ${timeLeft} segundos.`);
            return;
        }

        toggleLoadingButton(loginButton, true);

        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password);
            
            if (error) throw new Error(error.message);
            if (!users || users.length === 0) {
                state.loginAttempts++;
                if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                    state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_TIME;
                    showNotification('Limite de tentativas atingido. Aguarde 60 segundos.');
                    if (passwordError) passwordError.textContent = 'Conta bloqueada por 60 segundos.';
                } else {
                    showNotification('Usuário ou senha incorretos.');
                    if (passwordError) passwordError.textContent = 'Usuário ou senha incorretos.';
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
            localStorage.setItem('sessionStart', Date.now().toString());
            showNotification('Login bem-sucedido!', 'success');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            showNotification(error.message || 'Erro ao conectar ao servidor.');
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
            showNotification('Preencha o usuário.');
            return;
        }
        if (!password) {
            if (passwordError) passwordError.textContent = 'Preencha a senha.';
            showNotification('Preencha a senha.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            showNotification('Senha muito curta.');
            return;
        }
        if (password !== confirmPassword) {
            if (confirmPasswordError) confirmPasswordError.textContent = 'As senhas não coincidem.';
            showNotification('As senhas não coincidem.');
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
                if (usernameError) usernameError.textContent = 'Usuário já existe.';
                showNotification('Usuário já existe.');
                return;
            }

            const { error: insertError } = await supabase
                .from('users')
                .insert([{ username, password, balance: 0, is_admin: false }]);
            
            if (insertError) throw new Error(insertError.message);

            showNotification('Registro bem-sucedido! Faça login.', 'success');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            ui.showLoginForm();
        } catch (error) {
            showNotification(error.message || evocative('Erro ao conectar ao servidor.');
            if (usernameError) usernameError.textContent = error.message || 'Erro ao conectar ao servidor.';
        } finally {
            toggleLoadingButton(registerButton, false);
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
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        try {
            const { data: cardsData, error: cardsError } = await supabase
                .from('cards')
                .select('*');
            const { data: userCardsData, error: userCardsError } = await supabase
                .from('user_cards')
                .select('*');

            if (cardsError || userCardsError) throw new Error(cardsError?.message || userCardsError?.message);
            
            state.cards = cardsData || [];
            state.userCards = userCardsData || [];
            ui.filterCards();
            if (state.isAdmin) document.getElementById('adminButton')?.classList.remove('hidden');
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userName').textContent = state.currentUser.username;
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            ui.loadUserCards();
            ui.loadUserCardsWallet();
        } catch (error) {
            showNotification(error.message);
        }
    },
    showConfirmPurchase(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
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
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const price = 10.00;
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.');
            return;
        }
        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('username', state.currentUser.username)
                .single();
            
            if (userError) throw new Error(userError.message);
            if (!userData) throw new Error('Usuário não encontrado.');

            const { data: cardData, error: cardError } = await supabase
                .from('cards')
                .select('*')
                .eq('numero', cardNumber)
                .single();
            
            if (cardError) throw new Error(cardError.message);
            if (!cardData) throw new Error('Cartão não encontrado.');

            const newBalance = userData.balance - price;
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('username', state.currentUser.username);
            
            if (updateUserError) throw new Error(updateUserError.message);

            const { error: insertUserCardError } = await supabase
                .from('user_cards')
                .insert([{
                    user: state.currentUser.username,
                    numero: cardData.numero,
                    cvv: cardData.cvv,
                    validade: cardData.validade,
                    nome: cardData.nome,
                    cpf: cardData.cpf,
                    bandeira: cardData.bandeira,
                    banco: cardData.banco,
                    nivel: cardData.nivel,
                    bin: cardData.bin
                }]);
            
            if (insertUserCardError) throw new Error(insertUserCardError.message);

            const { error: deleteCardError } = await supabase
                .from('cards')
                .delete()
                .eq('numero', cardNumber);
            
            if (deleteCardError) throw new Error(deleteCardError.message);

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = state.cards.filter(c => c.numero !== cardNumber);
            state.userCards.push({
                user: state.currentUser.username,
                numero: cardData.numero,
                cvv: cardData.cvv,
                validade: cardData.validade,
                nome: cardData.nome,
                cpf: cardData.cpf,
                bandeira: cardData.bandeira,
                banco: cardData.banco,
                nivel: cardData.nivel,
                bin: cardData.bin
            });

            ui.closeConfirmPurchaseModal();
            ui.filterCards();
            ui.loadUserCards();
            ui.loadUserCardsWallet();
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            showNotification('Compra realizada!', 'success');
        } catch (error) {
            showNotification(error.message);
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
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*');
            
            if (error) throw new Error(error.message);
            state.users = data || [];
            ui.displayUsers();
        } catch (error) {
            showNotification(error.message);
        }
    },
    async loadAdminCards() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            window.location.href = 'shop.html';
            return;
        }
        try {
            const { data, error } = await supabase
                .from('cards')
                .select('*');
            
            if (error) throw new Error(error.message);
            state.cards = data || [];
            ui.displayAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    },
    async editUserBalance() {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        const modal = document.getElementById('editBalanceModal');
        const username = modal.dataset.username;
        const newBalance = parseFloat(document.getElementById('editBalanceAmount').value);

        if (isNaN(newBalance) || newBalance < 0) {
            showNotification('Saldo inválido.');
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('username', username);
            
            if (error) throw new Error(error.message);

            if (state.currentUser.username === username) {
                state.currentUser.balance = newBalance;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            }

            showNotification('Saldo atualizado!', 'success');
            ui.closeModal();
            admin.loadUsers();
            if (state.currentUser.username === username) {
                document.getElementById('userBalanceHeader').textContent = newBalance.toFixed(2);
                document.getElementById('userBalanceAccount').textContent = `R$ ${newBalance.toFixed(2)}`;
            }
        } catch (error) {
            showNotification(error.message);
        }
    },
    async deleteUser(username) {
        if (!checkAuth() || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (username === state.currentUser.username) {
            showNotification('Não pode excluir a própria conta.');
            return;
        }
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('username', username);
            
            if (error) throw new Error(error.message);

            showNotification('Usuário excluído com sucesso!', 'success');
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
            const { error } = await supabase
                .from('cards')
                .delete()
                .eq('numero', cardNumber);
            
            if (error) throw new Error(error.message);

            showNotification('Cartão excluído com sucesso!', 'success');
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    }
};

const ui = {
    showLoginForm() {
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('registerContainer').classList.add('hidden');
    },
    showRegisterForm() {
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('registerContainer').classList.remove('hidden');
    },
    filterCards() {
        const cardList = document.getElementById('cardList');
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
        const cardList = document.getElementById('cardList');
        const accountInfo = document.getElementById('accountInfo');
        if (cardList && accountInfo) {
            cardList.classList.add('hidden');
            accountInfo.classList.remove('hidden');
            document.getElementById('userName').textContent = state.currentUser.username;
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            ui.loadUserCards();
        }
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
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const amount = parseFloat(document.getElementById('rechargeAmount').value);
        if (isNaN(amount) || amount <= 0) {
            showNotification('Valor inválido.');
            return;
        }
        try {
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('balance')
                .eq('username', state.currentUser.username)
                .single();
            
            if (fetchError) throw new Error(fetchError.message);

            const newBalance = userData.balance + amount;
            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('username', state.currentUser.username);
            
            if (updateError) throw new Error(updateError.message);

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$ ${state.currentUser.balance.toFixed(2)}`;
            showNotification('Saldo adicionado!', 'success');
            ui.closeModal();
        } catch (error) {
            showNotification(error.message);
        }
    },
    loadUserCards() {
        const userCards = document.getElementById('userCards');
        if (userCards) {
            userCards.innerHTML = '';
            const userCardsList = state.userCards.filter(c => c.user === state.currentUser.username);
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
            const userCardsList = state.userCards.filter(c => c.user === state.currentUser.username);
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
    displayUsers() {
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = '';
            state.users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'card-item';
                userElement.innerHTML = `
                    <div>
                        <p><i class="fas fa-user"></i> Usuário: ${user.username}</p>
                        <p><i class="fas fa-coins"></i> Saldo: R$ ${user.balance.toFixed(2)}</p>
                        <p><i class="fas fa-crown"></i> Admin: ${user.is_admin ? 'Sim' : 'Não'}</p>
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
        if (modal) {
            modal.dataset.username = username;
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
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
                        <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                        <p><i class="fas fa-flag"></i> Bandeira: ${card.bandeira}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="action-button" onclick="ui.showEditCardModal('${card.numero}')">Editar</button>
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
        const balance = parseFloat(document.getElementById('newBalance').value) || 0;
        const isAdmin = document.getElementById('newIsAdmin').value === 'true';

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.');
            return;
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            showNotification(`A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }
        if (isNaN(balance) || balance < 0) {
            showNotification('Saldo inválido.');
            return;
        }

        try {
            const { data: existingUsers, error: fetchError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username);
            
            if (fetchError) throw new Error(fetchError.message);
            if (existingUsers.length > 0) {
                showNotification('Usuário já existe.');
                return;
            }

            const { error: insertError } = await supabase
                .from('users')
                .insert([{ username, password, balance, is_admin: isAdmin }]);
            
            if (insertError) throw new Error(insertError.message);

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
            const { data: existingCards, error: fetchError } = await supabase
                .from('cards')
                .select('numero')
                .eq('numero', cardData.numero);
            
            if (fetchError) throw new Error(fetchError.message);
            if (existingCards.length > 0) {
                showNotification('Cartão já existe.');
                return;
            }

            const { error: insertError } = await supabase
                .from('cards')
                .insert([cardData]);
            
            if (insertError) throw new Error(insertError.message);

            showNotification('Cartão adicionado!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    },
    showEditCardModal(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const modal = document.getElementById('editCardModal');
        document.getElementById('editCardNumber').value = card.numero;
        document.getElementById('editCardCvv').value = card.cvv;
        document.getElementById('editCardExpiry').value = card.validade;
        document.getElementById('editCardName').value = card.nome;
        document.getElementById('editCardCpf').value = card.cpf;
        document.getElementById('editCardBrand').value = card.bandeira;
        document.getElementById('editCardBank').value = card.banco;
        document.getElementById('editCardLevel').value = card.nivel;
        modal.dataset.cardNumber = cardNumber;
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },
    async saveEditedCard() {
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
            const { error } = await supabase
                .from('cards')
                .update(cardData)
                .eq('numero', document.getElementById('editCardModal').dataset.cardNumber);
            
            if (error) throw new Error(error.message);

            showNotification('Cartão atualizado!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(error.message);
        }
    },
    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('show');
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

function checkAuth() {
    if (!state.currentUser) {
        return false;
    }
    const sessionTimeout = CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    if (Date.now() - state.sessionStart > sessionTimeout) {
        auth.logout();
        return false;
    }
    return true;
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
            if (digit > 9) {
                digit -= 9;
            }
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
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
        return false;
    }
    const [month, year] = expiry.split('/').map(Number);
    const currentDate = new Date();
    const expiryDate = new Date(2000 + year, month - 1);
    return expiryDate > currentDate;
}

function validateCpf(cpf) {
    return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
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
    if (value.length > 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    input.value = value.slice(0, 5);
}

function formatCpf(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 3) {
        value = value.slice(0, 3) + '.' + value.slice(3);
    }
    if (value.length > 7) {
        value = value.slice(0, 7) + '.' + value.slice(7);
    }
    if (value.length > 11) {
        value = value.slice(0, 11) + '-' + value.slice(11);
    }
    input.value = value.slice(0, 14);
}

function showNotification(message, type = 'error') {
    const notifications = document.getElementById('notifications');
    const content = document.createElement('p');
    content.className = `notification ${type}`;
    content.textContent = message;
    notifications.appendChild(content);
    setTimeout(() => content.remove(), CONFIG.NOTIFICATION_TIMEOUT);
}

function toggleLoadingButton(button, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Carregando...' : button.getAttribute('id') === 'loginButton' ? 'Entrar' : 'Registrar';
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('shop.html')) {
        if (checkAuth()) {
            shop.loadCards();
        } else {
            window.location.href = 'index.html';
        }
    } else if (window.location.pathname.includes('dashboard.html')) {
        if (checkAuth() && state.isAdmin) {
            admin.loadUsers();
            admin.loadAdminCards();
        } else {
            window.location.href = 'shop.html';
        }
    }
});
