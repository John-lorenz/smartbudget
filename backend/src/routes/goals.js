const { Router } = require('express');
const goalController = require('../controllers/goalController');
const authMiddleware = require('../middlewares/auth');

const router = Router();

router.use(authMiddleware);

router.post('/', goalController.create);
router.get('/', goalController.list);
router.get('/:id', goalController.getById);
router.put('/:id', goalController.update);
router.delete('/:id', goalController.remove);

module.exports = router;
