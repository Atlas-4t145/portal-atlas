// backend/src/config/migrate.js
const { query } = require('./database');

async function runMigrations() {
  console.log('🔄 Iniciando migrações do banco de dados...');
  
  try {
    // Tabela de usuários
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        kiwify_customer_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de transações
    await query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(20) CHECK (type IN ('income', 'expense')),
        category VARCHAR(100),
        description TEXT,
        transaction_date DATE NOT NULL,
        due_date DATE,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern VARCHAR(50),
        installment_current INTEGER,
        installment_total INTEGER,
        bank_account VARCHAR(100),
        tags JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de contas/cartões
    await query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) CHECK (type IN ('checking', 'savings', 'credit', 'investment')),
        bank VARCHAR(100),
        agency VARCHAR(20),
        account_number VARCHAR(50),
        balance DECIMAL(10,2) DEFAULT 0,
        credit_limit DECIMAL(10,2),
        due_day INTEGER,
        color VARCHAR(7),
        icon VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de metas
    await query(`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        target_amount DECIMAL(10,2) NOT NULL,
        current_amount DECIMAL(10,2) DEFAULT 0,
        deadline DATE,
        category VARCHAR(50),
        icon VARCHAR(50),
        color VARCHAR(7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela para webhooks (WhatsApp, Kiwify)
    await query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        event_type VARCHAR(100),
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Migrações concluídas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro nas migrações:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
