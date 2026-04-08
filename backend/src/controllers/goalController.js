const pool = require('../config/database');

exports.create = async (req, res) => {
  try {
    const { title, target_amount, current_amount, deadline } = req.body;

    if (!title || !target_amount) {
      return res.status(400).json({ error: 'Título e valor alvo são obrigatórios' });
    }

    if (Number(target_amount) <= 0) {
      return res.status(400).json({ error: 'O valor alvo deve ser maior que zero' });
    }

    const result = await pool.query(
      `INSERT INTO goals (user_id, title, target_amount, current_amount, deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, title, target_amount, current_amount || 0, deadline || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar meta:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.list = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY deadline ASC NULLS LAST, created_at DESC',
      [req.userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar metas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta não encontrada' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar meta:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, target_amount, current_amount, deadline } = req.body;

    const existing = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Meta não encontrada' });
    }

    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE goals
       SET title = $1, target_amount = $2, current_amount = $3, deadline = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [
        title || current.title,
        target_amount || current.target_amount,
        current_amount !== undefined ? current_amount : current.current_amount,
        deadline !== undefined ? deadline : current.deadline,
        req.params.id,
        req.userId,
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar meta:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta não encontrada' });
    }

    return res.json({ message: 'Meta removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover meta:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
