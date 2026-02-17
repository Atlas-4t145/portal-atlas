// ===========================================
// WIDGET DE CHAT FLUTUANTE PARA O PORTAL ATLAS
// ===========================================

(function() {
    // Evita recarregar se já existir
    if (document.getElementById('atlas-chat-widget')) return;

    // Estilos do widget
    const style = document.createElement('style');
    style.textContent = `
        #atlas-chat-button {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            z-index: 9999;
            transition: transform 0.3s ease;
        }

        #atlas-chat-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
        }

        #atlas-chat-modal {
            position: fixed;
            bottom: 100px;
            right: 30px;
            width: 380px;
            height: 600px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 10000;
            border: 1px solid #e0e0e0;
        }

        #atlas-chat-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        #atlas-chat-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }

        #atlas-chat-header button {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }

        #atlas-chat-iframe {
            flex: 1;
            width: 100%;
            border: none;
            background: white;
        }

        #atlas-chat-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.3);
            z-index: 9998;
            display: none;
        }

        @media (max-width: 480px) {
            #atlas-chat-modal {
                width: 100%;
                height: 100%;
                bottom: 0;
                right: 0;
                border-radius: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Criar elementos
    const button = document.createElement('button');
    button.id = 'atlas-chat-button';
    button.innerHTML = '💬';
    button.setAttribute('aria-label', 'Abrir chat Atlas');
    button.onclick = toggleChat;

    const overlay = document.createElement('div');
    overlay.id = 'atlas-chat-overlay';
    overlay.onclick = closeChat;

    const modal = document.createElement('div');
    modal.id = 'atlas-chat-modal';

    modal.innerHTML = `
        <div id="atlas-chat-header">
            <h3>💬 Atlas Bot - Assistente Financeiro</h3>
            <button onclick="closeChat()">✕</button>
        </div>
        <iframe id="atlas-chat-iframe" src="/chat.html" title="Chat Atlas"></iframe>
    `;

    // Adicionar ao body
    document.body.appendChild(overlay);
    document.body.appendChild(button);
    document.body.appendChild(modal);

    // Funções globais
    window.toggleChat = function() {
        const modal = document.getElementById('atlas-chat-modal');
        const overlay = document.getElementById('atlas-chat-overlay');
        const isOpen = modal.style.display === 'flex';

        if (isOpen) {
            modal.style.display = 'none';
            overlay.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            overlay.style.display = 'block';
        }
    };

    window.closeChat = function() {
        document.getElementById('atlas-chat-modal').style.display = 'none';
        document.getElementById('atlas-chat-overlay').style.display = 'none';
    };
})();
