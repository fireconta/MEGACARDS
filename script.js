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
    DEBOUNCE_DELAY_MS: 300
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
    lastActionTime: 0 // Para debounce
};

// --- Cliente Supabase ---
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// --- Funções Utilitárias ---
const utils = {
    /**
     * Executa uma consulta ao Supabase com tentativas de retry.
     * @param {Function} queryFn - Função de consulta ao Supabase.
     * @param {number} [attempts=CONFIG.RETRY_ATTEMPTS] - Número de tentativas.
     * @returns {Promise<any>} - Resultado da consulta.
     */
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

    /**
     * Verifica se o usuário está autenticado e a sessão é válida.
     * @returns {boolean} - Verdadeiro se autenticado, falso caso contrário.
     */
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

    /**
     * Sanitiza entrada para prevenir injeções.
     * @param {string} input - Entrada a sanitizar.
     * @returns {string} - Entrada sanitizada.
     */
    sanitizeInput(input) {
        return input.replace(/[<>]/g, '');
    },

    /**
     * Valida número de cartão (16 dígitos).
     * @param {string} number - Número do cartão.
     * @returns {boolean} - Verdadeiro se válido.
     */
    validateCardNumber(number) {
        const cleaned = number.replace(/\s/g, '');
        return cleaned.length === 16 && /^\d+$/.test(cleaned);
    },

    /**
     * Valida CVV (3 dígitos).
     * @param {string} cvv - Código CVV.
     * @returns {boolean} - Verdadeiro se válido.
     */
    validateCardCvv(cvv) {
        return cvv.length === 3 && /^\d+$/.test(cvv);
    },

    /**
     * Valida data de validade do cartão (MM/AA).
     * @param {string} expiry - Data de validade.
     * @returns {boolean} - Verdadeiro se válida e não expirada.
     */
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

    /**
     * Valida CPF brasileiro (11 dígitos).
     * @param {string} cpf - Número do CPF.
     * @returns {boolean} - Verdadeiro se válido.
     */
    validateCardCpf(cpf) {
        const cleaned = cpf.replace(/[\.-]/g, '');
        return cleaned.length === 11 && /^\d+$/.test(cleaned);
    },

    /**
     * Impede ações rápidas consecutivas (debounce).
     * @returns {boolean} Verdadeiro se a ação pode prosseguir.
     */
    debounce() {
        const now = Date.now();
        if (now - state.lastActionTime < CONFIG.DEBOUNCE_DELAY_MS) {
            console.warn('Ação bloqueada por debounce.');
            return false;
        }
        state.lastActionTime = now;
        return true;
    }
};

// --- Módulo de Autenticação ---
const auth = {
    /**
     * Realiza login com usuário e senha em texto puro.
     * @param {string} username - Nome de usuário.
     * @param {string} password - Senha.
     */
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
                    .eq('password', password)
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
            setTimeout(() => window.location.href = 'shop.html', 1000);
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

    /**
     * Registra um novo usuário com senha em texto puro.
     * @param {string} username - Nome de usuário.
     * @param {string} password - Senha.
     * @param {string} confirmPassword - Confirmação da senha.
     */
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

    /**
     * Realiza logout do usuário.
     */
    logout() {
        state.currentUser = null;
        state.isAdmin = false;
        state.loginAttempts = 0;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionStart');
        console.log('Logout realizado.');
        ui.showSuccess('Logout realizado com sucesso!');
        window.location.href = 'index.html';
    }
};

// --- Módulo da Loja ---
const shop = {
    /**
     * Carrega cartões disponíveis e adquiridos pelo usuário.
     */
    async loadCards() {
        if (!utils.checkAuth()) {
            ui.showError('global', 'Faça login para acessar a loja.');
            setTimeout(() => window.location.href = 'index.html', 1000);
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

    /**
     * Exibe modal de confirmação de compra.
     * @param {string} cardNumber - Número do cartão.
     */
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

    /**
     * Realiza a compra de um cartão.
     * @param {string} cardNumber - Número do cartão.
     */
    async purchaseCard(cardNumber) {
        if (!utils.checkAuth()) {
            ui.showError('global', 'Faça login para comprar.');
            setTimeout(() => window.location.href = 'index.html', 1000);
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
            ui.closeModal('confirmPurchaseModal');
            ui.filterCards();
            ui.loadUserCards();
            ui.updateUserInfo();
            ui.showSuccess('Compra realizada com sucesso!');
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
    /**
     * Carrega todos os usuários para gerenciamento.
     */
    async loadUsers() {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado: Apenas administradores.');
            setTimeout(() => window.location.href = 'shop.html', 1000);
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

    /**
     * Carrega cartões disponíveis para gerenciamento.
     */
    async loadAdminCards() {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado: Apenas administradores.');
            setTimeout(() => window.location.href = 'shop.html', 1000);
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

    /**
     * Atualiza o saldo de um usuário.
     * @param {string} username - Nome de usuário.
     * @param {number} newBalance - Novo saldo.
     */
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

            ui.showSuccess('Saldo atualizado com sucesso!');
            ui.closeModal('editBalanceModal');
            admin.loadUsers();
        } catch (error) {
            console.error('Erro ao atualizar saldo:', error);
            ui.showError('editBalance', `Erro ao atualizar saldo: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Adiciona um novo usuário.
     * @param {string} username - Nome de usuário.
     * @param {string} password - Senha.
     * @param {number} balance - Saldo inicial.
     * @param {boolean} isAdmin - Status de administrador.
     */
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

            const { error: insertError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .insert([{ username, password, balance, is_admin: isAdmin }])
            );

            if (insertError) throw insertError;

            ui.showSuccess('Usuário adicionado com sucesso!');
            ui.closeModal('addUserModal');
            admin.loadUsers();
        } catch (error) {
            console.error('Erro ao adicionar usuário:', error);
            ui.showError('addUser', `Erro ao adicionar usuário: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Edita um usuário existente.
     * @param {string} username - Nome de usuário.
     * @param {number} balance - Novo saldo.
     * @param {boolean} isAdmin - Status de administrador.
     * @param {string} [password] - Nova senha (opcional).
     */
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

            ui.showSuccess('Usuário atualizado com sucesso!');
            ui.closeModal('editUserModal');
            admin.loadUsers();
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            ui.showError('editUser', `Erro ao atualizar usuário: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Exclui um usuário.
     * @param {string} username - Nome de usuário.
     */
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

            ui.showSuccess('Usuário excluído com sucesso!');
            admin.loadUsers();
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            ui.showError('global', `Erro ao excluir usuário: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Exclui um cartão.
     * @param {string} cardNumber - Número do cartão.
     */
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

            ui.showSuccess('Cartão excluído com sucesso!');
            admin.loadAdminCards();
        } catch (error) {
            console.error('Erro ao excluir cartão:', error);
            ui.showError('global', `Erro ao excluir cartão: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Edita um cartão existente.
     * @param {Object} cardData - Dados do cartão.
     */
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
            ui.showError('editCard', 'Número de cartão inválido.');
            return;
        }
        if (!utils.validateCardCvv(cardData.cvv)) {
            ui.showError('editCard', 'CVV inválido.');
            return;
        }
        if (!utils.validateCardExpiry(cardData.validade)) {
            ui.showError('editCard', 'Validade inválida ou expirada.');
            return;
        }
        if (!utils.validateCardCpf(cardData.cpf)) {
            ui.showError('editCard', 'CPF inválido.');
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

            ui.showSuccess('Cartão atualizado com sucesso!');
            ui.closeModal('editCardModal');
            admin.loadAdminCards();
        } catch (error) {
            console.error('Erro ao atualizar cartão:', error);
            ui.showError('editCard', `Erro ao atualizar cartão: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Adiciona um novo cartão.
     * @param {Object} cardData - Dados do cartão.
     */
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
            ui.showError('addCard', 'Número de cartão inválido.');
            return;
        }
        if (!utils.validateCardCvv(cardData.cvv)) {
            ui.showError('addCard', 'CVV inválido.');
            return;
        }
        if (!utils.validateCardExpiry(cardData.validade)) {
            ui.showError('addCard', 'Validade inválida ou expirada.');
            return;
        }
        if (!utils.validateCardCpf(cardData.cpf)) {
            ui.showError('addCard', 'CPF inválido.');
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

            const { error: insertError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .insert([cardData])
            );

            if (insertError) throw insertError;

            ui.showSuccess('Cartão adicionado com sucesso!');
            ui.closeModal('addCardModal');
            admin.loadAdminCards();
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
    /**
     * Exibe uma notificação.
     * @param {string} message - Mensagem a exibir.
     * @param {string} [type='error'] - Tipo ('error', 'success', 'info').
     */
    showNotification(message, type = 'error') {
        const notificationsDiv = document.getElementById('notifications');
        if (!notificationsDiv) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            padding: 10px 20px;
            margin: 5px 0;
            border-radius: 4px;
            color: white;
            font-size: 0.9rem;
            background-color: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#3B82F6'};
        `;
        notification.textContent = message;
        notificationsDiv.appendChild(notification);
        setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_TIMEOUT_MS);
    },

    /**
     * Exibe mensagem de erro para um contexto.
     * @param {string} context - Contexto (ex.: 'login', 'register').
     * @param {string} message - Mensagem de erro.
     */
    showError(context, message) {
        this.showNotification(message, 'error');
        const errorElement = document.getElementById(`${context}Error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
            errorElement.style.color = '#EF4444';
        }
    },

    /**
     * Exibe mensagem de sucesso.
     * @param {string} message - Mensagem de sucesso.
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    /**
     * Alterna estado de carregamento de um botão.
     * @param {string} buttonId - ID do botão.
     * @param {boolean} isLoading - Estado de carregamento.
     */
    toggleLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = isLoading;
            button.textContent = isLoading ? 'Carregando...' : button.dataset.originalText || button.textContent;
            if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
        }
    },

    /**
     * Exibe carregador global.
     */
    showLoader() {
        let loader = document.getElementById('globalLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
            `;
            loader.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #38BDF8;"></i>';
            document.body.appendChild(loader);
        }
        loader.style.display = 'flex';
    },

    /**
     * Oculta carregador global.
     */
    hideLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    },

    /**
     * Alterna formulários de login e registro.
     */
    toggleForms() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.toggle('hidden');
            registerContainer.classList.toggle('hidden');
            ui.showNotification('Formulário alterado.', 'info');
        }
    },

    /**
     * Limpa um formulário por contexto.
     * @param {string} context - Contexto ('login' ou 'register').
     */
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

    /**
     * Atualiza informações do usuário na interface.
     */
    updateUserInfo() {
        const elements = {
            userName: state.currentUser?.username || 'N/A',
            userBalanceHeader: state.currentUser?.balance?.toFixed(2) || '0.00',
            userNameAccount: state.currentUser?.username || 'N/A',
            userBalanceAccount: state.currentUser ? `R$${state.currentUser.balance.toFixed(2)}` : 'R$0.00'
        };
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        ui.showNotification('Informações do usuário atualizadas.', 'info');
    },

    /**
     * Exibe botão de administrador se usuário for admin.
     */
    showAdminButton() {
        const adminButton = document.getElementById('adminButton');
        if (adminButton) {
            adminButton.classList.remove('hidden');
            ui.showNotification('Painel de administrador disponível.', 'info');
        }
    },

    /**
     * Exibe um elemento por ID.
     * @param {string} id - ID do elemento.
     */
    showElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.remove('hidden');
    },

    /**
     * Filtra e exibe cartões disponíveis.
     */
    filterCards() {
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

        cardList.innerHTML = filteredCards.length === 0
            ? '<p class="text-center text-gray-400">Nenhum cartão disponível.</p>'
            : filteredCards.map(card => `
                <div class="card-item">
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                    </div>
                    <button class="card-button" data-card-number="${card.numero}">
                        Comprar por R$${card.price ? card.price.toFixed(2) : '10.00'}
                    </button>
                </div>
            `).join('');
        ui.showNotification('Filtro de cartões aplicado.', 'info');
    },

    /**
     * Limpa filtros de cartões.
     */
    clearFilters() {
        const filters = ['binFilter', 'brandFilter', 'bankFilter', 'levelFilter'];
        filters.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = id === 'binFilter' ? '' : 'all';
        });
        this.filterCards();
        ui.showNotification('Filtros limpos.', 'info');
    },

    /**
     * Exibe informações da conta.
     */
    showAccountInfo() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para acessar a conta.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }
        const cardList = document.getElementById('cardList');
        const accountInfo = document.getElementById('accountInfo');
        if (cardList && accountInfo) {
            cardList.classList.add('hidden');
            accountInfo.classList.remove('hidden');
            this.updateUserInfo();
            this.loadUserCards();
            ui.showNotification('Informações da conta exibidas.', 'info');
        }
    },

    /**
     * Exibe modal da carteira.
     */
    showWallet() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para acessar a carteira.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }
        this.showModal('walletModal');
        this.loadUserCardsWallet();
        ui.showNotification('Carteira exibida.', 'info');
    },

    /**
     * Exibe formulário de adicionar saldo.
     */
    showAddBalanceForm() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para adicionar saldo.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }
        this.showModal('rechargeModal');
        ui.showNotification('Formulário de recarga aberto.', 'info');
    },

    /**
     * Adiciona saldo à conta do usuário.
     */
    async addBalance() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para adicionar saldo.');
            setTimeout(() => window.location.href = 'index.html', 1000);
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
        } catch (error) {
            console.error('Erro ao adicionar saldo:', error);
            this.showError('recharge', `Erro ao adicionar saldo: ${error.message || 'Tente novamente.'}`);
        } finally {
            this.hideLoader();
        }
    },

    /**
     * Carrega cartões adquiridos pelo usuário.
     */
    loadUserCards() {
        const userCards = document.getElementById('userCards');
        if (!userCards) return;

        const userCardsList = state.userCards.filter(c => c.user_id === state.currentUser.id);
        userCards.innerHTML = userCardsList.length === 0
            ? '<p class="text-center text-gray-400">Nenhum cartão adquirido.</p>'
            : userCardsList.map(card => `
                <div class="card-item">
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                    </div>
                </div>
            `).join('');
        ui.showNotification('Cartões do usuário carregados.', 'info');
    },

    /**
     * Carrega cartões na carteira.
     */
    loadUserCardsWallet() {
        const userCardsWallet = document.getElementById('userCardsWallet');
        if (!userCardsWallet) return;

        const userCardsList = state.userCards.filter(c => c.user_id === state.currentUser.id);
        userCardsWallet.innerHTML = userCardsList.length === 0
            ? '<p class="text-center text-gray-400">Carteira vazia.</p>'
            : userCardsList.map(card => `
                <div class="card-item">
                    <i class="fas fa-cc-${card.bandeira.toLowerCase()} card-brand"></i>
                    <div class="card-info">
                        <p><i class="fas fa-credit-card"></i> Número: ${card.numero}</p>
                        <p><i class="fas fa-university"></i> Banco: ${card.banco}</p>
                        <p><i class="fas fa-star"></i> Nível: ${card.nivel}</p>
                        <p><i class="fas fa-calendar"></i> Validade: ${card.validade}</p>
                        <p><i class="fas fa-lock"></i> CVV: ${card.cvv}</p>
                    </div>
                </div>
            `).join('');
        ui.showNotification('Cartões da carteira carregados.', 'info');
    },

    /**
     * Exibe um modal.
     * @param {string} modalId - ID do modal.
     * @param {Object} [data] - Dados para o modal.
     */
    showModal(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (modalId === 'confirmPurchaseModal' && data.cardDetails) {
            document.getElementById('confirmCardDetails').innerHTML = `
                <p><strong>Número:</strong> ${data.cardDetails.numero}</p>
                <p><strong>Bandeira:</strong> ${data.cardDetails.bandeira}</p>
                <p><strong>Banco:</strong> ${data.cardDetails.banco}</p>
                <p><strong>Nível:</strong> ${data.cardDetails.nivel}</p>
            `;
            document.getElementById('confirmTotalAmount').textContent = data.totalAmount;
            document.getElementById('confirmUserBalance').textContent = data.userBalance;
            modal.dataset.cardNumber = data.cardNumber;
        }

        modal.classList.remove('hidden');
        modal.classList.add('show');
        ui.showNotification(`Modal ${modalId} aberto.`, 'info');
    },

    /**
     * Fecha um modal.
     * @param {string} modalId - ID do modal.
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
            ui.showNotification(`Modal ${modalId} fechado.`, 'info');
        }
    },

    /**
     * Exibe usuários na tabela administrativa.
     */
    displayUsers() {
        const userList = document.getElementById('userList');
        if (!userList) return;

        userList.querySelector('tbody').innerHTML = state.users.map(user => `
            <tr>
                <td><i class="fas fa-user"></i> ${user.username}</td>
                <td><i class="fas fa-coins"></i> R$${user.balance.toFixed(2)}</td>
                <td><i class="fas fa-crown"></i> ${user.is_admin ? 'Sim' : 'Não'}</td>
                <td>
                    <button class="action-button" data-username="${user.username}" data-action="edit-balance">Editar Saldo</button>
                    <button class="action-button" data-username="${user.username}" data-action="edit-user">Editar</button>
                    <button class="delete-button" data-username="${user.username}" data-action="delete-user">Excluir</button>
                </td>
            </tr>
        `).join('');
        ui.showNotification('Tabela de usuários atualizada.', 'info');
    },

    /**
     * Exibe cartões na tabela administrativa.
     */
    displayAdminCards() {
        const cardList = document.getElementById('adminCardList');
        if (!cardList) return;

        cardList.querySelector('tbody').innerHTML = state.cards.map(card => `
            <tr>
                <td><i class="fas fa-credit-card"></i> ${card.numero}</td>
                <td><i class="fas fa-flag"></i> ${card.bandeira}</td>
                <td><i class="fas fa-university"></i> ${card.banco}</td>
                <td><i class="fas fa-star"></i> ${card.nivel}</td>
                <td>
                    <button class="action-button" data-card-number="${card.numero}" data-action="edit-card">Editar</button>
                    <button class="delete-button" data-card-number="${card.numero}" data-action="delete-card">Excluir</button>
                </td>
            </tr>
        `).join('');
        ui.showNotification('Tabela de cartões atualizada.', 'info');
    },

    /**
     * Exibe modal de edição de saldo.
     * @param {string} username - Nome de usuário.
     */
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

    /**
     * Exibe modal de edição de usuário.
     * @param {string} username - Nome de usuário.
     */
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

    /**
     * Exibe modal de adição de usuário.
     */
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

    /**
     * Exibe modal de edição de cartão.
     * @param {string} cardNumber - Número do cartão.
     */
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

    /**
     * Exibe modal de adição de cartão.
     */
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

    /**
     * Formata número de cartão.
     * @param {HTMLInputElement} input - Elemento de entrada.
     */
    formatCardNumber(input) {
        let value = input.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 16);
        input.value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    },

    /**
     * Restringe CVV a 3 dígitos.
     * @param {HTMLInputElement} input - Elemento de entrada.
     */
    restrictCvv(input) {
        input.value = input.value.replace(/\D/g, '').slice(0, 3);
    },

    /**
     * Formata data de validade (MM/AA).
     * @param {HTMLInputElement} input - Elemento de entrada.
     */
    formatExpiry(input) {
        let value = input.value.replace(/\D/g, '').slice(0, 4);
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2)}`;
        }
        input.value = value;
    },

    /**
     * Formata CPF (XXX.XXX.XXX-XX).
     * @param {HTMLInputElement} input - Elemento de entrada.
     */
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
    document.getElementById('adminButton')?.addEventListener('click', () => window.location.href = 'dashboard.html');
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
    document.getElementById('shopButton')?.addEventListener('click', () => window.location.href = 'shop.html');
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

    // Formatações
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
    setupEventListeners();
    if (window.location.pathname.includes('shop.html')) {
        shop.loadCards();
    } else if (window.location.pathname.includes('dashboard.html')) {
        admin.loadUsers();
        admin.loadAdminCards();
    }
});

// --- Nota de Segurança ---
// As senhas são armazenadas em texto puro, conforme solicitado. Para maior segurança, considere usar supabase.auth no futuro.
