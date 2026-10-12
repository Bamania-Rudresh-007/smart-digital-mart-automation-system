import express from 'express';
const router = express.Router();
import UserController from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, enforceStoreScope } from '../middleware/rbac.js';

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/', requirePermission('UserManagement', 'read'), UserController.getUsers);
router.put('/:id/status', requirePermission('UserManagement', 'update'), UserController.updateUserStatus);
router.put('/:id/roles', requirePermission('UserManagement', 'update'), UserController.assignRoleToUser);

router.get('/meta/roles', requirePermission('UserManagement', 'read'), UserController.getRoles);
router.get('/meta/permissions', requirePermission('UserManagement', 'read'), UserController.getPermissions);
router.post('/meta/roles', requirePermission('UserManagement', 'create'), UserController.createRole);

export default router;
