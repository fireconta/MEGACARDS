<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LOGAN CC's - Login</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="script.js" defer></script>
    <style>
        .notification {
            animation: slideIn 0.5s ease-out, fadeOut 0.5s ease-in 4.5s forwards;
            z-index: 10000;
            min-width: 200px;
            max-width: 300px;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-wrap: break-word;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; }
        }
        #globalLoader {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }
        #globalLoader.show {
            display: flex;
        }
        .spinner {
            border: 8px solid #f3f3f3;
            border-top: 8px solid #10B981;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center">
    <div id="globalLoader">
        <div class="spinner"></div>
    </div>
    <div id="notifications" class="fixed top-4 right-4 z-[10000] space-y-2"></div>
    <div class="container max-w-md mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
        <!-- Formulário de Login -->
        <div id="loginContainer" class="space-y-4">
            <h1 class="text-3xl font-bold text-center text-green-500">LOGAN CC's</h1>
            <div class="space-y-4">
                <div>
                    <label for="username" class="block text-sm font-medium"><i class="fas fa-user mr-2"></i>Usuário</label>
                    <input type="text" id="username" class="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded focus:ring-green-500 focus:border-green-500" placeholder="Digite seu usuário" required pattern="[a-zA-Z0-9]{3,}">
                </div>
                <div>
                    <label for="password" class="block text-sm font-medium"><i class="fas fa-lock mr-2"></i>Senha</label>
                    <input type="password" id="password" class="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded focus:ring-green-500 focus:border-green-500" placeholder="Digite sua senha" required minlength="4">
                </div>
                <p id="loginError" class="text-red-500 text-sm hidden"></p>
                <button id="loginButton" class="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center justify-center">
                    <i class="fas fa-sign-in-alt mr-2"></i>Entrar
                </button>
                <p class="text-center text-sm">
                    Não tem uma conta? <a href="#" id="toggleRegister" class="text-green-500 hover:underline">Registre-se</a>
                </p>
            </div>
        </div>
        <!-- Formulário de Registro -->
        <div id="registerContainer" class="space-y-4 hidden">
            <h1 class="text-3xl font-bold text-center text-green-500">LOGAN CC's - Registro</h1>
            <div class="space-y-4">
                <div>
                    <label for="newUsername" class="block text-sm font-medium"><i class="fas fa-user mr-2"></i>Usuário</label>
                    <input type="text" id="newUsername" class="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded focus:ring-green-500 focus:border-green-500" placeholder="Escolha um usuário" required pattern="[a-zA-Z0-9]{3,}">
                </div>
                <div>
                    <label for="newPassword" class="block text-sm font-medium"><i class="fas fa-lock mr-2"></i>Senha</label>
                    <input type="password" id="newPassword" class="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded focus:ring-green-500 focus:border-green-500" placeholder="Crie uma senha" required minlength="4">
                </div>
                <div>
                    <label for="confirmPassword" class="block text-sm font-medium"><i class="fas fa-lock mr-2"></i>Confirmar Senha</label>
                    <input type="password" id="confirmPassword" class="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded focus:ring-green-500 focus:border-green-500" placeholder="Confirme sua senha" required minlength="4">
                </div>
                <p id="registerError" class="text-red-500 text-sm hidden"></p>
                <button id="registerButton" class="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center justify-center">
                    <i class="fas fa-user-plus mr-2"></i>Registrar
                </button>
                <p class="text-center text-sm">
                    Já tem uma conta? <a href="#" id="toggleLogin" class="text-green-500 hover:underline">Faça login</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
