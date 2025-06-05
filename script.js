/**
 * LOGAN CC's - Lógica Principal em JavaScript
 * Gerencia autenticação, loja, operações administrativas e interface do usuário.
 * Usa Supabase para integração com backend, com senhas em texto puro.
 * Todas as mensagens e comentários em português.
 */

// --- Configuração ---
const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 4,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_TIME_MS: 60000,
    NOTIFICATION_TIMEOUT_MS: 5000,
    SUPABASE_URL: 'https://nphqfkfdjjpiqssdyanb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g',
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY_MS: 1000,
    DEBOUNCE_DELAY_MS: 300,
    CACHE_TTL_MS: 30 * 60 * 1000 // 30 minutos
};

// --- Estado ---
const state = {
    users: [],
    cards: [],
    userCards: [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    isAdmin: false,
    loginAttempts: 0,
    loginBlockedUntil: 0,
    sessionStart: parseInt(localStorage.getItem('sessionStart') || '0'),
    lastActionTime: 0,
    cache: {
        cards: { data: null, timestamp: 0 },
        users: { data: null, timestamp: 0 }
    }
};

// --- Cliente Supabase ---
const supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// --- Funções Utilitárias ---
const utils = {
    async withRetry(queryFn, attempts = CONFIG.RETRY_ATTEMPTS) {
        for (let i = 0; i <= attempts; i++) {
            try {
                const result = await queryFn();
                return result;
            } catch (error) {
                if (i === attempts) throw error;
                console.warn(`Tentativa ${i + 1} falhou: ${error.message}. Retentando...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
            }
        }
    },

    checkAuth() {
        if (!state.currentUser?.id) {
            console.warn('checkAuth: Usuário não logado.');
            return false;
        }
        const sessionDuration = (Date.now() - state.sessionStart) / 1000 / 60;
        if (sessionDuration > CONFIG.SESSION_TIMEOUT_MINUTES) {
            console.warn('checkAuth: Sessão expirada.');
            auth.logout();
            return false;
        }
        return true;
    },

    sanitizeInput(input) {
        return DOMPurify.sanitize(input.replace(/[<>]/g, ''));
    },

    validateCardNumber(number) {
        const cleaned = number.replace(/\s/g, '');
        return cleaned.length === 16 && /^\d+$/.test(cleaned);
    },

    validateCardCvv(cvv) {
        return cvv.length === 3 && /^\d+$/.test(cvv);
    },

    validateCardExpiry(expiry) {
        const [month, year] = expiry.split('/');
        if (!month || !year || month.length !== 2 || year.length !== 2) return false;
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(`20${year}`, 10);
        if (monthNum < 1 || monthNum > 12) return false;
        const currentDate = new Date();
        const expiryDate = new Date(yearNum, monthNum - 1, 1);
        return expiryDate >= currentDate;
    },

    validateCardCpf(cpf) {
        const cleaned = cpf.replace(/[\.-]/g, '');
        return cleaned.length === 11 && /^\d+$/.test(cleaned);
    },

    debounce() {
        const now = Date.now();
        if (now - state.lastActionTime < CONFIG.DEBOUNCE_DELAY_MS) {
            console.warn('Ação bloqueada por debounce.');
            return false;
        }
        state.lastActionTime = now;
        return true;
    },

    getCachedData(key) {
        const cache = state.cache[key];
        if (cache.data && Date.now() - cache.timestamp < CONFIG.CACHE_TTL_MS) {
            return cache.data;
        }
        return null;
    },

    setCachedData(key, data) {
        state.cache[key] = { data, timestamp: Date.now() };
    }
};

// --- Módulo de Autenticação ---
const auth = {
    async login(username, password) {
        if (!utils.debounce()) {
            ui.showError('login', 'Aguarde antes de tentar novamente.');
            return;
        }

        username = utils.sanitizeInput(username);
        password = utils.sanitizeInput(password);

        if (!username || !password) {
            ui.showError('login', 'Usuário e senha são obrigatórios.');
            return;
        }

        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            ui.showError('login', `Bloqueado por muitas tentativas. Aguarde ${timeLeft} segundos.`);
            return;
        }

        ui.toggleLoading('loginButton', true);
        ui.showNotification('Verificando usuário...', 'info');

        try {
            const { data, error } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id, username, password, balance, is_admin')
                    .eq('username', username)
                    .single()
            );

            if (error || !data) {
                state.loginAttempts++;
                console.warn(`Login falhou: Tentativa ${state.loginAttempts}/${CONFIG.MAX_LOGIN_ATTEMPTS}`);
                if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                    state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_TIME_MS;
                    ui.showError('login', 'Muitas tentativas. Aguarde 60 segundos.');
                } else {
                    ui.showError('login', 'Usuário ou senha incorretos.');
                }
                return;
            }

            if (data.password !== password) {
                state.loginAttempts++;
                console.warn(`Login falhou: Tentativa ${state.loginAttempts}/${CONFIG.MAX_LOGIN_ATTEMPTS}`);
                if (state.loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                    state.loginBlockedUntil = Date.now() + CONFIG.LOGIN_BLOCK_TIME_MS;
                    ui.showError('login', 'Muitas tentativas. Aguarde 60 segundos.');
                } else {
                    ui.showError('login', 'Senha incorreta.');
                }
                return;
            }

            state.currentUser = {
                id: data.id,
                username: data.username,
                balance: data.balance || 0,
                is_admin: data.is_admin || false
            };
            state.isAdmin = data.is_admin || false;
            state.loginAttempts = 0;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            localStorage.setItem('sessionStart', Date.now().toString());
            console.log('Login bem-sucedido:', state.currentUser);
            ui.showSuccess(`Bem-vindo, ${username}!`);
            ui.clearForm('login');
            setTimeout(() => window.location.href = 'Shop.html', 1000);
        } catch (error) {
            console.error('Erro no login:', error);
            let mensagemErro = 'Erro ao conectar. Tente novamente.';
            if (error.code === 'PGRST116') {
                mensagemErro = 'Usuário ou senha incorretos.';
            } else if (error.message.includes('network')) {
                mensagemErro = 'Sem conexão com a internet. Verifique sua rede.';
            } else if (error.code === '42501') {
                mensagemErro = 'Acesso negado ao banco de dados. Contate o suporte.';
            }
            ui.showError('login', mensagemErro);
        } finally {
            ui.toggleLoading('loginButton', false);
        }
    },

    async register(username, password, confirmPassword) {
        if (!utils.debounce()) {
            ui.showError('register', 'Aguarde antes de tentar novamente.');
            return;
        }

        username = utils.sanitizeInput(username);
        password = utils.sanitizeInput(password);
        confirmPassword = utils.sanitizeInput(confirmPassword);

        if (!username || !password || !confirmPassword) {
            ui.showError('register', 'Todos os campos são obrigatórios.');
            return;
        }

        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            ui.showError('register', `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }

        if (password !== confirmPassword) {
            ui.showError('register', 'As senhas não coincidem.');
            return;
        }

        ui.toggleLoading('registerButton', true);
        ui.showNotification('Criando conta...', 'info');

        try {
            const { data: existingUser, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .single()
            );

            if (existingUser) {
                ui.showError('register', 'Este usuário já existe.');
                return;
            }

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const { error: insertError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .insert([{ username, password, balance: 0, is_admin: false }])
            );

            if (insertError) throw insertError;

            ui.showSuccess('Conta criada! Faça login para continuar.');
            ui.clearForm('register');
            ui.toggleForms();
        } catch (error) {
            console.error('Erro no registro:', error);
            let mensagemErro = 'Erro ao registrar. Tente novamente.';
            if (error.code === '23505') {
                mensagemErro = 'Usuário já existe.';
            } else if (error.message.includes('network')) {
                mensagemErro = 'Sem conexão com a internet. Verifique sua rede.';
            } else if (error.code === '42501') {
                mensagemErro = 'Acesso negado ao banco de dados. Contate o suporte.';
            }
            ui.showError('register', mensagemErro);
        } finally {
            ui.toggleLoading('registerButton', false);
        }
    },

    logout() {
        console.log('Logout:', state.currentUser?.username);
        state.currentUser = null;
        state.isAdmin = false;
        state.loginAttempts = 0;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionStart');
        ui.showSuccess('Logout realizado com sucesso!');
        window.location.href = 'Index.html';
    }
};

// --- Módulo da Loja ---
const shop = {
    async loadCards() {
        if (!utils.checkAuth()) {
            ui.showError('global', 'Faça login para acessar a loja.');
            setTimeout(() => window.location.href = 'Index.html', 1000);
            return;
        }

        const cachedCards = utils.getCachedData('cards');
        if (cachedCards) {
            state.cards = cachedCards.available;
            state.userCards = cachedCards.user;
            ui.updateUserInfo();
            ui.filterCards();
            if (state.isAdmin) ui.showAdminButton();
            ui.loadUserCards();
            ui.showSuccess('Cartões carregados do cache.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Carregando cartões...', 'info');

        try {
            const [cardsResponse, userCardsResponse] = await Promise.all([
                utils.withRetry(() =>
                    supabase
                        .from('cards')
                        .select('*')
                        .eq('acquired', false)
                ),
                utils.withRetry(() =>
                    supabase
                        .from('cards')
                        .select('*')
                        .eq('user_id', state.currentUser.id)
                        .eq('acquired', true)
                )
            ]);

            if (cardsResponse.error) throw cardsResponse.error;
            if (userCardsResponse.error) throw userCardsResponse.error;

            state.cards = cardsResponse.data || [];
            state.userCards = userCardsResponse.data || [];
            utils.setCachedData('cards', { available: state.cards, user: state.userCards });
            ui.updateUserInfo();
            ui.filterCards();
            if (state.isAdmin) ui.showAdminButton();
            ui.loadUserCards();
            ui.showSuccess('Cartões carregados com sucesso!');
        } catch (error) {
            console.error('Erro ao carregar cartões:', error);
            ui.showError('global', `Erro ao carregar cartões: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    showConfirmPurchaseModal(cardNumber) {
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            ui.showError('global', 'Cartão não encontrado.');
            return;
        }
        ui.showModal('confirmPurchaseModal', {
            cardDetails: card,
            totalAmount: (card.price || 10.00).toFixed(2),
            userBalance: state.currentUser.balance.toFixed(2),
            cardNumber
        });
        ui.showNotification('Confirmação de compra aberta.', 'info');
    },

    async purchaseCard(cardNumber) {
        if (!utils.checkAuth()) {
            ui.showError('global', 'Faça login para comprar.');
            setTimeout(() => window.location.href = 'Index.html', 1000);
            return;
        }

        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            ui.showError('global', 'Cartão não encontrado.');
            return;
        }

        const price = card.price || 10.00;
        if (state.currentUser.balance < price) {
            ui.showError('global', 'Saldo insuficiente.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Processando compra...', 'info');

        try {
            const { data: user, error: userError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id, balance')
                    .eq('id', state.currentUser.id)
                    .single()
            );

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const { data: cardData, error: cardError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .select('*')
                    .eq('numero', cardNumber)
                    .eq('acquired', false)
                    .single()
            );

            if (cardError || !cardData) throw new Error('Cartão não encontrado ou já comprado.');

            const newBalance = user.balance - price;
            const [updateUserResponse, updateCardResponse] = await Promise.all([
                utils.withRetry(() =>
                    supabase
                        .from('users')
                        .update({ balance: newBalance })
                        .eq('id', state.currentUser.id)
                ),
                utils.withRetry(() =>
                    supabase
                        .from('cards')
                        .update({ user_id: state.currentUser.id, acquired: true })
                        .eq('id', cardData.id)
                )
            ]);

            if (updateUserResponse.error) throw updateUserResponse.error;
            if (updateCardResponse.error) throw updateCardResponse.error;

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            state.cards = state.cards.filter(c => c.numero !== cardNumber);
            state.userCards.push(cardData);
            utils.setCachedData('cards', { available: state.cards, user: state.userCards });
            ui.closeModal('confirmPurchaseModal');
            ui.filterCards();
            ui.loadUserCards();
            ui.updateUserInfo();
            ui.showSuccess('Compra realizada com sucesso!');
            console.log('Compra:', { user: state.currentUser.username, card: cardNumber, price });
        } catch (error) {
            console.error('Erro na compra:', error);
            ui.showError('global', `Erro ao comprar: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    }
};

// --- Módulo Administrativo ---
const admin = {
    async loadUsers() {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado: Apenas administradores.');
            setTimeout(() => window.location.href = 'Shop.html', 1000);
            return;
        }

        const cachedUsers = utils.getCachedData('users');
        if (cachedUsers) {
            state.users = cachedUsers;
            ui.displayUsers();
            ui.showElement('addUserButton');
            ui.showSuccess('Usuários carregados do cache.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Carregando usuários...', 'info');

        try {
            const { data, error } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id, username, balance, is_admin')
            );

            if (error) throw error;

            state.users = data || [];
            utils.setCachedData('users', state.users);
            ui.displayUsers();
            ui.showElement('addUserButton');
            ui.showSuccess('Usuários carregados com sucesso!');
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            ui.showError('global', `Erro ao carregar usuários: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async loadAdminCards() {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado: Apenas administradores.');
            setTimeout(() => window.location.href = 'Shop.html', 1000);
            return;
        }

        const cachedCards = utils.getCachedData('cards');
        if (cachedCards) {
            state.cards = cachedCards.available;
            ui.displayAdminCards();
            ui.showElement('addCardButton');
            ui.showSuccess('Cartões carregados do cache.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Carregando cartões...', 'info');

        try {
            const { data, error } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .select('*')
                    .eq('acquired', false)
            );

            if (error) throw error;

            state.cards = data || [];
            utils.setCachedData('cards', { available: state.cards, user: state.userCards });
            ui.displayAdminCards();
            ui.showElement('addCardButton');
            ui.showSuccess('Cartões carregados com sucesso!');
        } catch (error) {
            console.error('Erro ao carregar cartões:', error);
            ui.showError('global', `Erro ao carregar cartões: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async editUserBalance(username, newBalance) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        if (isNaN(newBalance) || newBalance < 0) {
            ui.showError('editBalance', 'Saldo inválido.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Atualizando saldo...', 'info');

        try {
            const { data: user, error: userError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single()
            );

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const { error: updateError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .update({ balance: newBalance })
                    .eq('id', user.id)
            );

            if (updateError) throw updateError;

            if (state.currentUser.username === username) {
                state.currentUser.balance = newBalance;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
                ui.updateUserInfo();
            }

            state.users = state.users.map(u => u.username === username ? { ...u, balance: newBalance } : u);
            utils.setCachedData('users', state.users);
            ui.showSuccess('Saldo atualizado com sucesso!');
            ui.closeModal('editBalanceModal');
            ui.displayUsers();
            console.log('Saldo atualizado:', { username, newBalance });
        } catch (error) {
            console.error('Erro ao atualizar saldo:', error);
            ui.showError('editBalance', `Erro ao atualizar saldo: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async addUser(username, password, balance, isAdmin) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        username = utils.sanitizeInput(username);
        password = utils.sanitizeInput(password);

        if (!username || !password) {
            ui.showError('addUser', 'Usuário e senha são obrigatórios.');
            return;
        }

        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            ui.showError('addUser', `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }

        if (isNaN(balance) || balance < 0) {
            ui.showError('addUser', 'Saldo inválido.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Adicionando usuário...', 'info');

        try {
            const { data: existingUser, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .single()
            );

            if (existingUser) {
                ui.showError('addUser', 'Usuário já existe.');
                return;
            }

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const { data, error: insertError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .insert([{ username, password, balance, is_admin: isAdmin }])
                    .select()
                    .single()
            );

            if (insertError) throw insertError;

            state.users.push(data);
            utils.setCachedData('users', state.users);
            ui.showSuccess('Usuário adicionado com sucesso!');
            ui.closeModal('addUserModal');
            ui.displayUsers();
            console.log('Usuário adicionado:', { username, balance, isAdmin });
        } catch (error) {
            console.error('Erro ao adicionar usuário:', error);
            ui.showError('addUser', `Erro ao adicionar usuário: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async editUser(username, balance, isAdmin, password) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        username = utils.sanitizeInput(username);
        password = password ? utils.sanitizeInput(password) : null;

        if (isNaN(balance) || balance < 0) {
            ui.showError('editUser', 'Saldo inválido.');
            return;
        }

        if (password && password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            ui.showError('editUser', `A senha deve ter pelo menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }

        ui.showLoader();
        ui.showNotification('Atualizando usuário...', 'info');

        try {
            const { data: user, error: userError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single()
            );

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const updatedData = { balance, is_admin: isAdmin };
            if (password) updatedData.password = password;

            const { error } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .update(updatedData)
                    .eq('id', user.id)
            );

            if (error) throw error;

            if (state.currentUser.username === username) {
                state.currentUser.balance = balance;
                state.currentUser.is_admin = isAdmin;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
                ui.updateUserInfo();
            }

            state.users = state.users.map(u => u.username === username ? { ...u, balance, is_admin: isAdmin } : u);
            utils.setCachedData('users', state.users);
            ui.showSuccess('Usuário atualizado com sucesso!');
            ui.closeModal('editUserModal');
            ui.displayUsers();
            console.log('Usuário atualizado:', { username, balance, isAdmin });
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            ui.showError('editUser', `Erro ao atualizar usuário: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async deleteUser(username) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        if (username === state.currentUser.username) {
            ui.showError('global', 'Você não pode excluir sua própria conta.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Excluindo usuário...', 'info');

        try {
            const { data: user, error: userError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single()
            );

            if (userError || !user) {
                ui.showError('global', 'Usuário não encontrado.');
                return;
            }

            const { error } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .delete()
                    .eq('id', user.id)
            );

            if (error) throw error;

            state.users = state.users.filter(u => u.username !== username);
            utils.setCachedData('users', state.users);
            ui.showSuccess('Usuário excluído com sucesso!');
            ui.displayUsers();
            console.log('Usuário excluído:', { username });
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            ui.showError('global', `Erro ao excluir usuário: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async deleteCard(cardNumber) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Excluindo cartão...', 'info');

        try {
            const { data: card, error: cardError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .select('id')
                    .eq('numero', cardNumber)
                    .eq('acquired', false)
                    .single()
            );

            if (cardError || !card) throw new Error('Cartão não encontrado.');

            const { error } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .delete()
                    .eq('id', card.id)
            );

            if (error) throw error;

            state.cards = state.cards.filter(c => c.numero !== cardNumber);
            utils.setCachedData('cards', { available: state.cards, user: state.userCards });
            ui.showSuccess('Cartão excluído com sucesso!');
            ui.displayAdminCards();
            console.log('Cartão excluído:', { cardNumber });
        } catch (error) {
            console.error('Erro ao excluir cartão:', error);
            ui.showError('global', `Erro ao excluir cartão: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async editCard(cardData) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        cardData.numero = utils.sanitizeInput(cardData.numero);
        cardData.cvv = utils.sanitizeInput(cardData.cvv);
        cardData.validade = utils.sanitizeInput(cardData.validade);
        cardData.nome = utils.sanitizeInput(cardData.nome);
        cardData.cpf = utils.sanitizeInput(cardData.cpf);
        cardData.bandeira = utils.sanitizeInput(cardData.bandeira);
        cardData.banco = utils.sanitizeInput(cardData.banco);
        cardData.nivel = utils.sanitizeInput(cardData.nivel);

        if (!utils.validateCardNumber(cardData.numero)) {
            ui.showError('editCard', 'Número de cartão inválido (16 dígitos).');
            return;
        }
        if (!utils.validateCardCvv(cardData.cvv)) {
            ui.showError('editCard', 'CVV inválido (3 dígitos).');
            return;
        }
        if (!utils.validateCardExpiry(cardData.validade)) {
            ui.showError('editCard', 'Validade inválida ou expirada (MM/AA).');
            return;
        }
        if (!utils.validateCardCpf(cardData.cpf)) {
            ui.showError('editCard', 'CPF inválido (11 dígitos).');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            ui.showError('editCard', 'Preencha todos os campos obrigatórios.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Atualizando cartão...', 'info');

        try {
            const { data: card, error: cardError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .select('id')
                    .eq('numero', document.getElementById('editCardModal').dataset.cardNumber)
                    .single()
            );

            if (cardError || !card) throw new Error('Cartão não encontrado.');

            const { error } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .update(cardData)
                    .eq('id', card.id)
            );

            if (error) throw error;

            state.cards = state.cards.map(c => c.numero === cardData.numero ? cardData : c);
            utils.setCachedData('cards', { available: state.cards, user: state.userCards });
            ui.showSuccess('Cartão atualizado com sucesso!');
            ui.closeModal('editCardModal');
            ui.displayAdminCards();
            console.log('Cartão atualizado:', cardData);
        } catch (error) {
            console.error('Erro ao atualizar cartão:', error);
            ui.showError('editCard', `Erro ao atualizar cartão: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    async saveCard(cardData) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        cardData.numero = utils.sanitizeInput(cardData.numero);
        cardData.cvv = utils.sanitizeInput(cardData.cvv);
        cardData.validade = utils.sanitizeInput(cardData.validade);
        cardData.nome = utils.sanitizeInput(cardData.nome);
        cardData.cpf = utils.sanitizeInput(cardData.cpf);
        cardData.bandeira = utils.sanitizeInput(cardData.bandeira);
        cardData.banco = utils.sanitizeInput(cardData.banco);
        cardData.nivel = utils.sanitizeInput(cardData.nivel);

        if (!utils.validateCardNumber(cardData.numero)) {
            ui.showError('addCard', 'Número de cartão inválido (16 dígitos).');
            return;
        }
        if (!utils.validateCardCvv(cardData.cvv)) {
            ui.showError('addCard', 'CVV inválido (3 dígitos).');
            return;
        }
        if (!utils.validateCardExpiry(cardData.validade)) {
            ui.showError('addCard', 'Validade inválida ou expirada (MM/AA).');
            return;
        }
        if (!utils.validateCardCpf(cardData.cpf)) {
            ui.showError('addCard', 'CPF inválido (11 dígitos).');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            ui.showError('addCard', 'Preencha todos os campos obrigatórios.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Adicionando cartão...', 'info');

        try {
            const { data: existingCard, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .select('numero')
                    .eq('numero', cardData.numero)
                    .single()
            );

            if (existingCard) {
                ui.showError('addCard', 'Cartão já existe.');
                return;
            }

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const { data, error: insertError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .insert([cardData])
                    .select()
                    .single()
            );

            if (insertError) throw insertError;

            state.cards.push(data);
            utils.setCachedData('cards', { available: state.cards, user: state.userCards });
            ui.showSuccess('Cartão adicionado com sucesso!');
            ui.closeModal('addCardModal');
            ui.displayAdminCards();
            console.log('Cartão adicionado:', cardData);
        } catch (error) {
            console.error('Erro ao adicionar cartão:', error);
            ui.showError('addCard', `Erro ao adicionar cartão: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    }
};

// --- Módulo de Interface do Usuário ---
const ui = {
    showNotification(message, type = 'error') {
        const notificationsDiv = document.getElementById('notifications');
        if (!notificationsDiv) return;

        const notification = document.createElement('div');
        notification.className = `notification p-4 rounded-lg text-white`;
        notification.style.backgroundColor = type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#3B82F6';
        notification.textContent = utils.sanitizeInput(message);
        notificationsDiv.appendChild(notification);
        setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_TIMEOUT_MS);
    },

    showError(context, message) {
        this.showNotification(message, 'error');
        const errorElement = document.getElementById(`${context}Error`);
        if (errorElement) {
            errorElement.textContent = utils.sanitizeInput(message);
            errorElement.classList.add('show');
        }
    },

    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    toggleLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = isLoading;
            button.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Carregando...'
                : button.dataset.originalText || button.innerHTML;
            if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
        }
    },

    showLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.classList.add('show');
    },

    hideLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.classList.remove('show');
    },

    toggleForms() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.toggle('hidden');
            registerContainer.classList.toggle('hidden');
            this.showNotification('Formulário alterado.', 'info');
        }
    },

    clearForm(context) {
        const fields = {
            login: ['username', 'password'],
            register: ['newUsername', 'newPassword', 'confirmPassword']
        }[context] || [];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        const errorElement = document.getElementById(`${context}Error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
        }
    },

    updateUserInfo() {
        const elements = {
            userBalanceHeader: state.currentUser ? `R$${state.currentUser.balance.toFixed(2)}` : 'R$0.00',
            userNameAccount: state.currentUser?.username || 'N/A',
            userBalanceAccount: state.currentUser ? `R$${state.currentUser.balance.toFixed(2)}` : 'R$0.00'
        };
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = utils.sanitizeInput(value);
        });
        this.showNotification('Informações do usuário atualizadas.', 'info');
    },

    showAdminButton() {
        const adminButton = document.getElementById('adminButton');
        if (adminButton) adminButton.classList.remove('hidden');
    },

    showElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.remove('hidden');
    },

    filterCards() {
        if (!utils.debounce()) return;

        const cardList = document.getElementById('cardList');
        if (!cardList) return;

        const binFilter = document.getElementById('binFilter')?.value.trim() || '';
        const brandFilter = document.getElementById('brandFilter')?.value || 'all';
        const bankFilter = document.getElementById('bankFilter')?.value || 'all';
        const levelFilter = document.getElementById('levelFilter')?.value || 'all';

        const filteredCards = state.cards.filter(c =>
            (!binFilter || c.bin.startsWith(binFilter)) &&
            (brandFilter === 'all' || c.bandeira === brandFilter) &&
            (bankFilter === 'all' || c.banco === bankFilter) &&
            (levelFilter === 'all' || c.nivel === levelFilter)
        );

        cardList.innerHTML = '';
        if (filteredCards.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-center text-gray-400';
            empty.textContent = 'Nenhum cartão disponível.';
            cardList.appendChild(empty);
        } else {
            filteredCards.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                cardItem.innerHTML = `
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${utils.sanitizeInput(card.numero)}</p>
                        <p><i class="fas fa-university"></i> Banco: ${utils.sanitizeInput(card.banco)}</p>
                        <p><i class="fas fa-star"></i> Nível: ${utils.sanitizeInput(card.nivel)}</p>
                    </div>
                    <button class="card-button" data-card-number="${utils.sanitizeInput(card.numero)}">
                        Comprar por R$${card.price ? card.price.toFixed(2) : '10.00'}
                    </button>
                `;
                cardList.appendChild(cardItem);
            });
        }
        this.showNotification('Filtro de cartões aplicado.', 'info');
    },

    clearFilters() {
        const filters = ['binFilter', 'brandFilter', 'bankFilter', 'levelFilter'];
        filters.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = id === 'binFilter' ? '' : 'all';
        });
        this.filterCards();
        this.showNotification('Filtros limpos.', 'info');
    },

    showAccountInfo() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para acessar a conta.');
            setTimeout(() => window.location.href = 'Index.html', 1000);
            return;
        }
        const cardList = document.getElementById('cardList');
        const accountInfo = document.getElementById('accountInfo');
        if (cardList && accountInfo) {
            cardList.classList.add('hidden');
            accountInfo.classList.remove('hidden');
            this.updateUserInfo();
            this.loadUserCards();
            this.showNotification('Informações da conta exibidas.', 'info');
        }
    },

    showWallet() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para acessar a carteira.');
            setTimeout(() => window.location.href = 'Index.html', 1000);
            return;
        }
        this.showModal('walletModal');
        this.loadUserCardsWallet();
        this.showNotification('Carteira exibida.', 'info');
    },

    showAddBalanceForm() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para adicionar saldo.');
            setTimeout(() => window.location.href = 'Index.html', 1000);
            return;
        }
        this.showModal('rechargeModal');
        this.showNotification('Formulário de recarga aberto.', 'info');
    },

    async addBalance() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para adicionar saldo.');
            setTimeout(() => window.location.href = 'Index.html', 1000);
            return;
        }

        const amount = parseFloat(document.getElementById('rechargeAmount')?.value);
        if (isNaN(amount) || amount <= 0) {
            this.showError('recharge', 'Valor inválido.');
            return;
        }

        ui.showLoader();
        ui.showNotification('Adicionando saldo...', 'info');

        try {
            const { data: user, error: userError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('balance')
                    .eq('id', state.currentUser.id)
                    .single()
            );

            if (userError || !user) throw new Error('Usuário não encontrado.');

            const newBalance = user.balance + amount;
            const { error } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .update({ balance: newBalance })
                    .eq('id', state.currentUser.id)
            );

            if (error) throw error;

            state.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            this.updateUserInfo();
            this.showSuccess('Saldo adicionado com sucesso!');
            this.closeModal('rechargeModal');
            console.log('Saldo adicionado:', { user: state.currentUser.username, amount });
        } catch (error) {
            console.error('Erro ao adicionar saldo:', error);
            this.showError('recharge', `Erro ao adicionar saldo: ${error.message || 'Tente novamente.'}`);
        } finally {
            this.hideLoader();
        }
    },

    loadUserCards() {
        const userCards = document.getElementById('userCards');
        if (!userCards) return;

        const userCardsList = state.userCards.filter(c => c.user_id === state.currentUser.id);
        userCards.innerHTML = '';
        if (userCardsList.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-center text-gray-400';
            empty.textContent = 'Nenhum cartão adquirido.';
            userCards.appendChild(empty);
        } else {
            userCardsList.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                cardItem.innerHTML = `
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${utils.sanitizeInput(card.numero)}</p>
                        <p><i class="fas fa-university"></i> Banco: ${utils.sanitizeInput(card.banco)}</p>
                        <p><i class="fas fa-star"></i> Nível: ${utils.sanitizeInput(card.nivel)}</p>
                    </div>
                `;
                userCards.appendChild(cardItem);
            });
        }
        this.showNotification('Cartões do usuário carregados.', 'info');
    },

    loadUserCardsWallet() {
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (!userCardsWallet) return;

        const userCardsList = state.userCards.filter(c => c.user_id === state.currentUser.id);
        userCardsWallet.innerHTML = '';
        if (userCardsList.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-center text-gray-400';
            empty.textContent = 'Carteira vazia.';
            userCardsWallet.appendChild(empty);
        } else {
            userCardsList.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                cardItem.innerHTML = `
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${utils.sanitizeInput(card.numero)}</p>
                        <p><i class="fas fa-university"></i> Banco: ${utils.sanitizeInput(card.banco)}</p>
                        <p><i class="fas fa-star"></i> Nível: ${utils.sanitizeInput(card.nivel)}</p>
                        <p><i class="fas fa-calendar"></i> Validade: ${utils.sanitizeInput(card.validade)}</p>
                        <p><i class="fas fa-lock"></i> CVV: ${utils.sanitizeInput(card.cvv)}</p>
                    </div>
                `;
                userCardsWallet.appendChild(cardItem);
            });
        }
        this.showNotification('Cartões da carteira carregados.', 'info');
    },

    showModal(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (modalId === 'confirmPurchaseModal' && data.cardDetails) {
            const details = document.getElementById('confirmCardDetails');
            details.innerHTML = `
                <p><strong>Número:</strong> ${utils.sanitizeInput(data.cardDetails.numero)}</p>
                <p><strong>Bandeira:</strong> ${utils.sanitizeInput(data.cardDetails.bandeira)}</p>
                <p><strong>Banco:</strong> ${utils.sanitizeInput(data.cardDetails.banco)}</p>
                <p><strong>Nível:</strong> ${utils.sanitizeInput(data.cardDetails.nivel)}</p>
            `;
            document.getElementById('confirmTotalAmount').textContent = utils.sanitizeInput(data.totalAmount);
            document.getElementById('confirmUserBalance').textContent = utils.sanitizeInput(data.userBalance);
            modal.dataset.cardNumber = data.cardNumber;
        }

        modal.classList.add('show');
        this.showNotification(`Modal ${modalId} aberto.`, 'info');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            this.showNotification(`Modal ${modalId} fechado.`, 'info');
        }
    },

    displayUsers() {
        const userList = document.getElementById('userList');
        if (!userList) return;

        const tbody = userList.querySelector('tbody');
        tbody.innerHTML = '';
        state.users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><i class="fas fa-user"></i> ${utils.sanitizeInput(user.username)}</td>
                <td><i class="fas fa-coins"></i> R$${user.balance.toFixed(2)}</td>
                <td><i class="fas fa-crown"></i> ${user.is_admin ? 'Sim' : 'Não'}</td>
                <td>
                    <button class="action-button" data-username="${utils.sanitizeInput(user.username)}" data-action="edit-balance">Editar Saldo</button>
                    <button class="action-button" data-username="${utils.sanitizeInput(user.username)}" data-action="edit-user">Editar</button>
                    <button class="delete-button" data-username="${utils.sanitizeInput(user.username)}" data-action="delete-user">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        this.showNotification('Tabela de usuários atualizada.', 'info');
    },

    displayAdminCards() {
        const cardList = document.getElementById('adminCardList');
        if (!cardList) return;

        const tbody = cardList.querySelector('tbody');
        tbody.innerHTML = '';
        state.cards.forEach(card => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><i class="fas fa-credit-card"></i> ${utils.sanitizeInput(card.numero)}</td>
                <td><i class="fas fa-flag"></i> ${utils.sanitizeInput(card.bandeira)}</td>
                <td><i class="fas fa-university"></i> ${utils.sanitizeInput(card.banco)}</td>
                <td><i class="fas fa-star"></i> ${utils.sanitizeInput(card.nivel)}</td>
                <td>
                    <button class="action-button" data-card-number="${utils.sanitizeInput(card.numero)}" data-action="edit-card">Editar</button>
                    <button class="delete-button" data-card-number="${utils.sanitizeInput(card.numero)}" data-action="delete-card">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        this.showNotification('Tabela de cartões atualizada.', 'info');
    },

    showEditBalanceModal(username) {
        if (!state.isAdmin) {
            this.showError('global', 'Acesso negado.');
            return;
        }
        const modal = document.getElementById('editBalanceModal');
        if (modal) {
            modal.dataset.username = username;
            document.getElementById('editBalanceAmount').value = '';
            this.showModal('editBalanceModal');
        }
    },

    showEditUserModal(username) {
        if (!state.isAdmin) {
            this.showError('global', 'Acesso negado.');
            return;
        }
        const user = state.users.find(u => u.username === username);
        if (!user) {
            this.showError('global', 'Usuário não encontrado.');
            return;
        }
        const modal = document.getElementById('editUserModal');
        if (modal) {
            document.getElementById('editUsername').value = user.username;
            document.getElementById('editBalance').value = user.balance.toFixed(2);
            document.getElementById('editIsAdmin').value = user.is_admin.toString();
            document.getElementById('editPassword').value = '';
            this.showModal('editUserModal');
        }
    },

    showAddUserModal() {
        if (!state.isAdmin) {
            this.showError('global', 'Acesso negado.');
            return;
        }
        const modal = document.getElementById('addUserModal');
        if (modal) {
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('newBalance').value = '';
            document.getElementById('newIsAdmin').value = 'false';
            this.showModal('addUserModal');
        }
    },

    showEditCardModal(cardNumber) {
        if (!state.isAdmin) {
            this.showError('global', 'Acesso negado.');
            return;
        }
        const card = state.cards.find(c => c.numero === cardNumber);
        if (!card) {
            this.showError('global', 'Cartão não encontrado.');
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
            this.showModal('editCardModal');
        }
    },

    showAddCardModal() {
        if (!state.isAdmin) {
            this.showError('global', 'Acesso negado.');
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
            this.showModal('addCardModal');
        }
    },

    formatCardNumber(input) {
        let value = input.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 16);
        input.value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    },

    restrictCvv(input) {
        input.value = input.value.replace(/\D/g, '').slice(0, 3);
    },

    formatExpiry(input) {
        let value = input.value.replace(/\D/g, '').slice(0, 4);
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2)}`;
        }
        input.value = value;
    },

    formatCpf(input) {
        let value = input.value.replace(/\D/g, '').slice(0, 11);
        if (value.length > 9) {
            value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
        } else if (value.length > 6) {
            value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
        } else if (value.length > 3) {
            value = `${value.slice(0, 3)}.${value.slice(3)}`;
        }
        input.value = value;
    }
};

// --- Listeners de Eventos ---
function setupEventListeners() {
    // Index.html
    document.getElementById('loginButton')?.addEventListener('click', () => {
        auth.login(
            document.getElementById('username')?.value.trim(),
            document.getElementById('password')?.value.trim()
        );
    });

    document.getElementById('registerButton')?.addEventListener('click', () => {
        auth.register(
            document.getElementById('newUsername')?.value.trim(),
            document.getElementById('newPassword')?.value.trim(),
            document.getElementById('confirmPassword')?.value.trim()
        );
    });

    document.getElementById('toggleRegister')?.addEventListener('click', e => {
        e.preventDefault();
        ui.toggleForms();
    });

    document.getElementById('toggleLogin')?.addEventListener('click', e => {
        e.preventDefault();
        ui.toggleForms();
    });

    // Shop.html
    document.getElementById('logoutButton')?.addEventListener('click', auth.logout);
    document.getElementById('accountButton')?.addEventListener('click', () => ui.showAccountInfo());
    document.getElementById('walletButton')?.addEventListener('click', () => ui.showWallet());
    document.getElementById('addBalanceButton')?.addEventListener('click', () => ui.showAddBalanceForm());
    document.getElementById('adminButton')?.addEventListener('click', () => window.location.href = 'Dashboard.html');
    document.getElementById('clearFiltersButton')?.addEventListener('click', () => ui.clearFilters());
    document.getElementById('confirmPurchaseButton')?.addEventListener('click', () => {
        shop.purchaseCard(document.getElementById('confirmPurchaseModal').dataset.cardNumber);
    });
    document.getElementById('cancelPurchaseButton')?.addEventListener('click', () => ui.closeModal('confirmPurchaseModal'));
    document.getElementById('closeWalletButton')?.addEventListener('click', () => ui.closeModal('walletModal'));
    document.getElementById('addBalanceConfirmButton')?.addEventListener('click', () => ui.addBalance());
    document.getElementById('cancelRechargeButton')?.addEventListener('click', () => ui.closeModal('rechargeModal'));

    document.getElementById('cardList')?.addEventListener('click', e => {
        const button = e.target.closest('.card-button');
        if (button) shop.showConfirmPurchaseModal(button.dataset.cardNumber);
    });

    document.getElementById('binFilter')?.addEventListener('input', () => ui.filterCards());
    document.getElementById('brandFilter')?.addEventListener('change', () => ui.filterCards());
    document.getElementById('bankFilter')?.addEventListener('change', () => ui.filterCards());
    document.getElementById('levelFilter')?.addEventListener('change', () => ui.filterCards());

    // Dashboard.html
    document.getElementById('shopButton')?.addEventListener('click', () => window.location.href = 'Shop.html');
    document.getElementById('addUserButton')?.addEventListener('click', () => ui.showAddUserModal());
    document.getElementById('addCardButton')?.addEventListener('click', () => ui.showAddCardModal());
    document.getElementById('saveBalanceButton')?.addEventListener('click', () => {
        admin.editUserBalance(
            document.getElementById('editBalanceModal').dataset.username,
            parseFloat(document.getElementById('editBalanceAmount').value)
        );
    });
    document.getElementById('cancelBalanceButton')?.addEventListener('click', () => ui.closeModal('editBalanceModal'));
    document.getElementById('saveUserButton')?.addEventListener('click', () => {
        admin.editUser(
            document.getElementById('editUsername').value,
            parseFloat(document.getElementById('editBalance').value),
            document.getElementById('editIsAdmin').value === 'true',
            document.getElementById('editPassword').value.trim()
        );
    });
    document.getElementById('cancelUserButton')?.addEventListener('click', () => ui.closeModal('editUserModal'));
    document.getElementById('addUserConfirmButton')?.addEventListener('click', () => {
        admin.addUser(
            document.getElementById('newUsername').value.trim(),
            document.getElementById('newPassword').value.trim(),
            parseFloat(document.getElementById('newBalance').value) || 0,
            document.getElementById('newIsAdmin').value === 'true'
        );
    });
    document.getElementById('cancelAddUserButton')?.addEventListener('click', () => ui.closeModal('addUserModal'));
    document.getElementById('saveCardButton')?.addEventListener('click', () => {
        admin.editCard({
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
        });
    });
    document.getElementById('cancelCardButton')?.addEventListener('click', () => ui.closeModal('editCardModal'));
    document.getElementById('addCardConfirmButton')?.addEventListener('click', () => {
        admin.saveCard({
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
            price: 10.00
        });
    });
    document.getElementById('cancelAddCardButton')?.addEventListener('click', () => ui.closeModal('addCardModal'));

    document.getElementById('userList')?.addEventListener('click', e => {
        const button = e.target.closest('button');
        if (!button) return;
        const username = button.dataset.username;
        const action = button.dataset.action;
        if (action === 'edit-balance') ui.showEditBalanceModal(username);
        else if (action === 'edit-user') ui.showEditUserModal(username);
        else if (action === 'delete-user') admin.deleteUser(username);
    });

    document.getElementById('adminCardList')?.addEventListener('click', e => {
        const button = e.target.closest('button');
        if (!button) return;
        const cardNumber = button.dataset.cardNumber;
        const action = button.dataset.action;
        if (action === 'edit-card') ui.showEditCardModal(cardNumber);
        else if (action === 'delete-card') admin.deleteCard(cardNumber);
    });

    ['cardNumber', 'editCardNumber'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => ui.formatCardNumber(e.target));
    });
    ['cardCvv', 'editCardCvv'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => ui.restrictCvv(e.target));
    });
    ['cardExpiry', 'editCardExpiry'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => ui.formatExpiry(e.target));
    });
    ['cardCpf', 'editCardCpf'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => ui.formatCpf(e.target));
    });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Carrega DOMPurify via CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js';
    script.onload = () => {
        setupEventListeners();
        if (window.location.pathname.includes('Shop.html')) {
            shop.loadCards();
        } else if (window.location.pathname.includes('Dashboard.html')) {
            admin.loadUsers();
            admin.loadAdminCards();
        }
    };
    document.head.appendChild(script);
});

// --- Nota de Segurança ---
// As senhas são armazenadas em texto puro, conforme solicitado. Para maior segurança, considere usar supabase.auth no futuro.
