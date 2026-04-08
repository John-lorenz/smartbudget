const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { clientMessageForDbError } = require('../utils/dbErrors');

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
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
