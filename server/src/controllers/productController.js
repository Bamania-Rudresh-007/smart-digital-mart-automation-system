const { Product, Category, UnitOfMeasure, Store, Batch } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const AuditService = require('../services/auditService');
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
        const activeStock = (p.batches || [])
          .filter(b => b.expiry_status !== 'Expired' && b.expiry_date >= todayStr)
          .reduce((sum, b) => sum + b.qty_remaining, 0);
        productJson.current_stock = activeStock;
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
    try {
      const storeId = req.targetStoreId || req.body.store_id;
      if (!storeId) {
        return ApiResponse.error(res, 'Store ID is required', 400);
      }

      const product = await Product.create({
        ...req.body,
        store_id: storeId
      });

      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE',
        tableName: 'products',
        recordId: product.id,
        newValue: product.toJSON()
      });

      return ApiResponse.success(res, 'Product created successfully', product, 201);
    } catch (error) {
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
