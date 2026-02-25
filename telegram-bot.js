// telegram-bot.js
// Este é o código que vai no seu bot do Telegram

const API_WEB_CHAT = 'https://SEU-DOMINIO.com/chat.html'; // URL do seu chat.html
const API_RENDER = 'https://atlas-database.onrender.com/api';

// Função principal quando recebe mensagem
async function processarMensagemTelegram(chatId, texto, telefoneSalvo, senhaSalva) {
    try {
        // 1. Tentar processar diretamente via API
        const response = await fetch(`${API_RENDER}/bot/processar-mensagem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensagem: texto,
                telefone: telefoneSalvo,
                senha: senhaSalva,
                chatId: chatId
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return { tipo: 'direto', resposta: data.resposta };
        }
        
        // Se API não tiver a rota, usar método alternativo
        throw new Error('API sem rota de processamento');
        
    } catch (error) {
        // 2. Fallback: usar o chat.html em modo headless
        console.log('Usando modo headless do chat.html');
        
        // Construir URL com parâmetros
        const url = new URL(API_WEB_CHAT);
        url.searchParams.append('chatId', chatId);
        url.searchParams.append('mensagem', texto);
        url.searchParams.append('modo', 'direto'); // NOVO: modo direto
        
        if (telefoneSalvo) {
            url.searchParams.append('telefone', telefoneSalvo);
            url.searchParams.append('senha', senhaSalva || '');
        }
        
        // Não precisa abrir navegador, só faz a requisição
        // O chat.html vai processar e responder sozinho
        
        return { tipo: 'headless', url: url.toString() };
    }
}

// No seu bot, quando receber mensagem:
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const texto = msg.text;
    
    // Recuperar credenciais salvas para este chatId
    const telefoneSalvo = await getTelefoneDoChat(chatId);
    const senhaSalva = await getSenhaDoChat(chatId);
    
    // Comando de login
    if (texto.startsWith('/login ')) {
        const partes = texto.split(' ');
        const telefone = partes[1];
        const senha = partes[2];
        
        // Salvar credenciais
        await salvarCredenciais(chatId, telefone, senha);
        
        // Testar login
        try {
            const response = await fetch(`${API_RENDER}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone: telefone.replace(/\D/g, ''), 
                    password: senha 
                })
            });
            
            if (response.ok) {
                bot.sendMessage(chatId, '✅ *Login realizado com sucesso!*\nAgora você pode usar o bot.', { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, '❌ *Login falhou!*\nVerifique telefone e senha.', { parse_mode: 'Markdown' });
            }
        } catch (error) {
            bot.sendMessage(chatId, `❌ Erro: ${error.message}`);
        }
        return;
    }
    
    // Comando de ajuda
    if (texto === '/start' || texto === '/ajuda') {
        bot.sendMessage(chatId, 
            "🤖 *ATLAS BOT*\n\n" +
            "Envie suas mensagens como se estivesse no chat web:\n\n" +
            "• *Registrar despesa:*\n" +
            "`pagar luz 150`\n" +
            "`ifood 89 ontem`\n" +
            "`celular 3000 10x`\n\n" +
            "• *Consultar:*\n" +
            "`contas a pagar`\n" +
            "`status`\n" +
            "`extrato janeiro`\n\n" +
            "• *Login:*\n" +
            "`/login 5511999999999 sua_senha`",
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Se não tiver telefone salvo, pede login
    if (!telefoneSalvo && !texto.startsWith('/login')) {
        bot.sendMessage(chatId, 
            "🔐 *Faça login primeiro*\n\nUse: `/login 5511999999999 sua_senha`",
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Processar mensagem
    const resultado = await processarMensagemTelegram(chatId, texto, telefoneSalvo, senhaSalva);
    
    if (resultado.tipo === 'direto') {
        // Resposta direta da API
        bot.sendMessage(chatId, resultado.resposta, { parse_mode: 'Markdown' });
    } else {
        // Modo headless: o chat.html vai responder via webhook
        bot.sendMessage(chatId, '⏳ Processando...');
        
        // Fazer uma requisição para o chat.html (ele vai responder via /resposta-telegram)
        try {
            await fetch(resultado.url);
        } catch (error) {
            console.error('Erro ao chamar chat.html:', error);
        }
    }
});

// Funções auxiliares (implemente conforme seu banco de dados)
async function getTelefoneDoChat(chatId) {
    // Implemente: buscar do seu banco de dados
    return null;
}

async function getSenhaDoChat(chatId) {
    // Implemente: buscar do seu banco de dados
    return null;
}

async function salvarCredenciais(chatId, telefone, senha) {
    // Implemente: salvar no seu banco de dados
    console.log('Salvando credenciais:', chatId, telefone);
}
