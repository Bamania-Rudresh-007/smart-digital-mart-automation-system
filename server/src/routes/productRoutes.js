const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, enforceStoreScope } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { productSchema } = require('../validators/productSchemas');

router.use(authenticate);
router.use(enforceStoreScope);

// Products
router.get('/', requirePermission('Products', 'read'), ProductController.getProducts);
router.get('/meta/categories', ProductController.getCategories);
router.get('/meta/uoms', ProductController.getUnitsOfMeasure);
router.get('/meta/stores', ProductController.getStores);
router.get('/:id', requirePermission('Products', 'read'), ProductController.getProductById);
router.post('/', requirePermission('Products', 'create'), validate(productSchema), ProductController.createProduct);
router.put('/:id', requirePermission('Products', 'update'), validate(productSchema), ProductController.updateProduct);
router.delete('/:id', requirePermission('Products', 'delete'), ProductController.deleteProduct);

module.exports = router;
