const pool = require('../config/database');
const { handleCommand, helpText } = require('./assistantCommands');

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

async function sendTelegramMessage(chatId, text) {
  const token = getBotToken();
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN não configurado');
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const plain = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return plain.ok;
  }

  return true;
}

async function findUserByChatId(chatId) {
  const result = await pool.query(
    'SELECT id, name FROM users WHERE telegram_chat_id = $1',
    [String(chatId)]
  );
  return result.rows[0] || null;
}

function extractLinkToken(text) {
  const message = String(text || '').trim();
  const startMatch = message.match(/^\/start(?:@[\w_]+)?\s+([a-z0-9]+)$/i);
  if (startMatch) return startMatch[1].toLowerCase();

  const vincularMatch = message.match(/^vincular\s+([a-z0-9]+)$/i);
  if (vincularMatch) return vincularMatch[1].toLowerCase();

  return null;
}

async function tryLinkAccount(chatId, text) {
  const token = extractLinkToken(text);
  if (!token) return null;

  const tokenResult = await pool.query(
    `SELECT user_id
     FROM telegram_link_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );

  if (tokenResult.rows.length === 0) {
    return 'Código inválido ou expirado. No app, toque em *Vincular Telegram* para gerar um novo link.';
  }

  const userId = tokenResult.rows[0].user_id;
  const chatIdStr = String(chatId);

  const taken = await pool.query(
    'SELECT id FROM users WHERE telegram_chat_id = $1 AND id <> $2',
    [chatIdStr, userId]
  );

  if (taken.rows.length > 0) {
    return 'Este Telegram já está vinculado a outra conta SmartBudget.';
  }

  await pool.query('UPDATE users SET telegram_chat_id = $1 WHERE id = $2', [chatIdStr, userId]);
  await pool.query(
    'UPDATE telegram_link_tokens SET used_at = NOW() WHERE token = $1',
    [token]
  );

  return [
    '✅ *Conta vinculada!*',
    '',
    'Use o SmartBudget por aqui. Envie *ajuda* para ver os comandos.',
  ].join('\n');
}

async function processUpdate(update) {
  const message = update.message || update.edited_message;
  if (!message?.text || !message.chat?.id) return;

  const chatId = message.chat.id;
  const text = message.text;

  const linkReply = await tryLinkAccount(chatId, text);
  if (linkReply) {
    await sendTelegramMessage(chatId, linkReply);
    return;
  }

  if (/^\/start(?:@\w+)?$/i.test(text.trim())) {
    await sendTelegramMessage(chatId, [
      'Olá! Sou o assistente do *SmartBudget*.',
      '',
      'Para vincular sua conta, abra o app → *Telegram* → *Vincular Telegram*.',
      'Depois toque em *Iniciar* no link que o app abrir.',
    ].join('\n'));
    return;
  }

  const user = await findUserByChatId(chatId);
  if (!user) {
    await sendTelegramMessage(chatId, [
      'Conta ainda não vinculada.',
      'No app SmartBudget: Menu → *Telegram* → *Vincular Telegram*.',
    ].join('\n'));
    return;
  }

  const reply = await handleCommand(user.id, text);
  await sendTelegramMessage(chatId, reply);
}

async function registerWebhook() {
  const token = getBotToken();
  const baseUrl = process.env.TELEGRAM_WEBHOOK_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!token || !baseUrl) return false;

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });

  return response.ok;
}

module.exports = {
  sendTelegramMessage,
  processUpdate,
  registerWebhook,
  helpText,
};
