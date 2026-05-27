const {
  processIncomingMessage,
  sendWhatsAppMessage,
} = require('../services/whatsappService');

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

exports.receiveWebhook = async (req, res) => {
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value;
        const messages = value?.messages || [];

        for (const message of messages) {
          if (message.type !== 'text' || !message.text?.body) continue;

          const from = message.from;
          const reply = await processIncomingMessage(from, message.text.body);
          await sendWhatsAppMessage(from, reply);
        }
      }
    }
  } catch (err) {
    console.error('Erro no webhook WhatsApp:', err);
  }
};
