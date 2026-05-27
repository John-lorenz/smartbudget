const { Router } = require('express');
const telegramController = require('../controllers/telegramController');

const router = Router();

router.post('/webhook', telegramController.webhook);
router.get('/setup', telegramController.setupWebhook);
router.get('/info', telegramController.getBotInfo);

module.exports = router;
