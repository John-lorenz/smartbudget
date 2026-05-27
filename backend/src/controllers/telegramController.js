const { processUpdate, registerWebhook } = require('../services/telegramService');

exports.webhook = async (req, res) => {
  res.sendStatus(200);

  try {
    if (req.body) {
      await processUpdate(req.body);
    }
  } catch (err) {
    console.error('Erro no webhook Telegram:', err);
  }
};

exports.setupWebhook = async (req, res) => {
  try {
    const ok = await registerWebhook();
    if (!ok) {
      return res.status(503).json({
        error: 'Configure TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_URL (ou deploy na Vercel).',
      });
    }
    return res.json({ message: 'Webhook do Telegram registrado com sucesso' });
  } catch (err) {
    console.error('Erro ao registrar webhook Telegram:', err);
    return res.status(500).json({ error: 'Erro ao registrar webhook' });
  }
};

exports.getBotInfo = (req, res) => {
  const username = String(process.env.TELEGRAM_BOT_USERNAME || '').replace('@', '');
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN && username);

  return res.json({
    configured,
    username,
    botUrl: username ? `https://t.me/${username}` : null,
  });
};
