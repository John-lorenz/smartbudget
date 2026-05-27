const { Router } = require('express');
const whatsappController = require('../controllers/whatsappController');

const router = Router();

router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.receiveWebhook);

module.exports = router;
