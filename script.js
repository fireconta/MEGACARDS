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

function toggleLoadingButton(button, isLoading, originalText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Carregando...' : originalText;
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
    let value = input.value.replace(/\s/g, '').replace(/\D/g, '');
    if (value.length > 16) {
        value = value.slice(0, 16);
    }
    input.value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function restrictCvv(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 3) {
        value = value.slice(0, 3);
    }
    input.value = value;
}

function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) {
        value = value.slice(0, 4);
    }
    if (value.length > 2) {
        value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    input.value = value;
}

function formatCPF(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) {
        value = value.slice(0, 11);
    }
    if (value.length > 9) {
        value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
        value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
        value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    input.value = value;
}

const auth = {
    // NOTA: Para segurança, use supabase.auth.signInWithPassword e supabase.auth.signUp
    // para gerenciar autenticação com hashing de senhas no backend.
    // A implementação atual armazena senhas em texto puro, o que é uma vulnerabilidade.
    async login(username, password) {
        const loginButton = document.getElementById('loginButton');
        const usernameError = document.getElementById('usernameError');
        const passwordError = document.getElementById('passwordError');

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.');
            if (usernameError) usernameError.textContent = 'Usuário é obrigatório.';
            if (passwordError) passwordError.textContent = 'Senha é obrigatória.';
            return;
        }

        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            showNotification(`Bloqueado. Tente novamente em ${timeLeft} segundos.`);
            if (passwordError) passwordError.textContent = `Bloqueado por ${timeLeft} segundos.`;
            return;
        }

        toggleLoadingButton(loginButton, true, 'Entrar');

        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, password, balance, is_admin')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error || !data) {
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
            showNotification(`Erro ao conectar ao Supabase: ${error.message || 'Tente novamente.'}`);
            if (passwordError) passwordError.textContent = 'Erro de conexão. Tente novamente.';
        } finally {
            toggleLoadingButton(loginButton, false, 'Entrar');
        }
    },
    async register(username, password, confirmPassword) {
        const registerButton = document.getElementById('registerButton');
        const usernameError = document.getElementById('newUsernameError');
        const passwordError = document.getElementById('newPasswordError');
        const confirmPasswordError = document.getElementById('confirmPasswordError');

        if (!username || !password) {
            showNotification('Usuário e senha são obrigatórios.');
            if (usernameError) usernameError.textContent = 'Usuário é obrigatório.';
            if (passwordError) passwordError.textContent = 'Senha é obrigatória.';
            return;
        }

        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            showNotification(`A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
            if (passwordError) passwordError.textContent = `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            return;
        }

        if (password !== confirmPassword) {
            showNotification('As senhas não coincidem.');
            if (confirmPasswordError) confirmPasswordError.textContent = 'As senhas não coincidem.';
            return;
        }

        toggleLoadingButton(registerButton, true, 'Registrar');

        try {
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (existingUser) {
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

            if (insertError) throw insertError;

            showNotification('Registro concluído com sucesso! Faça login.', 'success');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            ui.toggleForms();
        } catch (error) {
            showNotification(`Erro ao registrar: ${error.message || 'Tente novamente.'}`);
            if (usernameError) usernameError.textContent = error.message || 'Erro ao registrar.';
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
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        try {
            const { data: cards, error: cardsError } = await supabase
                .from('cards')
                .select('*')
                .eq('acquired', false);

            if (cardsError) throw cardsError;

            const { data: userCards, error: userCardsError } = await supabase
                .from('cards')
                .select('*')
                .eq('user_id', state.currentUser.id)
                .eq('acquired', true);

            if (userCardsError) throw userCardsError;

            state.cards = cards || [];
            state.userCards = userCards || [];
            ui.filterCards();
            if (state.isAdmin) document.getElementById('adminButton')?.classList.remove('hidden');
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userName').textContent = state.currentUser.username;
            document.getElementById('userBalanceAccount').textContent = `R$${state.currentUser.balance.toFixed(2)}`;
            document.getElementById('userNameAccount').textContent = state.currentUser.username;
            ui.loadUserCards();
        } catch (error) {
            showNotification(`Erro ao carregar cartões: ${error.message || 'Tente novamente.'}`);
        }
    },
    showConfirmPurchaseModal(cardNumber) {
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
        document.getElementById('confirmTotalAmount').textContent = card.price ? card.price.toFixed(2) : '10.00';
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
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const price = card.price || 10.00;
        if (state.currentUser.balance < price) {
            showNotification('Saldo insuficiente.');
            return;
        }
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, balance')
                .eq('id', state.currentUser.id)
                .single();

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const { data: cardData, error: cardError } = await supabase
                .from('cards')
                .select('*')
                .eq('numero', cardNumber)
                .eq('acquired', false)
                .single();

            if (cardError || !cardData) throw new Error('Cartão não encontrado ou já foi adquirido.');

            const newBalance = user.balance - price;
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', state.currentUser.id);

            if (updateUserError) throw updateUserError;

            const { error: updateCardError } = await supabase
                .from('cards')
                .update({ user_id: state.currentUser.id, acquired: true })
                .eq('id', cardData.id);

            if (updateCardError) throw updateCardError;

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = state.cards.filter(c => c.numero !== cardNumber);
            state.userCards.push(cardData);
            ui.closeConfirmPurchaseModal();
            ui.filterCards();
            ui.loadUserCards();
            document.getElementById('userBalanceHeader').textContent = state.currentUser.balance.toFixed(2);
            document.getElementById('userBalanceAccount').textContent = `R$${newBalance.toFixed(2)}`;
            showNotification('Compra realizada com sucesso!', 'success');
        } catch (error) {
            showNotification(`Erro ao realizar compra: ${error.message || 'Tente novamente.'}`);
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

            if (usersError) throw usersError;

            state.users = users || [];
            ui.displayUsers();
            document.getElementById('addUserButton')?.classList.remove('hidden');
        } catch (error) {
            showNotification(`Erro ao carregar usuários: ${error.message || 'Tente novamente.'}`);
        }
    },
    async loadAdminCards() {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            window.location.href = 'shop.html';
            return;
        }
        try {
            const { data: cards, error } = await supabase
                .from('cards')
                .select('*')
                .eq('acquired', false);

            if (error) throw error;

            state.cards = cards || [];
            ui.displayAdminCards();
            document.getElementById('addCardButton')?.classList.remove('hidden');
        } catch (error) {
            showNotification(`Erro ao carregar cartões: ${error.message || 'Tente novamente.'}`);
        }
    },
    async editUserBalance(username, newBalance) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (isNaN(newBalance) || newBalance < 0) {
            showNotification('Saldo inválido.');
            return;
        }
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', user.id);

            if (updateError) throw updateError;

            if (state.currentUser.username === username) {
                state.currentUser.balance = newBalance;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            }

            showNotification('Saldo atualizado com sucesso!', 'success');
            ui.closeModal();
            admin.loadUsers();
            if (state.currentUser.username === username) {
                document.getElementById('userBalanceHeader').textContent = newBalance.toFixed(2);
                document.getElementById('userBalanceAccount').textContent = `R$${newBalance.toFixed(2)}`;
            }
        } catch (error) {
            showNotification(`Erro ao atualizar saldo: ${error.message || 'Tente novamente.'}`);
        }
    },
    async addUser(username, password, balance, isAdmin) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
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
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (existingUser) {
                showNotification('Usuário já existe!');
                return;
            }

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const { error: insertError } = await supabase
                .from('users')
                .insert([{ username, password, balance, is_admin: isAdmin }]);

            if (insertError) throw insertError;

            showNotification('Usuário adicionado com sucesso!', 'success');
            ui.closeModal();
            admin.loadUsers();
        } catch (error) {
            showNotification(`Erro ao adicionar usuário: ${error.message || 'Tente novamente.'}`);
        }
    },
    async editUser(username, balance, isAdmin, password) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (isNaN(balance) || balance < 0) {
            showNotification('Saldo inválido.');
            return;
        }
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const updatedData = { balance, is_admin: isAdmin };
            if (password && password.length >= CONFIG.MIN_PASSWORD_LENGTH) {
                updatedData.password = password;
            }

            const { error } = await supabase
                .from('users')
                .update(updatedData)
                .eq('id', user.id);

            if (error) throw error;

            if (state.currentUser.username === username) {
                state.currentUser.balance = balance;
                state.currentUser.is_admin = isAdmin;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            }

            showNotification('Usuário atualizado com sucesso!', 'success');
            ui.closeModal();
            admin.loadUsers();
            if (state.currentUser.username === username) {
                document.getElementById('userBalanceHeader').textContent = balance.toFixed(2);
                document.getElementById('userBalanceAccount').textContent = `R$${balance.toFixed(2)}`;
            }
        } catch (error) {
            showNotification(`Erro ao atualizar usuário: ${error.message || 'Tente novamente.'}`);
        }
    },
    async deleteUser(username) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (username === state.currentUser.username) {
            showNotification('Você não pode excluir sua própria conta.');
            return;
        }
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (userError || !user) {
                showNotification('Usuário não encontrado.');
                return;
            }

            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', user.id);

            if (error) throw error;

            showNotification('Usuário excluído com sucesso!', 'success');
            admin.loadUsers();
        } catch (error) {
            showNotification(`Erro ao excluir usuário: ${error.message || 'Tente novamente.'}`);
        }
    },
    async deleteCard(cardNumber) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        try {
            const { data: card, error: cardError } = await supabase
                .from('cards')
                .select('id')
                .eq('numero', cardNumber)
                .eq('acquired', false)
                .single();

            if (cardError || !card) throw new Error('Cartão não encontrado.');

            const { error } = await supabase
                .from('cards')
                .delete()
                .eq('id', card.id);

            if (error) throw error;

            showNotification('Cartão excluído com sucesso!', 'success');
            admin.loadAdminCards();
        } catch (error) {
            showNotification(`Erro ao excluir cartão: ${error.message || 'Tente novamente.'}`);
        }
    },
    async editCard(cardData) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (!validateCardNumber(cardData.numero)) {
            showNotification('Número de cartão inválido!');
            return;
        }
        if (!validateCardCvv(cardData.cvv)) {
            showNotification('CVV inválido!');
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
            const { data: card, error: cardError } = await supabase
                .from('cards')
                .select('id')
                .eq('numero', document.getElementById('editCardModal').dataset.cardNumber)
                .single();

            if (cardError || !card) throw new Error('Cartão não encontrado.');

            const { error } = await supabase
                .from('cards')
                .update(cardData)
                .eq('id', card.id);

            if (error) throw error;

            showNotification('Cartão atualizado com sucesso!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(`Erro ao atualizar cartão: ${error.message || 'Tente novamente.'}`);
        }
    },
    async saveCard(cardData) {
        if (!checkAuth() || !state.currentUser || !state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        if (!validateCardNumber(cardData.numero)) {
            showNotification('Número de cartão inválido!');
            return;
        }
        if (!validateCardCvv(cardData.cvv)) {
            showNotification('CVV inválido!');
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
                .eq('numero', cardData.numero)
                .single();

            if (existingCard) {
                showNotification('Cartão já existe!');
                return;
            }

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const { error: insertError } = await supabase
                .from('cards')
                .insert([cardData]);

            if (insertError) throw insertError;

            showNotification('Cartão adicionado com sucesso!', 'success');
            ui.closeModal();
            admin.loadAdminCards();
        } catch (error) {
            showNotification(`Erro ao adicionar cartão: ${error.message || 'Tente novamente.'}`);
        }
    }
};

const ui = {
    toggleForms() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.toggle('hidden');
            registerContainer.classList.toggle('hidden');
        }
    },
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
                <button class="card-button" data-card-number="${card.numero}">Comprar por R$ ${card.price ? card.price.toFixed(2) : '10.00'}</button>
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
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
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
            showNotification('Saldo adicionado com sucesso!', 'success');
            ui.closeModal();
        } catch (error) {
            showNotification(`Erro ao adicionar saldo: ${error.message || 'Tente novamente.'}`);
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
                    <button class="action-button" data-username="${user.username}" data-action="edit-balance">Editar Saldo</button>
                    <button class="action-button" data-username="${user.username}" data-action="edit-user">Editar</button>
                    <button class="delete-button" data-username="${user.username}" data-action="delete-user">Excluir</button>
                </td>
            `;
            userList.querySelector('tbody').appendChild(userElement);
        });
    },
    showEditBalanceModal(username) {
        if (!state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        const modal = document.getElementById('editBalanceModal');
        if (!modal) return;
        modal.dataset.username = username;
        document.getElementById('editBalanceAmount').value = '';
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },
    showEditUserModal(username) {
        if (!state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
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
    showAddUserModal() {
        if (!state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        const modal = document.getElementById('addUserModal');
        if (modal) {
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('newBalance').value = '';
            document.getElementById('newIsAdmin').value = 'false';
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
                    <button class="action-button" data-card-number="${card.numero}" data-action="edit-card">Editar</button>
                    <button class="delete-button" data-card-number="${card.numero}" data-action="delete-card">Excluir</button>
                </td>
            `;
            cardList.querySelector('tbody').appendChild(cardElement);
        });
    },
    showEditCardModal(cardNumber) {
        if (!state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            showNotification('Cartão não encontrado.');
            return;
        }
        const modal = document.getElementById('editCardModal');
        if (modal) {
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
        }
    },
    showAddCardModal() {
        if (!state.isAdmin) {
            showNotification('Acesso negado.');
            return;
        }
        const modal = document.getElementById('addCardModal');
        if (modal) {
            document.getElementById('cardNumber').value = '';
            document.getElementById('cardCvv').value = '';
            document.getElementById('cardExpiry').value = '';
            document.getElementById('cardName').value = '';
            document.getElementById('cardCpf').value = '';
            document.getElementById('cardBrand').value = 'Visa';
            document.getElementById('cardBank').value = 'Nubank';
            document.getElementById('cardLevel').value = 'Classic';
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    }
};

function setupEventListeners() {
    // Index.html
    document.getElementById('loginButton')?.addEventListener('click', () => {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        auth.login(username, password);
    });

    document.getElementById('registerButton')?.addEventListener('click', () => {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        auth.register(username, password, confirmPassword);
    });

    document.getElementById('toggleRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        ui.toggleForms();
    });

    document.getElementById('toggleLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        ui.toggleForms();
    });

    // Shop.html
    document.getElementById('logoutButton')?.addEventListener('click', auth.logout);
    document.getElementById('accountButton')?.addEventListener('click', ui.showAccountInfo);
    document.getElementById('walletButton')?.addEventListener('click', ui.showWallet);
    document.getElementById('addBalanceButton')?.addEventListener('click', ui.showAddBalanceForm);
    document.getElementById('adminButton')?.addEventListener('click', () => window.location.href = 'dashboard.html');
    document.getElementById('clearFiltersButton')?.addEventListener('click', ui.clearFilters);
    document.getElementById('confirmPurchaseButton')?.addEventListener('click', () => {
        const cardNumber = document.getElementById('confirmPurchaseModal').dataset.cardNumber;
        shop.purchaseCard(cardNumber);
    });
    document.getElementById('cancelPurchaseButton')?.addEventListener('click', ui.closeConfirmPurchaseModal);
    document.getElementById('closeWalletButton')?.addEventListener('click', ui.closeModal);
    document.getElementById('addBalanceConfirmButton')?.addEventListener('click', ui.addBalance);
    document.getElementById('cancelRechargeButton')?.addEventListener('click', ui.closeModal);

    document.getElementById('cardList')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-button')) {
            const cardNumber = e.target.dataset.cardNumber;
            shop.showConfirmPurchaseModal(cardNumber);
        }
    });

    document.getElementById('binFilter')?.addEventListener('input', ui.filterCards);
    document.getElementById('brandFilter')?.addEventListener('change', ui.filterCards);
    document.getElementById('bankFilter')?.addEventListener('change', ui.filterCards);
    document.getElementById('levelFilter')?.addEventListener('change', ui.filterCards);

    // Dashboard.html
    document.getElementById('shopButton')?.addEventListener('click', () => window.location.href = 'shop.html');
    document.getElementById('addUserButton')?.addEventListener('click', ui.showAddUserModal);
    document.getElementById('addCardButton')?.addEventListener('click', ui.showAddCardModal);
    document.getElementById('saveBalanceButton')?.addEventListener('click', () => {
        const username = document.getElementById('editBalanceModal').dataset.username;
        const newBalance = parseFloat(document.getElementById('editBalanceAmount').value);
        admin.editUserBalance(username, newBalance);
    });
    document.getElementById('cancelBalanceButton')?.addEventListener('click', ui.closeModal);
    document.getElementById('saveUserButton')?.addEventListener('click', () => {
        const username = document.getElementById('editUsername').value;
        const balance = parseFloat(document.getElementById('editBalance').value);
        const isAdmin = document.getElementById('editIsAdmin').value === 'true';
        const password = document.getElementById('editPassword').value.trim();
        admin.editUser(username, balance, isAdmin, password);
    });
    document.getElementById('cancelUserButton')?.addEventListener('click', ui.closeModal);
    document.getElementById('addUserConfirmButton')?.addEventListener('click', () => {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const balance = parseFloat(document.getElementById('newBalance').value) || 0;
        const isAdmin = document.getElementById('newIsAdmin').value === 'true';
        admin.addUser(username, password, balance, isAdmin);
    });
    document.getElementById('cancelAddUserButton')?.addEventListener('click', ui.closeModal);
    document.getElementById('saveCardButton')?.addEventListener('click', () => {
        const cardData = {
            numero: document.getElementById('editCardNumber').value.trim(),
            cvv: document.getElementById('editCardCvv').value.trim(),
            validade: document.getElementById('editCardExpiry').value.trim(),
            nome: document.getElementById('editCardName').value.trim(),
            cpf: document.getElementById('editCardCpf').value.trim(),
            bandeira: document.getElementById('editCardBrand').value,
            banco: document.getElementById('editCardBank').value,
            nivel: document.getElementById('editCardLevel').value,
            bin: document.getElementById('editCardNumber').value.trim().replace(/\s/g, '').substring(0, 6),
            pais: 'Brazil',
            acquired: false,
            user_id: null
        };
        admin.editCard(cardData);
    });
    document.getElementById('cancelCardButton')?.addEventListener('click', ui.closeModal);
    document.getElementById('addCardConfirmButton')?.addEventListener('click', () => {
        const cardData = {
            numero: document.getElementById('cardNumber').value.trim(),
            cvv: document.getElementById('cardCvv').value.trim(),
            validade: document.getElementById('cardExpiry').value.trim(),
            nome: document.getElementById('cardName').value.trim(),
            cpf: document.getElementById('cardCpf').value.trim(),
            bandeira: document.getElementById('cardBrand').value,
            banco: document.getElementById('cardBank').value,
            nivel: document.getElementById('cardLevel').value,
            bin: document.getElementById('cardNumber').value.trim().replace(/\s/g, '').substring(0, 6),
            pais: 'Brazil',
            acquired: false,
            user_id: null,
            price: 10.00 // Assumindo preço padrão; idealmente, adicionar campo no formulário
        };
        admin.saveCard(cardData);
    });
    document.getElementById('cancelAddCardButton')?.addEventListener('click', ui.closeModal);

    document.getElementById('userList')?.addEventListener('click', (e) => {
        const target = e.target;
        if (target.dataset.action === 'edit-balance') {
            ui.showEditBalanceModal(target.dataset.username);
        } else if (target.dataset.action === 'edit-user') {
            ui.showEditUserModal(target.dataset.username);
        } else if (target.dataset.action === 'delete-user') {
            admin.deleteUser(target.dataset.username);
        }
    });

    document.getElementById('adminCardList')?.addEventListener('click', (e) => {
        const target = e.target;
        if (target.dataset.action === 'edit-card') {
            ui.showEditCardModal(target.dataset.cardNumber);
        } else if (target.dataset.action === 'delete-card') {
            admin.deleteCard(target.dataset.cardNumber);
        }
    });

    // Formatações
    document.getElementById('cardNumber')?.addEventListener('input', (e) => formatCardNumber(e.target));
    document.getElementById('cardCvv')?.addEventListener('input', (e) => restrictCvv(e.target));
    document.getElementById('cardExpiry')?.addEventListener('input', (e) => formatExpiry(e.target));
    document.getElementById('cardCpf')?.addEventListener('input', (e) => formatCPF(e.target));
    document.getElementById('editCardNumber')?.addEventListener('input', (e) => formatCardNumber(e.target));
    document.getElementById('editCardCvv')?.addEventListener('input', (e) => restrictCvv(e.target));
    document.getElementById('editCardExpiry')?.addEventListener('input', (e) => formatExpiry(e.target));
    document.getElementById('editCardCpf')?.addEventListener('input', (e) => formatCPF(e.target));
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
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
