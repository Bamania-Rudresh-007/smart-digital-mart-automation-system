const { Supplier } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const AuditService = require('../services/auditService');

class SupplierController {
  static async getSuppliers(req, res, next) {
    try {
      const suppliers = await Supplier.findAll({ order: [['name', 'ASC']] });
      return ApiResponse.success(res, 'Suppliers list', suppliers);
    } catch (error) {
      next(error);
    }
  }

  static async createSupplier(req, res, next) {
    try {
      const supplier = await Supplier.create(req.body);
      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE',
        tableName: 'suppliers',
        recordId: supplier.id,
        newValue: supplier.toJSON()
      });
      return ApiResponse.success(res, 'Supplier created', supplier, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SupplierController;
