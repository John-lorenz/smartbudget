const { Router } = require('express');
const cryptoController = require('../controllers/cryptoController');
const authMiddleware = require('../middlewares/auth');

const router = Router();

router.use(authMiddleware);

router.get('/', cryptoController.list);
router.post('/', cryptoController.create);
router.get('/search', cryptoController.search);
router.get('/quote/:coinId', cryptoController.quote);
router.delete('/:id', cryptoController.remove);

module.exports = router;
