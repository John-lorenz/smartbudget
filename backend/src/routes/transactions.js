const { Router } = require('express');
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middlewares/auth');

const router = Router();

router.use(authMiddleware);

router.post('/', transactionController.create);
router.get('/', transactionController.list);
router.get('/summary', transactionController.summary);
router.get('/indicators', transactionController.indicators);
router.get('/report', transactionController.report);
router.get('/:id', transactionController.getById);
router.put('/:id', transactionController.update);
router.delete('/:id', transactionController.remove);

module.exports = router;
