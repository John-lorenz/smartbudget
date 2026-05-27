const pool = require('../config/database');

// ─────────────────────────────────────────────
// Stopwords e categorias conhecidas
// ─────────────────────────────────────────────
const STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'com', 'para', 'pra', 'pro', 'por', 'um', 'uma', 'o', 'a', 'os', 'as',
]);

// Categorias/locais conhecidos: se aparecerem com um valor, assume despesa
const KNOWN_EXPENSE_WORDS = new Set([
  'mercado', 'supermercado', 'feira', 'hortifruti', 'acougue',
  'farmacia', 'remedios', 'remedio', 'drogaria',
  'uber', 'ifood', '99', 'rappi', 'cabify', 'taxi',
  'aluguel', 'condominio', 'iptu', 'ipva',
  'luz', 'energia', 'agua', 'gas', 'internet', 'telefone', 'celular', 'plano',
  'academia', 'escola', 'faculdade', 'mensalidade', 'curso',
  'restaurante', 'lanchonete', 'padaria', 'cafe', 'almoco', 'jantar', 'lanche',
  'posto', 'gasolina', 'etanol', 'combustivel', 'estacionamento',
  'cinema', 'netflix', 'spotify', 'youtube', 'amazon', 'disney', 'prime',
  'medico', 'dentista', 'hospital', 'consulta', 'exame', 'plano de saude',
  'onibus', 'metro', 'trem', 'passagem', 'viagem',
  'roupa', 'sapato', 'calcado', 'vestuario',
  'cartao', 'boleto', 'fatura', 'parcela', 'prestacao',
  'obra', 'reforma', 'material', 'ferragem',
  'presente', 'gift', 'delivery',
]);

// ─────────────────────────────────────────────
// Formatação
// ─────────────────────────────────────────────
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

function shortId(id) {
  // Identificador exibido ao usuário (atualmente o id numérico da transação)
  return String(id);
}

// ─────────────────────────────────────────────
// Ajuda
// ─────────────────────────────────────────────
function helpText(channel = 'Telegram') {
  return [
    `*SmartBudget pelo ${channel}* 💰`,
    '',
    '*Registrar despesa:*',
    '• gastei 45,90 no mercado',
    '• paguei 120 academia',
    '• 35 farmácia (sem palavra-chave também funciona!)',
    '• 50 uber ontem',
    '',
    '*Registrar receita:*',
    '• recebi 3500 salário',
    '• ganhei 800 freelance',
    '',
    '*Consultas:*',
    '• saldo — resumo do mês',
    '• hoje — lançamentos de hoje',
    '• extrato — últimas 5 transações',
    '• mes passado — resumo do mês anterior',
    '• gastos mercado — quanto gastei nessa categoria',
    '',
    '*Metas:*',
    '• meta viagem 10000 — criar meta',
    '• metas — listar minhas metas',
    '',
    '*Outros:*',
    '• desfazer — apaga o último lançamento',
    '• desfazer #A1B2 — apaga por ID',
    '',
    'As datas funcionam com: _hoje_, _ontem_, _anteontem_',
  ].join('\n');
}

// ─────────────────────────────────────────────
// Parsing de data
// ─────────────────────────────────────────────
function extractDate(message) {
  const normalized = normalizeText(message);

  if (/\banteontem\b/.test(normalized)) {
    return { dateSql: "CURRENT_DATE - INTERVAL '2 days'", label: 'anteontem' };
  }
  if (/\bontem\b/.test(normalized)) {
    return { dateSql: "CURRENT_DATE - INTERVAL '1 day'", label: 'ontem' };
  }

  // "dia 15" ou "dia 5"
  const diaMatch = normalized.match(/\bdia\s+(\d{1,2})\b/);
  if (diaMatch) {
    const day = parseInt(diaMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return {
        dateSql: `DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '${day - 1} days'`,
        label: `dia ${day}`,
      };
    }
  }

  return { dateSql: 'CURRENT_DATE', label: 'hoje' };
}

function stripDateWords(value) {
  return cleanFreeText(value.replace(/\b(hoje|ontem|anteontem|dia\s+\d{1,2})\b/gi, ''));
}

// ─────────────────────────────────────────────
// Parsing de transação
// ─────────────────────────────────────────────
function stripCommandPrefix(message, words) {
  const pattern = new RegExp(`^/?(?:${words.join('|')})\\b\\s*`, 'i');
  return cleanFreeText(message.replace(pattern, ''));
}

function splitCategoryAndDescription(rest) {
  const clean = stripDateWords(rest);
  const withoutPrefix = clean.replace(/^(no|na|nos|nas|em|com|de|do|da|dos|das|pro|pra|para)\s+/i, '');
  const words = withoutPrefix.split(/\s+/).filter(Boolean);

  if (words.length === 0) return { category: 'Geral', description: null };

  const firstMeaningful = words.findIndex((w) => !STOPWORDS.has(normalizeText(w)));
  const categoryIndex = firstMeaningful >= 0 ? firstMeaningful : 0;
  const category = titleCase(words[categoryIndex] || 'Geral').slice(0, 50);

  // Descrição = todo o texto livre depois do valor (sem datas e sem preposição inicial).
  // Garante que sempre apareça algo na coluna "Descrição" do app.
  const fullDescription = titleCase(withoutPrefix).slice(0, 255);

  return { category, description: fullDescription || null };
}

function parseTransactionMessage(message) {
  const normalized = normalizeText(message);

  const amountMatch = message.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?)/i);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[0]);
  if (!amount) return { error: 'Valor inválido. Ex: gastei 45,90 no mercado' };

  const beforeAmount = normalizeText(message.slice(0, amountMatch.index));
  const afterAmount = cleanFreeText(message.slice(amountMatch.index + amountMatch[0].length));
  const afterNorm = normalizeText(afterAmount);

  // ── Detectar tipo ──
  const incomeKeywords = /\b(receita|recebi|recebido|ganhei|ganho|salario|pagamento|pix\s*recebido|freelance|bonus|deposito|reembolso|comissao|honorario|aluguel\s*recebido)\b/;
  const expenseKeywords = /\b(despesa|gasto|gastei|paguei|pago|comprei|compra|debito|saida|saiu|cobrado|cobrei|transferi|boleto|fatura|parcelei|parcela)\b/;

  const isIncome = incomeKeywords.test(normalized) || incomeKeywords.test(beforeAmount);
  const isExpense = expenseKeywords.test(normalized) || expenseKeywords.test(beforeAmount);

  // ── Detecção inteligente: valor + categoria conhecida → despesa ──
  if (!isIncome && !isExpense) {
    const allWords = normalizeText(message).split(/\s+/);
    const hasKnownExpenseWord = allWords.some((w) => KNOWN_EXPENSE_WORDS.has(w));
    if (!hasKnownExpenseWord) return null;
    // Trata como despesa automática
  }

  if (isIncome && isExpense) {
    // Ambíguo: prioriza o que aparece primeiro
    const incomeIndex = normalized.search(incomeKeywords);
    const expenseIndex = normalized.search(expenseKeywords);
    const resolvedIsIncome = incomeIndex < expenseIndex;
    const { category, description } = splitCategoryAndDescription(afterAmount);
    const { dateSql, label } = extractDate(message);
    return { type: resolvedIsIncome ? 'receita' : 'despesa', amount, category, description, dateSql, dateLabel: label };
  }

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

// ─────────────────────────────────────────────
// Parsing de meta
// ─────────────────────────────────────────────
function parseGoalMessage(message) {
  if (!/^\/?(?:meta|objetivo|criar\s+meta)\b/i.test(message)) return null;

  const body = stripCommandPrefix(message, ['meta', 'objetivo', 'criar meta']);
  const amountMatch = body.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?)/i);
  if (!amountMatch) return { error: 'Informe o valor alvo. Ex: meta viagem 10000' };

  const target = parseAmount(amountMatch[0]);
  const titleRaw = cleanFreeText(body.replace(amountMatch[0], '').replace(/\b(para|pra|de|do|da)\b/gi, ''));
  const title = titleCase(titleRaw).slice(0, 100);

  if (!title) return { error: 'Informe o nome da meta. Ex: meta viagem 10000' };
  if (!target) return { error: 'Valor alvo inválido. Ex: meta viagem 10000' };

  return { title, target };
}

// ─────────────────────────────────────────────
// Operações de banco
// ─────────────────────────────────────────────
async function getMonthSummary(userId, monthOffset = 0) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END), 0) AS despesas
     FROM transactions
     WHERE user_id = $1
       AND date >= date_trunc('month', CURRENT_DATE) + ($2 || ' month')::interval
       AND date <  date_trunc('month', CURRENT_DATE) + ($3 || ' month')::interval`,
    [userId, String(monthOffset), String(monthOffset + 1)]
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

async function getRecentTransactions(userId, limit = 5) {
  const result = await pool.query(
    `SELECT id, type, amount, category, description, date
     FROM transactions
     WHERE user_id = $1
     ORDER BY date DESC, created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function getSpendingByCategory(userId, categoryNorm) {
  // Busca aproximada: ILIKE + sem acento
  const result = await pool.query(
    `SELECT
       category,
       COALESCE(SUM(amount), 0) AS total,
       COUNT(*)::int AS qtd
     FROM transactions
     WHERE user_id = $1
       AND type = 'despesa'
       AND date >= date_trunc('month', CURRENT_DATE)
       AND date <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
       AND LOWER(unaccent(category)) ILIKE $2
     GROUP BY category
     ORDER BY total DESC`,
    [userId, `%${categoryNorm}%`]
  );
  return result.rows;
}

async function listGoals(userId) {
  const result = await pool.query(
    `SELECT title, target_amount, current_amount
     FROM goals
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 8`,
    [userId]
  );
  return result.rows;
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
  const action = transaction.type === 'receita' ? '💰 Receita registrada' : '💸 Despesa registrada';
  const description = transaction.description ? `\nDescrição: ${transaction.description}` : '';
  return [
    `✅ ${action}`,
    `Valor: *${formatBRL(transaction.amount)}*`,
    `Categoria: ${transaction.category}`,
    `Data: ${dateLabel || formatDateLabel(transaction.date)}`,
    `ID: #${shortId(transaction.id)}`,
    description,
    '',
    '_Envie *desfazer* ou *desfazer #' + shortId(transaction.id) + '* para cancelar._',
  ].filter(Boolean).join('\n');
}

async function undoLastTransaction(userId, targetId = null) {
  let query;
  let params;

  if (targetId) {
    const idNum = parseInt(targetId, 10);
    if (!Number.isFinite(idNum)) {
      return `ID inválido: #${targetId}`;
    }
    query = `
      DELETE FROM transactions
      WHERE user_id = $1 AND id = $2
      RETURNING type, amount, category`;
    params = [userId, idNum];
  } else {
    query = `
      DELETE FROM transactions
      WHERE id = (
        SELECT id FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING type, amount, category`;
    params = [userId];
  }

  const result = await pool.query(query, params);
  if (result.rows.length === 0) {
    return targetId
      ? `Não encontrei transação com ID #${targetId}.`
      : 'Não há transação para desfazer.';
  }

  const row = result.rows[0];
  const label = row.type === 'receita' ? 'receita' : 'despesa';
  return `✅ Desfeito: ${label} de *${formatBRL(row.amount)}* em ${row.category}.`;
}

// ─────────────────────────────────────────────
// Dispatcher principal
// ─────────────────────────────────────────────
async function handleCommand(userId, text) {
  const message = String(text || '').trim();
  const normalized = normalizeText(message);

  // ── Ajuda ──
  if (!message || ['ajuda', 'help', '/ajuda', '/help', 'comandos', '/start'].includes(normalized)) {
    return helpText('Telegram');
  }

  // ── Saldo / resumo do mês ──
  if (/^\/?(?:saldo|resumo)(?:\s+(?:do\s+)?mes)?$/.test(normalized)) {
    const s = await getMonthSummary(userId, 0);
    return [
      '📊 *Resumo do mês*',
      `Receitas:  ${formatBRL(s.receitas)}`,
      `Despesas: ${formatBRL(s.despesas)}`,
      `Saldo:      *${formatBRL(s.saldo)}*`,
    ].join('\n');
  }

  // ── Mês passado ──
  if (/^\/?(?:mes\s+passado|ultimo\s+mes|mes\s+anterior)$/.test(normalized)) {
    const s = await getMonthSummary(userId, -1);
    return [
      '📊 *Resumo do mês passado*',
      `Receitas:  ${formatBRL(s.receitas)}`,
      `Despesas: ${formatBRL(s.despesas)}`,
      `Saldo:      *${formatBRL(s.saldo)}*`,
    ].join('\n');
  }

  // ── Hoje ──
  if (/^\/?(?:hoje|resumo\s+hoje|saldo\s+hoje)$/.test(normalized)) {
    const s = await getTodaySummary(userId);
    if (s.total === 0) return '📅 Nenhum lançamento hoje ainda.';
    return [
      '📅 *Hoje*',
      `Lançamentos: ${s.total}`,
      `Receitas:  ${formatBRL(s.receitas)}`,
      `Despesas: ${formatBRL(s.despesas)}`,
      `Saldo:      *${formatBRL(s.saldo)}*`,
    ].join('\n');
  }

  // ── Extrato ──
  if (/^\/?(?:extrato|ultimos?|ultimas?|historico)$/.test(normalized)) {
    const rows = await getRecentTransactions(userId, 5);
    if (rows.length === 0) return 'Você ainda não tem transações registradas.';
    return [
      '📋 *Últimas transações*',
      ...rows.map((row) => {
        const signal = row.type === 'receita' ? '➕' : '➖';
        const desc = row.description ? ` (${row.description})` : '';
        return `${signal} *${formatBRL(row.amount)}* — ${row.category}${desc} | ${formatDateLabel(row.date)} | #${shortId(row.id)}`;
      }),
      '',
      '_Use *desfazer #XXXX* para cancelar um lançamento específico._',
    ].join('\n');
  }

  // ── Gastos por categoria ──
  const gastosMatch = normalized.match(/^\/?(?:gastos?|quanto\s+gastei\s+(?:em|no|na|com)?)\s+(.+)$/);
  if (gastosMatch) {
    const catQuery = normalizeText(gastosMatch[1]);
    const rows = await getSpendingByCategory(userId, catQuery);
    if (rows.length === 0) {
      return `Não encontrei gastos em "_${titleCase(gastosMatch[1])}_" este mês.`;
    }
    const total = rows.reduce((acc, r) => acc + Number(r.total), 0);
    const lines = rows.map((r) => `• ${r.category}: ${formatBRL(r.total)} (${r.qtd}x)`);
    return [
      `🔍 *Gastos em "${titleCase(gastosMatch[1])}" este mês*`,
      ...lines,
      rows.length > 1 ? `\nTotal: *${formatBRL(total)}*` : '',
    ].filter(Boolean).join('\n');
  }

  // ── Desfazer ──
  const desfazerMatch = normalized.match(/^\/?(?:desfazer|apagar(?:\s+ultima)?|remover(?:\s+ultima)?|cancelar(?:\s+ultima)?|desfaz)(?:\s+#?(\d{1,10}))?$/i);
  if (desfazerMatch) {
    const targetId = desfazerMatch[1] || null;
    return undoLastTransaction(userId, targetId);
  }

  // ── Listar metas ──
  if (/^\/?(?:metas?|objetivos?|minhas\s+metas?)$/.test(normalized)) {
    const goals = await listGoals(userId);
    if (goals.length === 0) {
      return 'Você não tem metas criadas ainda.\n\nCrie com: *meta viagem 10000*';
    }
    const lines = goals.map((g) => {
      const pct = g.target_amount > 0
        ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
        : 0;
      const filled = Math.round(pct / 10);
      const empty = 10 - filled;
      const bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);
      const status = pct >= 100 ? ' ✅' : '';
      return `*${g.title}*${status}\n${bar} ${pct}%\n${formatBRL(g.current_amount)} / ${formatBRL(g.target_amount)}`;
    });
    return ['🎯 *Suas metas*', '', ...lines].join('\n\n');
  }

  // ── Criar meta ──
  const goal = parseGoalMessage(message);
  if (goal?.error) return goal.error;
  if (goal) {
    await pool.query(
      `INSERT INTO goals (user_id, title, target_amount, current_amount) VALUES ($1, $2, $3, 0)`,
      [userId, goal.title, goal.target]
    );
    return `🎯 Meta criada: *${goal.title}*\nAlvo: ${formatBRL(goal.target)}`;
  }

  // ── Transação ──
  const transaction = parseTransactionMessage(message);
  if (transaction?.error) return transaction.error;
  if (transaction) {
    const saved = await createTransaction(userId, transaction);
    return formatTransactionConfirmation(saved, transaction.dateLabel);
  }

  // ── Não entendeu ──
  return [
    '🤔 Não entendi.',
    '',
    'Tente algo como:',
    '• *gastei 45,90 no mercado*',
    '• *50 uber* (só valor + categoria também funciona)',
    '• *recebi 3500 salário*',
    '• *saldo* ou *extrato*',
    '',
    'Envie *ajuda* para ver tudo que sei fazer.',
  ].join('\n');
}

module.exports = {
  parseAmount,
  formatBRL,
  helpText,
  getMonthSummary,
  handleCommand,
};
