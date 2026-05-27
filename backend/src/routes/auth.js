const { Router } = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authMiddleware, authController.me);
router.post('/whatsapp/link-request', authMiddleware, authController.requestWhatsAppLink);
router.delete('/whatsapp', authMiddleware, authController.unlinkWhatsApp);
router.post('/telegram/link-request', authMiddleware, authController.requestTelegramLink);
router.delete('/telegram', authMiddleware, authController.unlinkTelegram);

module.exports = router;
