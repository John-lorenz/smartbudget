const pool = require('../config/database');

const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'pra']);

function parseAmount(raw) {
  const normalized = String(raw || '')
    .replace(/r\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanFreeText(value) {
  return String(value || '')
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  const text = cleanFreeText(value);
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateLabel(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function helpText(channel = 'Telegram') {
  return [
    `*SmartBudget pelo ${channel}*`,
    '',
    'Pode escrever de forma simples:',
    '• gastei 45,90 no mercado',
    '• despesa 25 uber ontem',
    '• recebi 3500 salario',
    '• meta viagem 10000',
    '• saldo',
    '• hoje',
    '• extrato',
    '• desfazer',
    '',
    'Dica: depois do valor, escreva a categoria e, se quiser, uma descrição.',
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

async function getTodaySummary(userId) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END), 0) AS despesas,
       COUNT(*)::int AS total
     FROM transactions
     WHERE user_id = $1 AND date = CURRENT_DATE`,
    [userId]
  );

  const row = result.rows[0];
  return {
    receitas: Number(row.receitas),
    despesas: Number(row.despesas),
    saldo: Number(row.receitas) - Number(row.despesas),
    total: Number(row.total),
  };
}

async function getRecentTransactions(userId) {
  const result = await pool.query(
    `SELECT id, type, amount, category, description, date
     FROM transactions
     WHERE user_id = $1
     ORDER BY date DESC, created_at DESC
     LIMIT 5`,
    [userId]
  );

  return result.rows;
}

function extractDate(message) {
  const normalized = normalizeText(message);
  if (/\bontem\b/.test(normalized)) {
    return { dateSql: "CURRENT_DATE - INTERVAL '1 day'", label: 'ontem' };
  }
  return { dateSql: 'CURRENT_DATE', label: 'hoje' };
}

function stripCommandPrefix(message, words) {
  const pattern = new RegExp(`^/?(?:${words.join('|')})\\b\\s*`, 'i');
  return cleanFreeText(message.replace(pattern, ''));
}

function stripDateWords(value) {
  return cleanFreeText(value.replace(/\b(hoje|ontem)\b/gi, ''));
}

function splitCategoryAndDescription(rest) {
  const clean = stripDateWords(rest);
  const withoutPrefix = clean.replace(/^(no|na|nos|nas|em|com|de|do|da|dos|das)\s+/i, '');
  const words = withoutPrefix.split(/\s+/).filter(Boolean);
  const firstMeaningful = words.findIndex((word) => !STOPWORDS.has(normalizeText(word)));
  const categoryIndex = firstMeaningful >= 0 ? firstMeaningful : 0;
  const category = titleCase(words[categoryIndex] || 'Geral').slice(0, 50);
  const description = words
    .filter((_, index) => index !== categoryIndex)
    .join(' ')
    .trim()
    .slice(0, 255);

  return {
    category,
    description: description || null,
  };
}

function parseTransactionMessage(message) {
  const normalized = normalizeText(message);
  const amountMatch = message.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?)/i);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[0]);
  if (!amount) {
    return { error: 'Valor inválido. Ex: gastei 45,90 no mercado' };
  }

  const beforeAmount = normalizeText(message.slice(0, amountMatch.index));
  const afterAmount = cleanFreeText(message.slice(amountMatch.index + amountMatch[0].length));
  const isIncome = /\b(receita|recebi|recebido|ganhei|ganho|salario|salario|pagamento|pix recebido)\b/.test(normalized)
    || /\b(receita|recebi|ganhei|salario|pagamento)\b/.test(beforeAmount);
  const isExpense = /\b(despesa|gasto|gastei|paguei|pago|comprei|compra|debito|saida|saiu)\b/.test(normalized)
    || /\b(despesa|gasto|gastei|paguei|comprei)\b/.test(beforeAmount);

  if (!isIncome && !isExpense) return null;

  const { category, description } = splitCategoryAndDescription(afterAmount);
  const { dateSql, label } = extractDate(message);

  return {
    type: isIncome ? 'receita' : 'despesa',
    amount,
    category,
    description,
    dateSql,
    dateLabel: label,
  };
}

function parseGoalMessage(message) {
  if (!/^\/?(meta|objetivo|criar meta)\b/i.test(message)) return null;

  const body = stripCommandPrefix(message, ['meta', 'objetivo', 'criar meta']);
  const amountMatch = body.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?)/i);
  if (!amountMatch) {
    return { error: 'Informe o valor alvo. Ex: meta viagem 10000' };
  }

  const target = parseAmount(amountMatch[0]);
  const title = titleCase(cleanFreeText(body.replace(amountMatch[0], '').replace(/\b(para|pra|de)\b/gi, ''))).slice(0, 100);
  if (!title) return { error: 'Informe o nome da meta. Ex: meta viagem 10000' };
  if (!target) return { error: 'Valor alvo inválido. Ex: meta viagem 10000' };

  return { title, target };
}

async function createTransaction(userId, parsed) {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, category, description, date)
     VALUES ($1, $2, $3, $4, $5, ${parsed.dateSql})
     RETURNING id, type, amount, category, description, date`,
    [userId, parsed.type, parsed.amount, parsed.category, parsed.description]
  );

  return result.rows[0];
}

function formatTransactionConfirmation(transaction, dateLabel) {
  const action = transaction.type === 'receita' ? 'Receita registrada' : 'Despesa registrada';
  const description = transaction.description ? `\nDescrição: ${transaction.description}` : '';
  return [
    `✅ ${action}`,
    `Valor: ${formatBRL(transaction.amount)}`,
    `Categoria: *${transaction.category}*`,
    `Data: ${dateLabel || formatDateLabel(transaction.date)}`,
    description,
    '',
    'Se errou, envie *desfazer* para apagar a última transação.',
  ].filter(Boolean).join('\n');
}

async function undoLastTransaction(userId) {
  const result = await pool.query(
    `DELETE FROM transactions
     WHERE id = (
       SELECT id
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING type, amount, category`,
    [userId]
  );

  if (result.rows.length === 0) {
    return 'Não encontrei nenhuma transação para desfazer.';
  }

  const row = result.rows[0];
  const label = row.type === 'receita' ? 'receita' : 'despesa';
  return `Desfeito: ${label} de ${formatBRL(row.amount)} em *${row.category}*.`;
}

async function handleCommand(userId, text) {
  const message = String(text || '').trim();
  const normalized = normalizeText(message);

  if (!message || ['ajuda', 'help', '/ajuda', '/help', 'comandos'].includes(normalized)) {
    return helpText('Telegram');
  }

  if (/^\/?(saldo|resumo)(\s+(do\s+)?mes)?$/.test(normalized)) {
    const summary = await getMonthSummary(userId);
    return [
      '*Resumo do mês*',
      `Receitas: ${formatBRL(summary.receitas)}`,
      `Despesas: ${formatBRL(summary.despesas)}`,
      `Saldo: ${formatBRL(summary.saldo)}`,
    ].join('\n');
  }

  if (/^\/?(hoje|resumo hoje|saldo hoje)$/.test(normalized)) {
    const summary = await getTodaySummary(userId);
    return [
      '*Resumo de hoje*',
      `Lançamentos: ${summary.total}`,
      `Receitas: ${formatBRL(summary.receitas)}`,
      `Despesas: ${formatBRL(summary.despesas)}`,
      `Saldo: ${formatBRL(summary.saldo)}`,
    ].join('\n');
  }

  if (['extrato', 'ultimos', 'ultimas', '/extrato'].includes(normalized)) {
    const rows = await getRecentTransactions(userId);
    if (rows.length === 0) return 'Você ainda não tem transações registradas.';

    return [
      '*Últimas transações*',
      ...rows.map((row) => {
        const signal = row.type === 'receita' ? '+' : '-';
        const desc = row.description ? ` — ${row.description}` : '';
        return `${signal} ${formatBRL(row.amount)} | ${row.category}${desc} | ${formatDateLabel(row.date)}`;
      }),
    ].join('\n');
  }

  if (['desfazer', 'apagar ultima', 'remover ultima', 'cancelar ultima', '/desfazer'].includes(normalized)) {
    return undoLastTransaction(userId);
  }

  const goal = parseGoalMessage(message);
  if (goal?.error) return goal.error;
  if (goal) {
    await pool.query(
      `INSERT INTO goals (user_id, title, target_amount, current_amount)
       VALUES ($1, $2, $3, 0)`,
      [userId, goal.title, goal.target]
    );
    return `Meta criada: *${goal.title}* — alvo ${formatBRL(goal.target)}`;
  }

  const transaction = parseTransactionMessage(message);
  if (transaction?.error) return transaction.error;
  if (transaction) {
    const saved = await createTransaction(userId, transaction);
    return formatTransactionConfirmation(saved, transaction.dateLabel);
  }

  return [
    'Não entendi ainda.',
    '',
    'Tente assim:',
    '• gastei 45,90 no mercado',
    '• recebi 3500 salario',
    '• saldo',
    '',
    'Envie *ajuda* para ver tudo que eu sei fazer.',
  ].join('\n');
}

module.exports = {
  parseAmount,
  formatBRL,
  helpText,
  getMonthSummary,
  handleCommand,
};
