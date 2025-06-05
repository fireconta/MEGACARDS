/**
 * LOGAN CC's - Main JavaScript Logic
 * Handles authentication, shop functionality, admin operations, and UI management.
 * Uses Supabase for backend integration.
 */

// --- Configuration ---
const CONFIG = {
    SESSION_TIMEOUT_MINUTES: 30,
    MIN_PASSWORD_LENGTH: 4,
    MAX_LOGIN_ATTEMPTS: 3,
    LOGIN_BLOCK_TIME_MS: 60000,
    NOTIFICATION_TIMEOUT_MS: 5000,
    SUPABASE_URL: 'https://nphqfkfdjjpiqssdyanb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHFma2ZkampwaXFzc2R5YW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MjIyODgsImV4cCI6MjA2NDQ5ODI4OH0.7wKoxm1oTY0lYavpBjEtQ1dH_x6ghIO2qYsf_K8z9_g',
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY_MS: 1000
};

// --- State Management ---
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

// --- Supabase Client ---
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// --- Utility Functions ---
const utils = {
    /**
     * Executes a Supabase query with retry mechanism.
     * @param {Function} queryFn - The Supabase query function to execute.
     * @param {number} [attempts=CONFIG.RETRY_ATTEMPTS] - Number of retry attempts.
     * @returns {Promise<any>} - Query result.
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
     * Checks if the user is authenticated and the session is valid.
     * @returns {boolean} - True if authenticated, false otherwise.
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
     * Validates a card number (16 digits).
     * @param {string} number - Card number.
     * @returns {boolean} - True if valid.
     */
    validateCardNumber(number) {
        const cleaned = number.replace(/\s/g, '');
        return cleaned.length === 16 && /^\d+$/.test(cleaned);
    },

    /**
     * Validates a CVV (3 digits).
     * @param {string} cvv - CVV code.
     * @returns {boolean} - True if valid.
     */
    validateCardCvv(cvv) {
        return cvv.length === 3 && /^\d+$/.test(cvv);
    },

    /**
     * Validates card expiry date (MM/AA format).
     * @param {string} expiry - Expiry date.
     * @returns {boolean} - True if valid and not expired.
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
     * Validates a Brazilian CPF (11 digits).
     * @param {string} cpf - CPF number.
     * @returns {boolean} - True if valid.
     */
    validateCardCpf(cpf) {
        const cleaned = cpf.replace(/[\.-]/g, '');
        return cleaned.length === 11 && /^\d+$/.test(cleaned);
    }
};

// --- Authentication Module ---
const auth = {
    /**
     * Logs in a user with username and password.
     * @param {string} username - User's username.
     * @param {string} password - User's password.
     */
    async login(username, password) {
        if (!username || !password) {
            ui.showError('login', 'Usuário e senha são obrigatórios.');
            return;
        }

        if (state.loginBlockedUntil > Date.now()) {
            const timeLeft = Math.ceil((state.loginBlockedUntil - Date.now()) / 1000);
            ui.showError('login', `Bloqueado. Tente novamente em ${timeLeft} segundos.`);
            return;
        }

        ui.toggleLoading('loginButton', true);

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
                    ui.showError('login', 'Limite de tentativas atingido. Aguarde 60 segundos.');
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
            ui.showSuccess('Login bem-sucedido! Redirecionando...');
            ui.clearForm('login');
            setTimeout(() => window.location.href = 'shop.html', 1000);
        } catch (error) {
            console.error('Erro no login:', error);
            ui.showError('login', `Erro ao conectar: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.toggleLoading('loginButton', false);
        }
    },

    /**
     * Registers a new user.
     * @param {string} username - New username.
     * @param {string} password - New password.
     * @param {string} confirmPassword - Password confirmation.
     */
    async register(username, password, confirmPassword) {
        if (!username || !password) {
            ui.showError('register', 'Usuário e senha são obrigatórios.');
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

        try {
            const { data: existingUser, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .single()
            );

            if (existingUser) {
                ui.showError('register', 'Usuário já existe!');
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

            ui.showSuccess('Registro concluído! Faça login.');
            ui.clearForm('register');
            ui.toggleForms();
        } catch (error) {
            console.error('Erro no registro:', error);
            ui.showError('register', `Erro ao registrar: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.toggleLoading('registerButton', false);
        }
    },

    /**
     * Logs out the current user.
     */
    logout() {
        state.currentUser = null;
        state.isAdmin = false;
        state.loginAttempts = 0;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionStart');
        console.log('Logout realizado.');
        window.location.href = 'index.html';
    }
};

// --- Shop Module ---
const shop = {
    /**
     * Loads available and user-acquired cards.
     */
    async loadCards() {
        if (!utils.checkAuth()) {
            ui.showError('global', 'Faça login para acessar a loja.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        ui.showLoader();

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
        } catch (error) {
            console.error('Erro ao carregar cartões:', error);
            ui.showError('global', `Erro ao carregar cartões: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Shows the purchase confirmation modal for a card.
     * @param {string} cardNumber - Card number.
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
    },

    /**
     * Purchases a card.
     * @param {string} cardNumber - Card number to purchase.
     */
    async purchaseCard(cardNumber) {
        if (!utils.checkAuth()) {
            ui.showError('global', 'Faça login para realizar a compra.');
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

            if (cardError || !cardData) throw new Error('Cartão não encontrado ou já adquirido.');

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
            ui.showError('global', `Erro ao realizar compra: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    }
};

// --- Admin Module ---
const admin = {
    /**
     * Loads all users for admin management.
     */
    async loadUsers() {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado: Permissão de administrador necessária.');
            setTimeout(() => window.location.href = 'shop.html', 1000);
            return;
        }

        ui.showLoader();

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
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            ui.showError('global', `Erro ao carregar usuários: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Loads all available cards for admin management.
     */
    async loadAdminCards() {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado: Permissão de administrador necessária.');
            setTimeout(() => window.location.href = 'shop.html', 1000);
            return;
        }

        ui.showLoader();

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
        } catch (error) {
            console.error('Erro ao carregar cartões:', error);
            ui.showError('global', `Erro ao carregar cartões: ${error.message || 'Tente novamente.'}`);
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Updates a user's balance.
     * @param {string} username - Username.
     * @param {number} newBalance - New balance.
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
     * Adds a new user.
     * @param {string} username - New username.
     * @param {string} password - New password.
     * @param {number} balance - Initial balance.
     * @param {boolean} isAdmin - Admin status.
     */
    async addUser(username, password, balance, isAdmin) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

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

        try {
            const { data: existingUser, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .single()
            );

            if (existingUser) {
                ui.showError('addUser', 'Usuário já existe!');
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
     * Edits an existing user.
     * @param {string} username - Username.
     * @param {number} balance - New balance.
     * @param {boolean} isAdmin - Admin status.
     * @param {string} [password] - New password (optional).
     */
    async editUser(username, balance, isAdmin, password) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        if (isNaN(balance) || balance < 0) {
            ui.showError('editUser', 'Saldo inválido.');
            return;
        }

        ui.showLoader();

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
            if (password && password.length >= CONFIG.MIN_PASSWORD_LENGTH) {
                updatedData.password = password;
            }

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
     * Deletes a user.
     * @param {string} username - Username to delete.
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
     * Deletes a card.
     * @param {string} cardNumber - Card number to delete.
     */
    async deleteCard(cardNumber) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        ui.showLoader();

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
     * Edits an existing card.
     * @param {Object} cardData - Card data to update.
     */
    async editCard(cardData) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        if (!utils.validateCardNumber(cardData.numero)) {
            ui.showError('editCard', 'Número de cartão inválido!');
            return;
        }
        if (!utils.validateCardCvv(cardData.cvv)) {
            ui.showError('editCard', 'CVV inválido!');
            return;
        }
        if (!utils.validateCardExpiry(cardData.validade)) {
            ui.showError('editCard', 'Validade inválida ou expirada!');
            return;
        }
        if (!utils.validateCardCpf(cardData.cpf)) {
            ui.showError('editCard', 'CPF inválido!');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            ui.showError('editCard', 'Preencha todos os campos obrigatórios!');
            return;
        }

        ui.showLoader();

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
     * Adds a new card.
     * @param {Object} cardData - Card data to add.
     */
    async saveCard(cardData) {
        if (!utils.checkAuth() || !state.isAdmin) {
            ui.showError('global', 'Acesso negado.');
            return;
        }

        if (!utils.validateCardNumber(cardData.numero)) {
            ui.showError('addCard', 'Número de cartão inválido!');
            return;
        }
        if (!utils.validateCardCvv(cardData.cvv)) {
            ui.showError('addCard', 'CVV inválido!');
            return;
        }
        if (!utils.validateCardExpiry(cardData.validade)) {
            ui.showError('addCard', 'Validade inválida ou expirada!');
            return;
        }
        if (!utils.validateCardCpf(cardData.cpf)) {
            ui.showError('addCard', 'CPF inválido!');
            return;
        }
        if (!cardData.bandeira || !cardData.banco || !cardData.nivel) {
            ui.showError('addCard', 'Preencha todos os campos obrigatórios!');
            return;
        }

        ui.showLoader();

        try {
            const { data: existingCard, error: checkError } = await utils.withRetry(() =>
                supabase
                    .from('cards')
                    .select('numero')
                    .eq('numero', cardData.numero)
                    .single()
            );

            if (existingCard) {
                ui.showError('addCard', 'Cartão já existe!');
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

// --- UI Module ---
const ui = {
    /**
     * Shows a notification message.
     * @param {string} message - Message to display.
     * @param {string} [type='error'] - Notification type ('error' or 'success').
     */
    showNotification(message, type = 'error') {
        const notificationsDiv = document.getElementById('notifications');
        if (!notificationsDiv) return;

        const notification = document.createElement('p');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationsDiv.appendChild(notification);
        setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_TIMEOUT_MS);
    },

    /**
     * Shows an error message for a specific context.
     * @param {string} context - Context ID (e.g., 'login', 'register').
     * @param {string} message - Error message.
     */
    showError(context, message) {
        this.showNotification(message, 'error');
        const errorElement = document.getElementById(`${context}Error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    },

    /**
     * Shows a success message.
     * @param {string} message - Success message.
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    /**
     * Toggles loading state for a button.
     * @param {string} buttonId - Button ID.
     * @param {boolean} isLoading - Loading state.
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
     * Shows the global loader.
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
     * Hides the global loader.
     */
    hideLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    },

    /**
     * Toggles login/register forms.
     */
    toggleForms() {
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        if (loginContainer && registerContainer) {
            loginContainer.classList.toggle('hidden');
            registerContainer.classList.toggle('hidden');
        }
    },

    /**
     * Clears a form by context.
     * @param {string} context - Form context ('login' or 'register').
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
        fields.forEach(id => {
            const error = document.getElementById(`${id}Error`);
            if (error) {
                error.textContent = '';
                error.classList.remove('show');
            }
        });
    },

    /**
     * Updates user information in the UI.
     */
    updateUserInfo() {
        const elements = {
            userName: state.currentUser.username,
            userBalanceHeader: state.currentUser.balance.toFixed(2),
            userNameAccount: state.currentUser.username,
            userBalanceAccount: `R$${state.currentUser.balance.toFixed(2)}`
        };
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    },

    /**
     * Shows the admin button if user is admin.
     */
    showAdminButton() {
        const adminButton = document.getElementById('adminButton');
        if (adminButton) adminButton.classList.remove('hidden');
    },

    /**
     * Shows an element by ID.
     * @param {string} id - Element ID.
     */
    showElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.remove('hidden');
    },

    /**
     * Filters and displays available cards.
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
    },

    /**
     * Clears card filters.
     */
    clearFilters() {
        const filters = ['binFilter', 'brandFilter', 'bankFilter', 'levelFilter'];
        filters.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = id === 'binFilter' ? '' : 'all';
        });
        this.filterCards();
    },

    /**
     * Shows account information.
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
        }
    },

    /**
     * Shows the wallet modal.
     */
    showWallet() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para acessar a carteira.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }
        this.showModal('walletModal');
        this.loadUserCardsWallet();
    },

    /**
     * Shows the add balance form.
     */
    showAddBalanceForm() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para adicionar crédito.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }
        this.showModal('rechargeModal');
    },

    /**
     * Adds balance to the user's account.
     */
    async addBalance() {
        if (!utils.checkAuth()) {
            this.showError('global', 'Faça login para adicionar crédito.');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        const amount = parseFloat(document.getElementById('rechargeAmount')?.value);
        if (isNaN(amount) || amount <= 0) {
            this.showError('recharge', 'Valor inválido.');
            return;
        }

        this.showLoader();

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
     * Loads user's acquired cards.
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
    },

    /**
     * Loads user's cards in the wallet modal.
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
    },

    /**
     * Shows a modal with optional data.
     * @param {string} modalId - Modal ID.
     * @param {Object} [data] - Data to populate the modal.
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
    },

    /**
     * Closes a modal.
     * @param {string} modalId - Modal ID.
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    },

    /**
     * Displays users in the admin table.
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
    },

    /**
     * Displays cards in the admin table.
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
    },

    /**
     * Shows the edit balance modal.
     * @param {string} username - Username.
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
     * Shows the edit user modal.
     * @param {string} username - Username.
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
     * Shows the add user modal.
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
     * Shows the edit card modal.
     * @param {string} cardNumber - Card number.
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
     * Shows the add card modal.
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
     * Formats card number input.
     * @param {HTMLInputElement} input - Input element.
     */
    formatCardNumber(input) {
        let value = input.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 16);
        input.value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    },

    /**
     * Restricts CVV input to 3 digits.
     * @param {HTMLInputElement} input - Input element.
     */
    restrictCvv(input) {
        input.value = input.value.replace(/\D/g, '').slice(0, 3);
    },

    /**
     * Formats expiry date input (MM/AA).
     * @param {HTMLInputElement} input - Input element.
     */
    formatExpiry(input) {
        let value = input.value.replace(/\D/g, '').slice(0, 4);
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2)}`;
        }
        input.value = value;
    },

    /**
     * Formats CPF input (XXX.XXX.XXX-XX).
     * @param {HTMLInputElement} input - Input element.
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

// --- Event Listeners ---
function setupEventListeners() {
    // Index.html
    document.getElementById('loginButton')?.addEventListener('click', () => {
        auth.login(
            document.getElementById('username').value.trim(),
            document.getElementById('password').value.trim()
        );
    });

    document.getElementById('registerButton')?.addEventListener('click', () => {
        auth.register(
            document.getElementById('newUsername').value.trim(),
            document.getElementById('newPassword').value.trim(),
            document.getElementById('confirmPassword').value.trim()
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
            price: 10.00 // TODO: Add price field to form
        });
    });
    document.getElementById('cancelAddCardButton')?.addEventListener('click', () => ui.closeModal('addCardModal'));

    document.getElementById('userList')?.addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) return;
        const { username, action } = target.dataset;
        if (action === 'edit-balance') ui.showEditBalanceModal(username);
        else if (action === 'edit-user') ui.showEditUserModal(username);
        else if (action === 'delete-user') admin.deleteUser(username);
    });

    document.getElementById('adminCardList')?.addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) return;
        const { cardNumber, action } = target.dataset;
        if (action === 'edit-card') ui.showEditCardModal(cardNumber);
        else if (action === 'delete-card') admin.deleteCard(cardNumber);
    });

    // Input Formatting
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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

// --- Security Note ---
// TODO: Replace plain text password storage with supabase.auth.signInWithPassword and supabase.auth.signUp
// for secure authentication with password hashing.
