const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { clientMessageForDbError } = require('../utils/dbErrors');
const { normalizeWhatsAppPhone } = require('../utils/phone');

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

exports.register = async (req, res) => {
  try {
    const nameRaw = req.body.name;
    const emailRaw = req.body.email;
    const password = req.body.password;

    const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    }

    if (name.length < 2) {
      return res.status(400).json({ error: 'O nome deve ter pelo menos 2 caracteres (sem contar espaços nas pontas)' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'O nome deve ter no máximo 100 caracteres' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    return res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const emailRaw = req.body.email;
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.json({ message: 'Se o e-mail estiver cadastrado, um código de recuperação será gerado.' });
    }

    const user = userResult.rows[0];
    const resetToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = hashResetToken(resetToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    return res.json({
      message: 'Código de recuperação gerado. Use-o para definir uma nova senha.',
      resetToken,
      expiresAt,
    });
  } catch (err) {
    console.error('Erro ao solicitar recuperação de senha:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.resetPassword = async (req, res) => {
  let client;

  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const newPassword = req.body.password;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Código e nova senha são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const tokenHash = hashResetToken(token);
    const tokenResult = await pool.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    const reset = tokenResult.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, reset.user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [reset.id]);
    await client.query('COMMIT');

    return res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Erro ao redefinir senha:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const token = generateToken(user.id);

    return res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, whatsapp_phone, telegram_chat_id, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.requestWhatsAppLink = async (req, res) => {
  try {
    const botNumber = String(process.env.WHATSAPP_DISPLAY_NUMBER || '').replace(/\D/g, '');

    if (!botNumber) {
      return res.status(503).json({
        error: 'WhatsApp do SmartBudget ainda não está configurado em produção.',
      });
    }

    await pool.query(
      `UPDATE whatsapp_link_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [req.userId]
    );

    const token = crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
    const message = `vincular ${token}`;
    const linkUrl = `https://wa.me/${botNumber}?text=${encodeURIComponent(message)}`;

    await pool.query(
      `INSERT INTO whatsapp_link_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [req.userId, token, expiresAt]
    );

    return res.json({
      linkUrl,
      message,
      expiresAt,
      botNumber,
    });
  } catch (err) {
    console.error('Erro ao gerar link WhatsApp:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.unlinkWhatsApp = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET whatsapp_phone = NULL WHERE id = $1 RETURNING id, name, email, whatsapp_phone, telegram_chat_id',
      [req.userId]
    );

    return res.json({
      message: 'WhatsApp desvinculado',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Erro ao desvincular WhatsApp:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.requestTelegramLink = async (req, res) => {
  try {
    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || '').replace('@', '');

    if (!process.env.TELEGRAM_BOT_TOKEN || !botUsername) {
      return res.status(503).json({
        error: 'Bot do Telegram não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME.',
      });
    }

    await pool.query(
      `UPDATE telegram_link_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [req.userId]
    );

    const token = crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
    const linkUrl = `https://t.me/${botUsername}?start=${token}`;

    await pool.query(
      `INSERT INTO telegram_link_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [req.userId, token, expiresAt]
    );

    return res.json({
      linkUrl,
      token,
      expiresAt,
      botUsername,
    });
  } catch (err) {
    console.error('Erro ao gerar link Telegram:', err);
    const dbMsg = clientMessageForDbError(err);
    if (dbMsg) {
      return res.status(503).json({ error: dbMsg });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.unlinkTelegram = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET telegram_chat_id = NULL WHERE id = $1 RETURNING id, name, email, telegram_chat_id',
      [req.userId]
    );

    return res.json({
      message: 'Telegram desvinculado',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Erro ao desvincular Telegram:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
