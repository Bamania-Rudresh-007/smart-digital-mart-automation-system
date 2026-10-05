const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const batchRoutes = require('./batchRoutes');
const supplierRoutes = require('./supplierRoutes');
const purchaseRoutes = require('./purchaseRoutes');
const salesRoutes = require('./salesRoutes');
const alertRoutes = require('./alertRoutes');
const reportRoutes = require('./reportRoutes');
const userRoutes = require('./userRoutes');
const auditRoutes = require('./auditRoutes');

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

module.exports = router;
