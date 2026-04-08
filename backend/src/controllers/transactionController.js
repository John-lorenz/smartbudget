const pool = require('../config/database');

exports.create = async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    if (!type || !amount || !category) {
      return res.status(400).json({ error: 'Tipo, valor e categoria são obrigatórios' });
    }

    if (!['receita', 'despesa'].includes(type)) {
      return res.status(400).json({ error: 'Tipo deve ser "receita" ou "despesa"' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'O valor deve ser maior que zero' });
    }

    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, category, description, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, type, amount, category, description || null, date || new Date()]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.list = async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;

    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [req.userId];
    let paramIndex = 2;

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (startDate) {
      query += ` AND date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar transações:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar transação:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.update = async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    const existing = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE transactions
       SET type = $1, amount = $2, category = $3, description = $4, date = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        type || current.type,
        amount || current.amount,
        category || current.category,
        description !== undefined ? description : current.description,
        date || current.date,
        req.params.id,
        req.userId,
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar transação:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    return res.json({ message: 'Transação removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover transação:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.summary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END), 0) AS total_receitas,
         COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END), 0) AS total_despesas,
         COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE -amount END), 0) AS saldo
       FROM transactions
       WHERE user_id = $1`,
      [req.userId]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
