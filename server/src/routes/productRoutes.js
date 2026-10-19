import express from 'express';
const router = express.Router();
import ProductController from '../controllers/productController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, enforceStoreScope } from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { productSchema } from '../validators/productSchemas.js';

router.get('/meta/stores', ProductController.getStores);

router.use(authenticate);
router.use(enforceStoreScope);

// Products
router.get('/', requirePermission('Products', 'read'), ProductController.getProducts);
router.get('/meta/categories', ProductController.getCategories);
router.get('/meta/uoms', ProductController.getUnitsOfMeasure);
router.get('/:id', requirePermission('Products', 'read'), ProductController.getProductById);
router.post('/', requirePermission('Products', 'create'), validate(productSchema), ProductController.createProduct);
router.put('/:id', requirePermission('Products', 'update'), validate(productSchema), ProductController.updateProduct);
router.delete('/:id', requirePermission('Products', 'delete'), ProductController.deleteProduct);

export default router;
