import express from 'express';
import bcrypt from 'bcrypt';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const router = express.Router();

// Configurações
const ATLAS_URI = process.env.ATLAS_URI;
const DB_NAME = process.env.DB_NAME || 'seu_banco';
const USERS_COLLECTION = 'users';

// Configuração do email (use SendGrid, AWS SES, ou outro serviço)
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

// Verificação de assinatura da Kiwify (opcional, para segurança)
const KIWIFY_SECRET = process.env.KIWIFY_SECRET;

// Função para gerar senha aleatória
function generatePassword() {
  return crypto.randomBytes(8).toString('hex');
}

// Webhook para receber dados da Kiwify
router.post('/kiwify-webhook', async (req, res) => {
  try {
    // Verificar se é realmente a Kiwify (opcional)
    const signature = req.headers['x-kiwify-signature'];
    // Validar signature se você configurar isso na Kiwify
    
    const { 
      customer, 
      product, 
      subscription, 
      status 
    } = req.body;

    // Verificar se é uma assinatura ativa
    if (status !== 'active' && status !== 'approved') {
      return res.status(200).json({ message: 'Status não requer ação' });
    }

    // Extrair dados do cliente
    const nome = customer.name;
    const email = customer.email;
    const telefone = customer.phone || customer.cellphone || '';
    
    // Gerar senha aleatória
    const senhaTemporaria = generatePassword();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    
    // Verificar se usuário já existe
    const client = new MongoClient(ATLAS_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCollection = db.collection(USERS_COLLECTION);
    
    let usuario = await usersCollection.findOne({ email });
    
    if (usuario) {
      // Usuário já existe - podemos atualizar a assinatura
      await usersCollection.updateOne(
        { email },
        { 
          $set: { 
            nome,
            telefone,
            plano: product.title,
            subscriptionId: subscription.id,
            subscriptionStatus: status,
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Criar novo usuário
      const novoUsuario = {
        nome,
        email,
        telefone,
        senha: senhaHash,
        plano: product.title,
        subscriptionId: subscription.id,
        subscriptionStatus: status,
        createdAt: new Date(),
        updatedAt: new Date(),
        primeiroAcesso: true
      };
      
      await usersCollection.insertOne(novoUsuario);
      
      // Enviar email com credenciais
      await enviarEmailCredenciais(nome, email, senhaTemporaria);
    }
    
    await client.close();
    
    res.status(200).json({ 
      success: true, 
      message: usuario ? 'Usuário atualizado' : 'Usuário criado com sucesso' 
    });
    
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Função para enviar email
async function enviarEmailCredenciais(nome, email, senha) {
  const transporter = nodemailer.createTransport(EMAIL_CONFIG);
  
  const mailOptions = {
    from: '"Seu Sistema" <naoresponder@seudominio.com>',
    to: email,
    subject: 'Bem-vindo! Suas credenciais de acesso',
    html: `
      <h1>Olá ${nome}!</h1>
      <p>Seja bem-vindo ao nosso sistema.</p>
      <p>Suas credenciais de acesso foram criadas:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Senha temporária:</strong> ${senha}</li>
      </ul>
      <p>Recomendamos que você troque sua senha no primeiro acesso.</p>
      <p><a href="${process.env.SITE_URL}/login">Clique aqui para acessar</a></p>
    `
  };
  
  await transporter.sendMail(mailOptions);
}

export default router;
