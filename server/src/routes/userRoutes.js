const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, enforceStoreScope } = require('../middleware/rbac');

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/', requirePermission('UserManagement', 'read'), UserController.getUsers);
router.put('/:id/status', requirePermission('UserManagement', 'update'), UserController.updateUserStatus);
router.put('/:id/roles', requirePermission('UserManagement', 'update'), UserController.assignRoleToUser);

router.get('/meta/roles', requirePermission('UserManagement', 'read'), UserController.getRoles);
router.get('/meta/permissions', requirePermission('UserManagement', 'read'), UserController.getPermissions);
router.post('/meta/roles', requirePermission('UserManagement', 'create'), UserController.createRole);

module.exports = router;
