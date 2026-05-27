const pool = require('../config/database');
const { normalizeWhatsAppPhone } = require('../utils/phone');

function parseAmount(raw) {
  const normalized = String(raw || '').replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function helpText() {
  return [
    '*SmartBudget pelo WhatsApp*',
    '',
    'Comandos disponíveis:',
    '• despesa 50,00 mercado — registra uma despesa',
    '• receita 3500 salario — registra uma receita',
    '• meta viagem 10000 — cria uma meta',
    '• saldo — resumo do mês',
    '• ajuda — esta mensagem',
    '',
    'Vincule em Menu → WhatsApp → *Vincular WhatsApp*.',
  ].join('\n');
}

async function sendWhatsAppMessage(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn('WhatsApp API não configurada (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
    return false;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeWhatsAppPhone(to),
        type: 'text',
        text: { body },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro ao enviar WhatsApp:', errorText);
    return false;
  }

  return true;
}

async function findUserByPhone(from) {
  const phone = normalizeWhatsAppPhone(from);
  if (!phone) return null;

  const result = await pool.query(
    'SELECT id, name FROM users WHERE whatsapp_phone = $1',
    [phone]
  );

  return result.rows[0] || null;
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
  const receitas = Number(row.receitas);
  const despesas = Number(row.despesas);
  const saldo = receitas - despesas;

  return { receitas, despesas, saldo };
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function handleCommand(userId, text) {
  const message = String(text || '').trim();
  const lower = message.toLowerCase();

  if (!message || lower === 'ajuda' || lower === 'help') {
    return helpText();
  }

  if (lower === 'saldo' || lower === 'resumo') {
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
    'Envie *ajuda* para ver os comandos disponíveis.',
  ].join('\n');
}

async function tryLinkAccount(from, text) {
  const match = String(text || '').trim().match(/^vincular\s+([a-z0-9]+)$/i);
  if (!match) return null;

  const token = match[1].toLowerCase();
  const phone = normalizeWhatsAppPhone(from);

  const tokenResult = await pool.query(
    `SELECT user_id
     FROM whatsapp_link_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );

  if (tokenResult.rows.length === 0) {
    return 'Código inválido ou expirado. No app, toque em *Vincular WhatsApp* para gerar um novo.';
  }

  const userId = tokenResult.rows[0].user_id;

  const taken = await pool.query(
    'SELECT id FROM users WHERE whatsapp_phone = $1 AND id <> $2',
    [phone, userId]
  );

  if (taken.rows.length > 0) {
    return 'Este WhatsApp já está vinculado a outra conta SmartBudget.';
  }

  await pool.query('UPDATE users SET whatsapp_phone = $1 WHERE id = $2', [phone, userId]);
  await pool.query(
    'UPDATE whatsapp_link_tokens SET used_at = NOW() WHERE token = $1',
    [token]
  );

  return [
    '✅ *Conta vinculada com sucesso!*',
    '',
    'Agora você pode usar o SmartBudget por aqui.',
    'Envie *ajuda* para ver os comandos.',
  ].join('\n');
}

async function processIncomingMessage(from, text) {
  const linkReply = await tryLinkAccount(from, text);
  if (linkReply) return linkReply;

  const user = await findUserByPhone(from);

  if (!user) {
    return [
      'Olá! Este número ainda não está vinculado ao SmartBudget.',
      'Abra o app → menu *WhatsApp* → toque em *Vincular WhatsApp*.',
      'Depois envie a mensagem que aparecer no chat.',
    ].join('\n');
  }

  return handleCommand(user.id, text);
}

module.exports = {
  helpText,
  sendWhatsAppMessage,
  processIncomingMessage,
  normalizeWhatsAppPhone,
};
