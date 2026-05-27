require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const pool = require('../config/database');

const migration = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('receita', 'despesa')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    target_price DECIMAL(12,2),
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, symbol)
  );

  CREATE TABLE IF NOT EXISTS crypto_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coin_id VARCHAR(60) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    target_price DECIMAL(18,2),
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, coin_id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_stock_watchlist_user ON stock_watchlist(user_id);
  CREATE INDEX IF NOT EXISTS idx_crypto_watchlist_user ON crypto_watchlist(user_id);

  ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whatsapp_phone ON users(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;

  CREATE TABLE IF NOT EXISTS whatsapp_link_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(32) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_whatsapp_link_tokens_user ON whatsapp_link_tokens(user_id);

  ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(32);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_chat ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(32) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens(user_id);
`;

async function runMigrations() {
  try {
    console.log('Executando migrations...');
    await pool.query(migration);
    console.log('Migrations executadas com sucesso!');
  } catch (err) {
    console.error('Erro ao executar migrations:', err);
  } finally {
    await pool.end();
  }
}

runMigrations();
