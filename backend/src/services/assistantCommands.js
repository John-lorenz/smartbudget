const pool = require('../config/database');

function parseAmount(raw) {
  const normalized = String(raw || '').replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function helpText(channel = 'Telegram') {
  return [
    `*SmartBudget pelo ${channel}*`,
    '',
    'Comandos:',
    '• despesa 50,00 mercado',
    '• receita 3500 salario',
    '• meta viagem 10000',
    '• saldo — resumo do mês',
    '• ajuda',
    '',
    'Vincule no app: Menu → Telegram → *Vincular Telegram*.',
  ].join('\n');
}

async function getMonthSummary(userId) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END), 0) AS despesas
     FROM transactions
     WHERE user_id = $1
       AND date >= date_trunc('month', CURRENT_DATE)
       AND date < date_trunc('month', CURRENT_DATE) + interval '1 month'`,
    [userId]
  );

  const row = result.rows[0];
  return {
    receitas: Number(row.receitas),
    despesas: Number(row.despesas),
    saldo: Number(row.receitas) - Number(row.despesas),
  };
}

async function handleCommand(userId, text) {
  const message = String(text || '').trim();
  const lower = message.toLowerCase();

  if (!message || lower === 'ajuda' || lower === 'help' || lower === '/ajuda') {
    return helpText('Telegram');
  }

  if (lower === 'saldo' || lower === 'resumo' || lower === '/saldo') {
    const summary = await getMonthSummary(userId);
    return [
      '*Resumo do mês*',
      `Receitas: ${formatBRL(summary.receitas)}`,
      `Despesas: ${formatBRL(summary.despesas)}`,
      `Saldo: ${formatBRL(summary.saldo)}`,
    ].join('\n');
  }

  const expenseMatch = message.match(/^despesa\s+([\d.,]+)\s+(.+)$/i);
  if (expenseMatch) {
    const amount = parseAmount(expenseMatch[1]);
    if (!amount) return 'Valor inválido. Ex: despesa 45,90 mercado';

    const rest = expenseMatch[2].trim();
    const [category, ...descParts] = rest.split(/\s+/);
    const description = descParts.join(' ') || null;

    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, category, description, date)
       VALUES ($1, 'despesa', $2, $3, $4, CURRENT_DATE)`,
      [userId, amount, category, description]
    );

    return `Despesa registrada: ${formatBRL(amount)} em *${category}*`;
  }

  const incomeMatch = message.match(/^receita\s+([\d.,]+)\s+(.+)$/i);
  if (incomeMatch) {
    const amount = parseAmount(incomeMatch[1]);
    if (!amount) return 'Valor inválido. Ex: receita 3500 salario';

    const rest = incomeMatch[2].trim();
    const [category, ...descParts] = rest.split(/\s+/);
    const description = descParts.join(' ') || null;

    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, category, description, date)
       VALUES ($1, 'receita', $2, $3, $4, CURRENT_DATE)`,
      [userId, amount, category, description]
    );

    return `Receita registrada: ${formatBRL(amount)} em *${category}*`;
  }

  const goalMatch = message.match(/^meta\s+(.+?)\s+([\d.,]+)$/i);
  if (goalMatch) {
    const title = goalMatch[1].trim();
    const target = parseAmount(goalMatch[2]);
    if (!title) return 'Informe o nome da meta. Ex: meta viagem 10000';
    if (!target) return 'Valor alvo inválido. Ex: meta viagem 10000';

    await pool.query(
      `INSERT INTO goals (user_id, title, target_amount, current_amount)
       VALUES ($1, $2, $3, 0)`,
      [userId, title, target]
    );

    return `Meta criada: *${title}* — alvo ${formatBRL(target)}`;
  }

  return [
    'Não entendi o comando.',
    'Envie *ajuda* para ver os comandos.',
  ].join('\n');
}

module.exports = {
  parseAmount,
  formatBRL,
  helpText,
  getMonthSummary,
  handleCommand,
};
