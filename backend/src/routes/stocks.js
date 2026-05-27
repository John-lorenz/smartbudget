const { Router } = require('express');
const stockController = require('../controllers/stockController');
const authMiddleware = require('../middlewares/auth');

const router = Router();

router.use(authMiddleware);

router.get('/', stockController.list);
router.post('/', stockController.create);
router.get('/search', stockController.search);
router.get('/quote/:symbol', stockController.quote);
router.delete('/:id', stockController.remove);

module.exports = router;
