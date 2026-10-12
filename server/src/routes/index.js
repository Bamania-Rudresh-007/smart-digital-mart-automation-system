import express from 'express';
const router = express.Router();

import authRoutes from './authRoutes.js';
import productRoutes from './productRoutes.js';
import batchRoutes from './batchRoutes.js';
import supplierRoutes from './supplierRoutes.js';
import purchaseRoutes from './purchaseRoutes.js';
import salesRoutes from './salesRoutes.js';
import alertRoutes from './alertRoutes.js';
import reportRoutes from './reportRoutes.js';
import userRoutes from './userRoutes.js';
import auditRoutes from './auditRoutes.js';

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/batches', batchRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/sales', salesRoutes);
router.use('/alerts', alertRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/audits', auditRoutes);

export default router;
