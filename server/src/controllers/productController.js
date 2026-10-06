const crypto = require('crypto');
const { sequelize, Product, Category, UnitOfMeasure, Store, Batch, StockLedger } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const AuditService = require('../services/auditService');
const ExpiryEngine = require('../services/expiryEngine');
const { Op } = require('sequelize');

class ProductController {
  // --- PRODUCTS ---
  static async getProducts(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = (page - 1) * limit;
      const { search, category_id, store_id } = req.query;

      const where = {};
      if (req.targetStoreId) {
        where.store_id = req.targetStoreId;
      } else if (store_id) {
        where.store_id = store_id;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } }
        ];
      }

      if (category_id) {
        where.category_id = category_id;
      }

      const { count, rows } = await Product.findAndCountAll({
        where,
        limit,
        offset,
        include: [
          { model: Category, as: 'category' },
          { model: UnitOfMeasure, as: 'unitOfMeasure' },
          { model: Store, as: 'store' },
          { model: Batch, as: 'batches' }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Calculate aggregated current stock per product
      const todayStr = new Date().toISOString().split('T')[0];
      const productsWithStock = rows.map(p => {
        const productJson = p.toJSON();
        const activeBatches = (p.batches || [])
          .filter(b =>
            Number(b.qty_remaining) > 0 &&
            b.expiry_status !== 'Expired' &&
            (!b.expiry_date || b.expiry_date >= todayStr)
          )
          .sort((a, b) => {
            if (!a.expiry_date) return b.expiry_date ? 1 : 0;
            if (!b.expiry_date) return -1;
            return a.expiry_date.localeCompare(b.expiry_date);
          });
        const activeStock = activeBatches
          .reduce((sum, b) => sum + b.qty_remaining, 0);
        productJson.current_stock = activeStock;
        productJson.next_expiry_date = activeBatches.find(b => b.expiry_date)?.expiry_date || null;
        productJson.selling_price = activeBatches[0]?.selling_price || null;
        return productJson;
      });

      return ApiResponse.paginated(res, 'Products fetched successfully', productsWithStock, page, limit, count);
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req, res, next) {
    try {
      const product = await Product.findByPk(req.params.id, {
        include: [
          { model: Category, as: 'category' },
          { model: UnitOfMeasure, as: 'unitOfMeasure' },
          { model: Store, as: 'store' },
          { model: Batch, as: 'batches' }
        ]
      });

      if (!product) return ApiResponse.error(res, 'Product not found', 404);
      return ApiResponse.success(res, 'Product details', product);
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req, res, next) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const storeId = req.targetStoreId || req.body.store_id || req.user.store_id;
      if (!storeId) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Store ID is required', 400);
      }
      if (req.body.dummyjson_id) {
        const existingSample = await Product.findOne({
          where: { store_id: storeId, dummyjson_id: req.body.dummyjson_id },
          transaction
        });
        if (existingSample) {
          await transaction.rollback();
          return ApiResponse.success(res, 'This sample product is already in the store catalog', existingSample);
        }
      }

      const {
        name,
        dummyjson_id,
        category_id,
        category_name,
        unit_of_measure_id,
        reorder_threshold,
        max_stock_level,
        initial_batch: initialBatch
      } = req.body;
      let resolvedCategoryId = category_id;
      if (!resolvedCategoryId && category_name) {
        const [category] = await Category.findOrCreate({
          where: { name: category_name },
          defaults: { name: category_name },
          transaction
        });
        resolvedCategoryId = category.id;
      }
      const product = await Product.create({
        sku: `SKU-PENDING-${crypto.randomUUID()}`,
        dummyjson_id: dummyjson_id || null,
        name,
        category_id: resolvedCategoryId,
        unit_of_measure_id: unit_of_measure_id || null,
        reorder_threshold,
        max_stock_level,
        store_id: storeId
      }, { transaction });

      const skuBase = `SKU-${String(product.id).padStart(6, '0')}`;
      let sku = skuBase;
      let suffix = 1;
      while (await Product.findOne({
        where: { sku, id: { [Op.ne]: product.id } },
        transaction
      })) {
        sku = `${skuBase}-${suffix}`;
        suffix += 1;
      }
      await product.update({ sku }, { transaction });

      if (initialBatch) {
        const batchNumber = initialBatch.batch_number ||
          `B-${sku}-${Date.now().toString(36).toUpperCase()}`;
        const { status: expiry_status } = ExpiryEngine.classifyExpiry(initialBatch.expiry_date);
        const batch = await Batch.create({
          product_id: product.id,
          batch_number: batchNumber,
          mfg_date: initialBatch.mfg_date || null,
          expiry_date: initialBatch.expiry_date,
          purchase_price: initialBatch.purchase_price,
          selling_price: initialBatch.selling_price,
          qty_received: initialBatch.qty_received,
          qty_remaining: initialBatch.qty_received,
          supplier_id: initialBatch.supplier_id || null,
          expiry_status
        }, { transaction });

        await StockLedger.create({
          product_id: product.id,
          batch_id: batch.id,
          store_id: storeId,
          txn_type: 'purchase',
          qty: batch.qty_received,
          balance_after: batch.qty_remaining,
          ref_id: `OPENING-BATCH-${batch.id}`,
          notes: 'Opening inventory on product creation'
        }, { transaction });
      }

      await transaction.commit();

      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE',
        tableName: 'products',
        recordId: product.id,
        newValue: product.toJSON()
      });

      return ApiResponse.success(res, 'Product created successfully', product, 201);
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      next(error);
    }
  }

  static async updateProduct(req, res, next) {
    try {
      const product = await Product.findByPk(req.params.id);
      if (!product) return ApiResponse.error(res, 'Product not found', 404);

      const oldVal = product.toJSON();
      await product.update(req.body);

      await AuditService.logAction({
        userId: req.user.id,
        action: 'UPDATE',
        tableName: 'products',
        recordId: product.id,
        oldValue: oldVal,
        newValue: product.toJSON()
      });

      return ApiResponse.success(res, 'Product updated successfully', product);
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req, res, next) {
    try {
      const product = await Product.findByPk(req.params.id);
      if (!product) return ApiResponse.error(res, 'Product not found', 404);

      const oldVal = product.toJSON();
      await product.destroy();

      await AuditService.logAction({
        userId: req.user.id,
        action: 'DELETE',
        tableName: 'products',
        recordId: req.params.id,
        oldValue: oldVal
      });

      return ApiResponse.success(res, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // --- CATEGORIES ---
  static async getCategories(req, res, next) {
    try {
      const categories = await Category.findAll({
        include: [
          { model: Category, as: 'parentCategory' },
          { model: Category, as: 'subCategories' }
        ]
      });
      return ApiResponse.success(res, 'Categories list', categories);
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req, res, next) {
    try {
      const category = await Category.create(req.body);
      return ApiResponse.success(res, 'Category created', category, 201);
    } catch (error) {
      next(error);
    }
  }

  // --- UNITS OF MEASURE ---
  static async getUnitsOfMeasure(req, res, next) {
    try {
      const uoms = await UnitOfMeasure.findAll();
      return ApiResponse.success(res, 'Units of Measure list', uoms);
    } catch (error) {
      next(error);
    }
  }

  // --- STORES ---
  static async getStores(req, res, next) {
    try {
      const stores = await Store.findAll();
      return ApiResponse.success(res, 'Stores list', stores);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProductController;
