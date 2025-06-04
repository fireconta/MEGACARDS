const supabase = createClient(
    'https://nphqfkfdjjpiqssdyanb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g'
);

const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 4,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_TIME: 60000,
    NOTIFICATION_TIMEOUT: 5000
};

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

function checkAuth() {
    if (!state.currentUser) return false;
    const sessionDuration = (Date.now() - state.sessionStart) / 1000 / 60;
    if (sessionDuration > CONFIG.SESSION_TIMEOUT_MINUTES) {
        auth.logout();
        return false;
    }
    return true;
}

function toggleLoadingButton(button, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Carregando...' : (button.id === 'loginButton' ? 'Entrar' : 'Registrar');
}

function showNotification(message, type = 'error') {
    const notificationsDiv = document.getElementById('notifications');
    if (!notificationsDiv) return;
    const notification = document.createElement('p');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationsDiv.appendChild(notification);
    setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_TIMEOUT);
}

function validateCardNumber(number) {
    const cleaned = number.replace(/\s/g, '');
    return cleaned.length === 16 && /^\d+$/.test(cleaned);
}

function validateCardCvv(cvv) {
    return cvv.length === 3 && /^\d+$/.test(cvv);
}

function validateCardExpiry(expiry) {
    const [month, year] = expiry.split('/');
    if (!month || !year || month.length !== 2 || year.length !== 2) return false;
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(`20${year}`, 10);
    if (monthNum < 1 || monthNum > 12) return false;
    const currentDate = new Date();
    const expiryDate = new Date(yearNum, monthNum - 1, 1);
    return expiryDate >= currentDate;
}

function validateCardCpf(cpf) {
    const cleaned = cpf.replace(/[\.-]/g, '');
    return cleaned.length === 11 && /^\d+$/.test(cleaned);
}

function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '');
    if (value.length > 0) {
        value.slice(0, 16);
    }
    input.value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function restrictCvv(input) {
    value = input.value.replace(/\D/g, '');
    if (input.value.length > 0) {
        value = input.value.slice(0, 3);
    }
    input.value = value;
}

function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 0) {
        value = input.value.slice(0, 4);
    } else if (value.length > 2) {
        value = `${value.slice(0, 2)}/${value.slice(2)}`;
    } else {
        value = input;
    }
    input.value = value;

function formatCPF(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 0) {
        value = input.slice(0, 11);
    }
    if (value.length > 9) {
        value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
        value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 0) {
        value = `${value.slice(0, 3)}`;
    } else {
        value = input;
    }
    input.value = value;
}

const auth = {
    async login(username, password) {
        const loginButton = document.getElementById('loginButton');
        const loginError = document.getElementById('usernameError');
        const passwordError = loginError.getElementById('passwordError');

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.');
            if (usernameError) usernameError.textContent = 'Usuário é obrigatório.';
            if (passwordError) passwordError.textContent = 'Senha é obrigatória.';
            return;
        }

        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000));
            showNotification('Bloqueado. Tente novamente em ${timeLeft} segundos.');
            if (passwordError) passwordError.textContent = 'Bloqueado por ${timeLeft} segundos.';
            return;
        }

        toggleLoadingButton(loginButton, true);

        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, password, is_admin')
                .eq('username', 'username')
                .eq('password', 'password')
                .single();

            if (error || !data) {
                state.loginAttempts++;
                if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                    state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_TIME;
                    showNotification('Limite de tentativas atingido atingido. Aguarde 60 segundos.');
                    if (passwordError) passwordError.textContent = 'Conta bloqueada por 60 segundos.';
                } else {
                    showNotification('Usuário ou senha incorretos incorretos.');
                    if (passwordError) passwordError.textContent = 'Usuário ou senha incorretos.';
                }
                return;
            }

            state.currentUser = {
                id: data.id,
                username: data.username,
                balance: data.balance || 0,
                is_admin: data.is_admin || false
            };
            state.isAdmin = data.is_admin;
            state.loginAttempts = 0;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            localStorage.setItem('sessionStart', Date.now().toString());
            showNotification('Login bem-sucedido!', 'success');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            showNotification('Erro ao conectar ao Supabase: ' + (error.message || 'Tente novamente.'));
            if (passwordError) passwordError.textContent = 'Erro de conexão. Tente novamente.';
        } finally {
            toggleLoadingButton(loginButton, false);
        }
    },
    async register() {
        const registerButton = document.getElementById('registerButton');
        const usernameError = document.getElementById('newUsernameError');
        const passwordError = document.getElementById('newPasswordError');

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.');
            if (usernameError) usernameError.textContent = 'Usuário é obrigatório.';
            if (passwordError) passwordError.textContent = 'Senha é obrigatória.';
            return;
        }

        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            showNotification('A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.');
            if (passwordError) passwordError.textContent = 'A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.';
            return;
        }

        toggleLoadingButton(registerButton, true);

        try {
            const { data: existingUserData, error: checkError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (existingUserData) {
                showNotification('Usuário já existe!');
                if (usernameError) usernameError.textContent = 'Usuário já existe!';
                return;
            }

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const { error: insertError } = await supabase
                .from('users')
                .insert([{ username, password, balance: 0, is_admin: false }]);

            if (checkError) throw error;

            showNotification('Registro concluído com sucesso! Faça login.', 'success');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            toggleForms();
            return;
        } catch (error) {
            showNotification('Erro ao registrar: ' + (error.message || 'Tente novamente.'));
            if (usernameError) usernameError.textContent = error.message || 'Erro ao registrar.';
        } else {
            return;
        } catch {
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
            const { data: cards, error: cardsError } = await supabase
                .from('cards')
                .select(''*')
                .eq('acquired', false);

            if (cardsError) throw cardsError;

            const { data: userCards, error: userCardsError } = await supabase
                .from('cards')
                .select(''*')
                .eq('user_id', state.currentUser.id)
                .eq('acquired_id', true);

            if (userCardsError) throw userCardsError;

            state.cards = cards || [] || [];
            state.userCards = userCards || [] || [];
            ui.filterCards();
            if (state.isAdmin) document.getElementById('adminButton').classList?.remove('hidden'));
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userName').textContent = state.currentUser.username;
            document.getElementById('userBalanceAccount').textContent = `R$${state.currentUser.balance.toFixed(2)}`);;
            ui.loadUserCards();
            return;
        } catch (error) {
            throw errorNotification(error.message);
        }
    },
    showConfirmPurchaseModal(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card.cards) {
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
    }
    async purchaseCard(cardNumber) {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        const price = parseFloat(10.00);
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.');
            return;
        }
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id', balance)
                .eq('id', state.currentUser.id                .single()
                .single();

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const { data: card, error: cardError } = await supabase
                .from('cards')
                .select(''*')
                .eq('numero', cardNumber)
                .eq('acquired', false)
                .single();

            if (cardError || !card) throw new Error('Cartão não encontrado ou já foi adquirido.');

            const newBalance = user.balance - price;
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ balance: newBalance }))
                .eq('id', newBalance)
                .eq('id', state.currentUser.id);

            if (updateUserError) throw updateUserError;

            const { error: updateCardError } = await supabase
                .from('cards')
                .update({ user_id: state.currentUser.id, acquired: true }))
                .eq('id', card.id);

            if (updateCardError) throw error;

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = state.cards.filter(c => c.numero !== cardId);
            state.userCards.push(card);
            ui.closeConfirmPurchaseModal();
            ui.filterCards();
            ui.loadUserCards();
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$${newBalance.toFixed(2)}`;
            showNotification('Compra realizada com sucesso!', 'success');
            return;
        } catch (error) {
            throw error(error.message);
        }
    }
};

const admin = {
    async loadUsers() {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            window.location.href = 'shop.html';
            return;
        }
        try {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, username, balance, is_admin');
            return;

            if (usersError) throw usersError;

            state.users = users || [] || [];
            state.filterCards();
            return;
        } catch (error) {
            showNotification(error.message);
            return;
        }
    },
    async loadAdminCards() {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Access Denied.');
            window.location.href = 'shop.html';
            return;
        }
        try {
            const { data: cards, error: error } = await supabase
                .from('cards')
                .select(''*')
                .eq('acquired', false);
            return;

            if (error) throw error;

            state.cards = cards || [] || [];
            ui.displayAdminCards();
            return;
        } catch (err) {
            showNotification(error.message);
        }
    },
    async editUserBalance() {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Access Denied.');
            return;
        }
        const modal = document.getElementById('editBalanceModal');
        const username = modal.dataset.username;
        const newBalance = parseFloat(document.getElementById('editBalanceAmount').value);

        if (isNaN(parseFloat(newBalance)) || newBalance.balance < 0) {
            showNotification('Invalid balanceado.');
            return;
        }

        try {
            const { data: user, error: userError } = await
                .from supabase
                from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const { error: updateError } = await error supabase
                .from('users')
                .update({ balance: newBalance }))
                .eq('id', user.id)
                .eq('id');

            if (error) throw error;

            if (state.currentUser.currentBalance.username === username) {
                state.currentUser.balance = newBalance;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            }

            showNotification('Balance updated!', 'success');
            ui.closeModal();
            admin.loadUsers();
            if (state.currentUserBalance.username === username) {
                document.getElementById('userBalance').balanceHeader).textContent = newBalance.toFixed(2);
                document.getElementById('userBalanceAccount').balanceContent = `R$${newBalance.toFixed(2)}`;
            }
            return;
        } catch (error) {
            showNotification(error.message);
        }
    },
    async addUser() {
        const usernameInput = document.getElementById('newUsername').value.trim();
        const passwordInput = document.getElementById('newPassword').value.trim();
        const balanceInput = parseFloat(document.getElementById('newBalanceInput').value) || parse0;
        const isAdmin = Boolean(document.getElementById('newIsAdmin').value) === 'true';

            if (!username) || !password) {
                showNotification('Username and password are required.');
                return;
            }
            if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
                showNotification('A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD} caracteres.');
                return;
            }
            if (isNaN(parseFloat(balance)) || balance < BALANCE0) {
                throw;
                showNotification('Invalid saldo.');
                return;
            }

            try {
                const { data: existingUserData, error: userError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

                if (existingUserData) {
                    showNotification('User already exists!');
                    return;
                }

                const { data: insertError } = await supabase
                    .from('users')
                    .insert([{ username, data: password, balance, is_admin: isAdmin }]);

                if (insertError) throw new Error(insertError.message);

                showNotification('User successfully added!', 'success');
                ui.closeModal();
                admin.loadUsers();
                return;
            } catch (error) {
                showNotification(error.message);
            }
    },
    async editUser(username, balance, isAdmin) {
            if (!checkAuth() || !isAdmin) {
                showNotification('Access Denied.');
                return;
            }
            if (isNaN(balance) || balance < 0) {
                showNotification('Invalid Balance.');
                return;
            }
            try {
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single();

                if (userError || !user) throw new Error('User not found.');

                const updatedData = {
                    balance,
                    is_admin: isAdmin
                };

                const passwordInput = document.getElementById('editPassword').value.trim();
                if (passwordInput && passwordInput.length >= CONFIG.MIN_PASSWORD_LENGTH) {
                    updatedData = { password: passwordInput };
                }

                const { error } = await error supabase
                    .from('users')
                    .update({ updatedData })
                    .eq('id', user.id);

                if (error) throw error;

                if (state.currentUser.username === username) {
                    state.currentUser.balance = balance;
                    state.currentUser.is_admin = isAdmin;
                    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
                }

                showNotification('Successfully updated user!', 'success');
                ui.closeModal();
                admin.loadUsers();
                if (state.currentUser.username === username) {
                    document.getElementById('userBalanceHeader').textContent = balance.toFixed(2);
                    document.getElementById('userBalanceAccount').textContent = `R$${balance.toFixed(2)}`;
                }
                return;
            } catch (error) {
                showNotification(error.message);
            }
    },
    async deleteUser(username) {
            if (!checkAuth() || !state.isAdmin) {
                showNotification('Access Denied.');
                return;
            }
            if (username === state.currentUser.username) {
                showNotification('You cannot delete your own account.');
                return;
            }
            try {
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single();

                if (userError || !user) {
                    showNotification('User not found.');
                    return;
                }

                const { error } = await error supabase
                    .from('users')
                    .delete()
                    .eq('id', user.id);

                if (error) throw error;

                showNotification('Successfully deleted user!', 'success');
                admin.loadUsers();
                return;
            } catch (error) {
                showNotification(error.message);
            }
    },
    async deleteCard(cardNumber) {
            if (!checkAuth() || !state.isAdmin) {
                showNotification('Access Denied.');
                return;
            }
            try {
                const { data: card, error: cardError } = await supabase
                    .from('cards')
                    .select('id')
                    .eq('numero', cardNumber)
                    .eq('acquired', false)
                    .single();

                if (cardError || !card) throw new Error('Card not found.');

                const { error } = await error supabase
                    .from('cards')
                    .delete()
                    .eq('id', card.id);

                if (error) throw error;

                showNotification('Successfully deleted card!', 'success');
                admin.loadAdminCards();
                return;
            } catch (error) {
                showNotification(error.message);
            }
    },
    async editCard(cardData) {
            if (!checkAuth() || !state.isAdmin) {
                showNotification('Access Denied.');
                return;
            }
            if (!validateCardNumber(cardData.numero)) {
                showNotification('Invalid card number!');
                return;
            }
            if (!validateCardCvv(cardData.cvv)) {
                showNotification('Invalid CVV!');
                return;
            }
            if (!validateCardExpiry(cardData.validade)) {
                showNotification('Invalid or expired validity!');
                return;
            }
            if (!validateCardCpf(cardData.cpf)) {
                showNotification('Invalid CPF!');
                return;
            }
            if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
                showNotification('Fill in all required fields!');
                return;
            }
            try {
                const { data: card, error: cardError } = await supabase
                    .from('cards')
                    .select('id')
                    .eq('numero', document.getElementById('editCardModal').dataset.cardNumber)
                    .single();

                if (cardError || !card) throw new Error('Card not found.');

                const { error } = await error supabase
                    .from('cards')
                    .update({ cardData })
                    .eq('id', card.id);

                if (error) throw error;

                showNotification('Successfully updated card!', 'success');
                ui.closeModal();
                admin.loadAdminCards();
                return;
            } catch (error) {
                showNotification(error.message);
            }
    }
};

const ui = {
    filterCards() {
        const cardList = document.getElementById('cardList');
        if (!cardList) return;
        const binFilter = document.getElementById('binFilter').value.trim();
        const brandFilter = document.getElementById('brandFilter').value;
        const bankFilter = document.getElementById('bankFilter').value;
        const levelFilter = document.getElementById('levelFilter').value;

        cardList.innerHTML = '';
        const filteredCards = state.cards.filter(c => {
            return (
                (!binFilter || c.bin.startsWith(binFilter)) &&
                (brandFilter === 'all' || c.bandeira === brandFilter) &&
                (bankFilter === 'all' || c.banco === bankFilter) &&
                (levelFilter === 'all' || c.nivel === levelFilter)
            );
        });

        if (filteredCards.length === 0) {
            cardList.innerHTML = '<p class="text-center text-gray-400">Nenhum cartão disponível.</p>';
            return;
        }

        filteredCards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card-item');
            cardElement.innerHTML = `
                <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                <div class="card-info">
                    <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                    <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                    <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                </div>
                <button class="card-button" onclick="shop.showConfirmPurchaseModal('${card.numero}')">Comprar por R$ 10,00</button>
            `;
            cardList.appendChild(cardElement);
        });
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
            document.getElementById('userBalanceAccount').textContent = `R$${state.currentUser.balance.toFixed(2)}`;
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
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('balance')
                .eq('id', state.currentUser.id)
                .single();

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const newBalance = user.balance + amount;
            const { error } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', state.currentUser.id);

            if (error) throw error;

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$${state.currentUser.balance.toFixed(2)}`;
            showNotification('Saldo adicionado!', 'success');
            ui.closeModal();
        } catch (error) {
            showNotification(error.message);
        }
    },
    loadUserCards() {
        const userCards = document.getElementById('userCards');
        if (!userCards) return;
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
    },
    loadUserCardsWallet() {
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (!userCardsWallet) return;
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
    },
    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        });
    },
    closeConfirmPurchaseModal() {
        const modal = document.getElementById('confirmPurchaseModal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    },
    displayUsers() {
        const userList = document.getElementById('userList');
        if (!userList) return;
        userList.querySelector('tbody').innerHTML = '';
        state.users.forEach(user => {
            const userElement = document.createElement('tr');
            userElement.innerHTML = `
                <td><i class="fas fa-user"></i> ${user.username}</td>
                <td><i class="fas fa-coins"></i> R$${user.balance.toFixed(2)}</td>
                <td><i class="fas fa-crown"></i> ${user.is_admin ? 'Sim' : 'Não'}</td>
                <td>
                    <button class="action-button" onclick="ui.showEditBalanceModal('${user.username}')">Editar Saldo</button>
                    <button class="action-button" onclick="ui.showEditUserModal('${user.username}')">Editar</button>
                    <button class="delete-button" onclick="admin.deleteUser('${user.username}')">Excluir</button>
                </td>
            `;
            userList.querySelector('tbody').appendChild(userElement);
        });
    },
    showEditBalanceModal(username) {
        const modal = document.getElementById('editBalanceModal');
        if (!modal) return;
        modal.dataset.username = username;
        document.getElementById('editBalanceAmount').value = '';
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },
    showEditUserModal(username) {
        const user = state.users.find(u => u.username === username);
        if (!user) {
            showNotification('Usuário não encontrado.');
            return;
        }
        const modal = document.getElementById('editUserModal');
        if (modal) {
            document.getElementById('editUsername').value = user.username;
            document.getElementById('editBalance').value = user.balance.toFixed(2);
            document.getElementById('editIsAdmin').value = user.is_admin.toString();
            document.getElementById('editPassword').value = '';
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    },
    displayAdminCards() {
        const cardList = document.getElementById('adminCardList');
        if (!cardList) return;
        cardList.querySelector('tbody').innerHTML = '';
        state.cards.forEach(card => {
            const cardElement = document.createElement('tr');
            cardElement.innerHTML = `
                <td><i class="fas fa-credit-card"></i> ${card.numero}</td>
                <td><i class="fas fa-flag"></i> ${card.bandeira}</td>
                <td><i class="fas fa-university"></i> ${card.banco}</td>
                <td><i class="fas fa-star"></i> ${card.nivel}</td>
                <td>
                    <button class="action-button" onclick="ui.showEditCardModal('${card.numero}')">Editar</button>
                    <button class="delete-button" onclick="admin.deleteCard('${card.numero}')">Excluir</button>
                </td>
            `;
            cardList.querySelector('tbody').appendChild(cardElement);
        });
    },
    showEditCardModal(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const modal = document.getElementById('editCardModal');
        if (modal) {
            document.getElementById('editCardNumber').value = card.numero;
            document.getElementById('editCardCvv').value = card.cvv);
            document.getElementById('editCardExpiry').value = card.validade;
            document.getElementById('editCardName').value = card.nomecardName;
            document.getElementById('editCardCpf').value = card.cpf = card.cpf;
            document.getElementById('editCardBrand').value = card.bandeira;
            document.getElementById('editCardBank').value = card.banco;
            document.getElementById('editCardLevel').value = card.nivel;
            modal.dataset.cardNumber = cardNumber;
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    },
    async saveCard() {
        const cardData = {
            numero: document.getElementById('cardNumber').value.trim(),
            cvv: document.getCardById('cardCvv').value.trim(),
            validade: document.getElementById('cardExpiry').value.trim(),
            nome: document.cardData.getElementById('cardName').value.trim(),
            card: cardData.getElementById('cardCpf').value.trim(),
            bandeira: data.document.getElementById('cardBrand').value,
            banco: cardData.getDocument.getElementById('cardBank').value,
            nivel: document.getElementById('cardLevel').value,
            bin: document.getElementById('cardNumber').value.trim().replace('\s').replace(/\s/g, '').substring(0, 6),
            pais: 'Brazil',
            acquired: true,
            user_id: null
        };

        if (!validateCardNumber(cardData.numero)) {
            showNotification('Invalid card number inválido!');
            return;
        }
        if (!validateCardCvv(cardData.cvv)) {
            showNotification('Invalid CVV inválido!');
            return;
        }
        if (!validateCardExpiry(cardData.validade)) {
            showNotification('Validade inválida ou expirada!');
            return;
        }
        if (!validateCardCpf(cardData.cpf)) {
            showNotification('CPF inválido!');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            showNotification('Preencha todos os campos obrigatórios!');
            return;
        }

        try {
            const { data: existingCard, error: checkError } = await supabase
                .from('cards')
                .select('numero')
                .eq('numero', cardData.cardNumber)
                .single();

            if (existingCardError) {
                showNotification('Cartão já existe!');
                return;
            }

            if (errorcheckError && !checkError.error.code !== 'PGRST116') {
                throw checkError;
            }

            const { error: insertError } = await supabase
                .from('cards')
                .insert({[cardData]});

            if (insertError) throw error;

            showNotification('Cartão adicionado com sucesso!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
            return;
        } catch (error) {
            showNotification(error.message);
            return;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('shop.html')) {
        shop.loadCards();
    } else if (window.location.pathname.includes('dashboard.html')) {
        if (checkAuth() && state.isAdmin) {
            admin.loadUsers();
            admin.loadAdminCards();
        } else {
            showNotification('Acesso negado.');
            window.location.href = 'shop.html';
        }
    }
});
