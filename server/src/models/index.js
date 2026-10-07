const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Store
const Store = sequelize.define('Store', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNullable: false },
  address: { type: DataTypes.TEXT },
  contact_info: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, { tableName: 'stores' });

// Role
const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  role_name: { type: DataTypes.STRING, unique: true, allowNullable: false },
  description: { type: DataTypes.STRING },
  is_custom: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'roles' });

// Permission
const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  module: { type: DataTypes.STRING, allowNullable: false }, // Products, PurchaseOrders, Sales, Reports, Users, etc.
  action: { type: DataTypes.STRING, allowNullable: false } // create, read, update, delete, approve
}, { tableName: 'permissions' });

// User
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNullable: false },
  email: { type: DataTypes.STRING, unique: true, allowNullable: false },
  phone: { type: DataTypes.STRING },
  password_hash: { type: DataTypes.STRING, allowNullable: false },
  store_id: { type: DataTypes.INTEGER, allowNullable: true },
  status: { type: DataTypes.ENUM('pending', 'active', 'disabled'), defaultValue: 'pending' }
}, { tableName: 'users' });

// UserRoles (Junction)
const UserRole = sequelize.define('UserRole', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }
}, { tableName: 'user_roles' });

// RolePermissions (Junction)
const RolePermission = sequelize.define('RolePermission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }
}, { tableName: 'role_permissions' });

// Category
const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNullable: false },
  parent_category_id: { type: DataTypes.INTEGER, allowNullable: true }
}, { tableName: 'categories' });

// UnitOfMeasure
const UnitOfMeasure = sequelize.define('UnitOfMeasure', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNullable: false },
  symbol: { type: DataTypes.STRING, allowNullable: false }
}, { tableName: 'units_of_measure' });

// Product
const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sku: { type: DataTypes.STRING, allowNullable: false },
  name: { type: DataTypes.STRING, allowNullable: false },
  category_id: { type: DataTypes.INTEGER, allowNullable: false },
  unit_of_measure_id: { type: DataTypes.INTEGER, allowNullable: true },
  reorder_threshold: { type: DataTypes.INTEGER, defaultValue: 10 },
  max_stock_level: { type: DataTypes.INTEGER, defaultValue: 100 },
  store_id: { type: DataTypes.INTEGER, allowNullable: false }
}, { tableName: 'products' });

// Supplier
const Supplier = sequelize.define('Supplier', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNullable: false },
  contact: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT },
  gst_no: { type: DataTypes.STRING }
}, { tableName: 'suppliers' });

// Batch
const Batch = sequelize.define('Batch', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNullable: false },
  batch_number: { type: DataTypes.STRING, allowNullable: false },
  mfg_date: { type: DataTypes.DATEONLY },
  expiry_date: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  purchase_price: { type: DataTypes.DECIMAL(12, 2), allowNullable: false },
  selling_price: { type: DataTypes.DECIMAL(12, 2), allowNullable: false },
  qty_received: { type: DataTypes.INTEGER, allowNullable: false },
  qty_remaining: { type: DataTypes.INTEGER, allowNullable: false },
  supplier_id: { type: DataTypes.INTEGER, allowNullable: true },
  expiry_status: { 
    type: DataTypes.ENUM('Healthy', 'Near Expiry', 'Expired'), 
    defaultValue: 'Healthy' 
  }
}, { tableName: 'batches' });

// Purchase Order
const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  po_number: { type: DataTypes.STRING, unique: true, allowNullable: false },
  supplier_id: { type: DataTypes.INTEGER, allowNullable: false },
  store_id: { type: DataTypes.INTEGER, allowNullable: false },
  status: { 
    type: DataTypes.ENUM('Draft', 'Sent', 'Partially Received', 'Fully Received', 'Matched', 'Discrepancy', 'Approved', 'Rejected'), 
    defaultValue: 'Draft' 
  },
  created_by: { type: DataTypes.INTEGER, allowNullable: false },
  is_auto_generated: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'purchase_orders' });

// PO Item
const POItem = sequelize.define('POItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  po_id: { type: DataTypes.INTEGER, allowNullable: false },
  product_id: { type: DataTypes.INTEGER, allowNullable: false },
  ordered_qty: { type: DataTypes.INTEGER, allowNullable: false },
  agreed_unit_price: { type: DataTypes.DECIMAL(12, 2), allowNullable: false }
}, { tableName: 'po_items' });

// Goods Receipt (GRN)
const GoodsReceipt = sequelize.define('GoodsReceipt', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  grn_number: { type: DataTypes.STRING, unique: true, allowNullable: false },
  po_id: { type: DataTypes.INTEGER, allowNullable: false },
  received_by: { type: DataTypes.INTEGER, allowNullable: false },
  received_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'goods_receipts' });

// GRN Item
const GRNItem = sequelize.define('GRNItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  grn_id: { type: DataTypes.INTEGER, allowNullable: false },
  product_id: { type: DataTypes.INTEGER, allowNullable: false },
  batch_id: { type: DataTypes.INTEGER, allowNullable: true },
  received_qty: { type: DataTypes.INTEGER, allowNullable: false }
}, { tableName: 'grn_items' });

// Vendor Invoice
const VendorInvoice = sequelize.define('VendorInvoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  po_id: { type: DataTypes.INTEGER, allowNullable: false },
  invoice_number: { type: DataTypes.STRING, allowNullable: false },
  invoice_amount: { type: DataTypes.DECIMAL(12, 2), allowNullable: false },
  invoice_date: { type: DataTypes.DATEONLY, allowNullable: false },
  file_url: { type: DataTypes.STRING, allowNullable: true }
}, { tableName: 'vendor_invoices' });

// Invoice Item
const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER, allowNullable: false },
  product_id: { type: DataTypes.INTEGER, allowNullable: false },
  billed_qty: { type: DataTypes.INTEGER, allowNullable: false },
  billed_unit_price: { type: DataTypes.DECIMAL(12, 2), allowNullable: false }
}, { tableName: 'invoice_items' });

// Purchase Match (3-Way Matching Result)
const PurchaseMatch = sequelize.define('PurchaseMatch', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  po_id: { type: DataTypes.INTEGER, allowNullable: false },
  match_status: { type: DataTypes.ENUM('Matched', 'Discrepancy', 'Override_Approved'), allowNullable: false },
  remarks: { type: DataTypes.TEXT },
  resolved_by: { type: DataTypes.INTEGER, allowNullable: true }
}, { tableName: 'purchase_matches' });

// Sale
const Sale = sequelize.define('Sale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_no: { type: DataTypes.STRING, unique: true, allowNullable: false },
  store_id: { type: DataTypes.INTEGER, allowNullable: false },
  cashier_id: { type: DataTypes.INTEGER, allowNullable: false },
  total_amount: { type: DataTypes.DECIMAL(12, 2), allowNullable: false },
  discount_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  net_amount: { type: DataTypes.DECIMAL(12, 2), allowNullable: false },
  payment_mode: { type: DataTypes.ENUM('CASH', 'CARD', 'UPI', 'MIXED'), defaultValue: 'CASH' },
  sale_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'sales' });

// Sale Item
const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sale_id: { type: DataTypes.INTEGER, allowNullable: false },
  product_id: { type: DataTypes.INTEGER, allowNullable: false },
  batch_id: { type: DataTypes.INTEGER, allowNullable: false },
  qty_sold: { type: DataTypes.INTEGER, allowNullable: false },
  unit_selling_price: { type: DataTypes.DECIMAL(12, 2), allowNullable: false },
  unit_cost_price: { type: DataTypes.DECIMAL(12, 2), allowNullable: false }
}, { tableName: 'sale_items' });

// Stock Ledger (Immutable record of stock events)
const StockLedger = sequelize.define('StockLedger', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNullable: false },
  batch_id: { type: DataTypes.INTEGER, allowNullable: false },
  store_id: { type: DataTypes.INTEGER, allowNullable: false },
  txn_type: { 
    type: DataTypes.ENUM('purchase', 'sale', 'adjustment', 'transfer', 'damage', 'return'), 
    allowNullable: false 
  },
  qty: { type: DataTypes.INTEGER, allowNullable: false }, // positive for addition, negative for deduction
  balance_after: { type: DataTypes.INTEGER, allowNullable: false },
  ref_id: { type: DataTypes.STRING, allowNullable: true }, // Sale ID, PO ID, GRN ID, etc.
  notes: { type: DataTypes.STRING }
}, { tableName: 'stock_ledger', updatedAt: false });

// Alerts
const Alert = sequelize.define('Alert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  store_id: { type: DataTypes.INTEGER, allowNullable: false },
  type: { type: DataTypes.ENUM('expiry', 'low_stock', 'discrepancy'), allowNullable: false },
  reference_id: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT, allowNullable: false },
  status: { type: DataTypes.ENUM('new', 'read', 'resolved'), defaultValue: 'new' },
  sent_channels: { type: DataTypes.STRING }
}, { tableName: 'alerts' });

// Alert Rules
const AlertRule = sequelize.define('AlertRule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  store_id: { type: DataTypes.INTEGER, allowNullable: false },
  alert_type: { type: DataTypes.STRING, allowNullable: false },
  recipient_emails: { type: DataTypes.STRING },
  notification_channels: { type: DataTypes.STRING, defaultValue: 'in-app,email' }
}, { tableName: 'alert_rules' });

// Notifications
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNullable: false },
  title: { type: DataTypes.STRING, allowNullable: false },
  message: { type: DataTypes.TEXT, allowNullable: false },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  type: { type: DataTypes.STRING, defaultValue: 'info' },
  link: { type: DataTypes.STRING }
}, { tableName: 'notifications' });

// Refresh Token
const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNullable: false },
  token: { type: DataTypes.STRING(500), allowNullable: false },
  expires_at: { type: DataTypes.DATE, allowNullable: false }
}, { tableName: 'refresh_tokens' });

// Password Reset
const PasswordReset = sequelize.define('PasswordReset', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNullable: false },
  token: { type: DataTypes.STRING, allowNullable: false },
  expires_at: { type: DataTypes.DATE, allowNullable: false },
  used: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'password_resets' });

// Audit Logs
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNullable: true },
  action: { type: DataTypes.STRING, allowNullable: false }, // CREATE, UPDATE, DELETE, LOGIN, APPROVE, OVERRIDE
  table_name: { type: DataTypes.STRING, allowNullable: false },
  record_id: { type: DataTypes.STRING, allowNullable: true },
  old_value: { type: DataTypes.TEXT }, // JSON
  new_value: { type: DataTypes.TEXT }  // JSON
}, { tableName: 'audit_logs', updatedAt: false });

// Associations
// User <-> Store
User.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
Store.hasMany(User, { foreignKey: 'store_id', as: 'users' });

// User <-> Role (Many to Many)
User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id', as: 'roles' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id', as: 'users' });

// Role <-> Permission (Many to Many)
Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', as: 'permissions' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', as: 'roles' });

// Category Self Reference
Category.belongsTo(Category, { foreignKey: 'parent_category_id', as: 'parentCategory' });
Category.hasMany(Category, { foreignKey: 'parent_category_id', as: 'subCategories' });

// Product Associations
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Product.belongsTo(UnitOfMeasure, { foreignKey: 'unit_of_measure_id', as: 'unitOfMeasure' });
Product.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
Product.hasMany(Batch, { foreignKey: 'product_id', as: 'batches' });

// Batch Associations
Batch.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Batch.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

// Purchase Order Associations
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
PurchaseOrder.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
PurchaseOrder.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
PurchaseOrder.hasMany(POItem, { foreignKey: 'po_id', as: 'items' });
PurchaseOrder.hasMany(GoodsReceipt, { foreignKey: 'po_id', as: 'goodsReceipts' });
PurchaseOrder.hasMany(VendorInvoice, { foreignKey: 'po_id', as: 'vendorInvoices' });
PurchaseOrder.hasOne(PurchaseMatch, { foreignKey: 'po_id', as: 'match' });

POItem.belongsTo(PurchaseOrder, { foreignKey: 'po_id' });
POItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// GRN Associations
GoodsReceipt.belongsTo(PurchaseOrder, { foreignKey: 'po_id' });
GoodsReceipt.belongsTo(User, { foreignKey: 'received_by', as: 'receiver' });
GoodsReceipt.hasMany(GRNItem, { foreignKey: 'grn_id', as: 'items' });
GRNItem.belongsTo(GoodsReceipt, { foreignKey: 'grn_id' });
GRNItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
GRNItem.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });

// Vendor Invoice Associations
VendorInvoice.belongsTo(PurchaseOrder, { foreignKey: 'po_id' });
VendorInvoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', as: 'items' });
InvoiceItem.belongsTo(VendorInvoice, { foreignKey: 'invoice_id' });
InvoiceItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Sales Associations
Sale.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
Sale.belongsTo(User, { foreignKey: 'cashier_id', as: 'cashier' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
SaleItem.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });

// Stock Ledger Associations
StockLedger.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
StockLedger.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });
StockLedger.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// Refresh Token
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  Store,
  Role,
  Permission,
  User,
  UserRole,
  RolePermission,
  Category,
  UnitOfMeasure,
  Product,
  Supplier,
  Batch,
  PurchaseOrder,
  POItem,
  GoodsReceipt,
  GRNItem,
  VendorInvoice,
  InvoiceItem,
  PurchaseMatch,
  Sale,
  SaleItem,
  StockLedger,
  Alert,
  AlertRule,
  Notification,
  RefreshToken,
  PasswordReset,
  AuditLog
};
