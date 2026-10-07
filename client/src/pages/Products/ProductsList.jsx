import React, { useEffect, useState } from 'react';
import {
  Boxes, Clock3, FolderTree, Package, Pencil, Plus, Search, Trash2
} from 'lucide-react';
import { useSelector } from 'react-redux';
import Badge from '../../components/Common/Badge';
import Modal from '../../components/Common/Modal';
import api from '../../services/api';

const EMPTY_FORM = {
  name: '',
  category_id: '',
  unit_of_measure_id: '',
  reorder_threshold: 10,
  max_stock_level: 100,
  add_initial_batch: false,
  has_expiry: true,
  batch_number: '',
  mfg_date: '',
  expiry_date: '',
  purchase_price: '',
  selling_price: '',
  qty_received: '',
  supplier_id: ''
};

const inputClassName = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800';

const ProductsList = () => {
  const user = useSelector(state => state.auth.user);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedCat) params.set('category_id', selectedCat);
      const query = params.toString();
      const response = await api.get(`/products${query ? `?${query}` : ''}`);
      if (!response.data.success) throw new Error('The product catalog could not be loaded.');
      setProducts(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [categoryResponse, uomResponse] = await Promise.all([
        api.get('/products/meta/categories'),
        api.get('/products/meta/uoms')
      ]);
      setCategories(categoryResponse.data.data || []);
      setUoms(uomResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load product categories and units.');
    }

    try {
      const supplierResponse = await api.get('/suppliers');
      setSuppliers(supplierResponse.data.data || []);
    } catch (err) {
      console.warn('Supplier list unavailable for the opening-stock form.', err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCat]);

  useEffect(() => {
    fetchMeta();
  }, []);

  const updateForm = (field, value) => {
    setFormData(current => ({ ...current, [field]: value }));
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      ...EMPTY_FORM,
      name: product.name || '',
      category_id: String(product.category_id || ''),
      unit_of_measure_id: product.unit_of_measure_id ? String(product.unit_of_measure_id) : '',
      reorder_threshold: product.reorder_threshold ?? 10,
      max_stock_level: product.max_stock_level ?? 100
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    const payload = {
      name: formData.name.trim(),
      category_id: Number(formData.category_id),
      unit_of_measure_id: formData.unit_of_measure_id ? Number(formData.unit_of_measure_id) : null,
      reorder_threshold: Number(formData.reorder_threshold),
      max_stock_level: Number(formData.max_stock_level)
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        payload.store_id = user?.store?.id;
        if (formData.add_initial_batch) {
          payload.initial_batch = {
            batch_number: formData.batch_number.trim(),
            mfg_date: formData.mfg_date || null,
            expiry_date: formData.has_expiry ? formData.expiry_date : null,
            purchase_price: Number(formData.purchase_price),
            selling_price: Number(formData.selling_price),
            qty_received: Number(formData.qty_received),
            supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null
          };
        }
        await api.post('/products', payload);
      }
      closeModal();
      await fetchProducts();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Unable to save the product.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}" from the product catalog?`)) return;

    setError('');
    try {
      await api.delete(`/products/${product.id}`);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to delete the product.');
    }
  };

  const parentCategories = categories.filter(category => !category.parent_category_id);
  const lowStockCount = products.filter(product =>
    Number(product.current_stock) <= Number(product.reorder_threshold)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Products & Categories</h2>
          <p className="mt-1 text-xs text-slate-500">A clear view of your store catalog, stock levels, and product groups.</p>
        </div>
        {activeTab === 'products' && (
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'products', label: 'Products', icon: Package },
          { id: 'categories', label: 'Categories', icon: FolderTree }
        ].map(tab => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${
                selected
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              aria-current={selected ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'products' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Package className="h-4 w-4 text-blue-600" /> Products shown</div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{products.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><FolderTree className="h-4 w-4 text-violet-600" /> Catalog categories</div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{categories.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Boxes className="h-4 w-4 text-amber-600" /> Low stock</div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{lowStockCount}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search product name or SKU"
                aria-label="Search products"
                className={`${inputClassName} pl-9`}
              />
            </div>
            <select
              value={selectedCat}
              onChange={event => setSelectedCat(event.target.value)}
              aria-label="Filter by category"
              className={`${inputClassName} sm:w-64`}
            >
              <option value="">All categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Unit</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Active stock</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading products…</td></tr>
                  ) : products.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-400">No products found. Add a product to get started.</td></tr>
                  ) : products.map(product => {
                    const isLow = Number(product.current_stock) <= Number(product.reorder_threshold);
                    return (
                      <tr key={product.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">{product.sku}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{product.name}</td>
                        <td className="p-4 text-slate-500">{product.category?.name || 'Uncategorized'}</td>
                        <td className="p-4 text-slate-500">{product.unitOfMeasure?.symbol || 'Pcs'}</td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                          {product.selling_price == null ? '—' : `₹${Number(product.selling_price).toFixed(2)}`}
                        </td>
                        <td className="p-4 font-extrabold text-slate-900 dark:text-white">{product.current_stock}</td>
                        <td className="p-4">
                          {isLow ? <Badge variant="warning">Low stock</Badge> : <Badge variant="success">In stock</Badge>}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openEditModal(product)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                              aria-label={`Edit ${product.name}`}
                              title="Edit product"
                            ><Pencil className="h-4 w-4" /></button>
                            <button
                              onClick={() => deleteProduct(product)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800"
                              aria-label={`Delete ${product.name}`}
                              title="Delete product"
                            ><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Store categories</h3>
            <p className="mt-1 text-xs text-slate-500">Browse the seeded product groups used throughout the catalog.</p>
          </div>
          {parentCategories.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              No categories are available yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {parentCategories.map(category => {
                const children = categories.filter(child =>
                  Number(child.parent_category_id) === Number(category.id)
                );
                return (
                  <article key={category.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/50">
                        <FolderTree className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{category.name}</h4>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {children.length} {children.length === 1 ? 'subcategory' : 'subcategories'}
                        </p>
                      </div>
                    </div>
                    {children.length > 0 ? (
                      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        {children.map(child => (
                          <li key={child.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            {child.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
                        Products are assigned directly to this category.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {formError}
            </div>
          )}
          <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            {editingProduct
              ? 'Update the product details below. Existing batch and stock records remain unchanged.'
              : 'The product SKU is assigned automatically. Add an opening batch now or record stock later.'}
          </p>
          {editingProduct && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Product ID / SKU</label>
              <input value={editingProduct.sku} readOnly className={`${inputClassName} cursor-not-allowed text-slate-500`} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Product name</label>
            <input
              required
              value={formData.name}
              onChange={event => updateForm('name', event.target.value)}
              placeholder="e.g. Whole milk, 1 litre"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Category</label>
              <select
                required
                value={formData.category_id}
                onChange={event => updateForm('category_id', event.target.value)}
                className={inputClassName}
              >
                <option value="">Select category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Unit of measure</label>
              <select
                value={formData.unit_of_measure_id}
                onChange={event => updateForm('unit_of_measure_id', event.target.value)}
                className={inputClassName}
              >
                <option value="">Select unit</option>
                {uoms.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              Reorder threshold
              <input
                type="number"
                min="0"
                value={formData.reorder_threshold}
                onChange={event => updateForm('reorder_threshold', event.target.value)}
                className={`${inputClassName} mt-1 font-normal normal-case`}
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              Max stock target
              <input
                type="number"
                min="1"
                value={formData.max_stock_level}
                onChange={event => updateForm('max_stock_level', event.target.value)}
                className={`${inputClassName} mt-1 font-normal normal-case`}
              />
            </label>
          </div>

          {!editingProduct && (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.add_initial_batch}
                  onChange={event => updateForm('add_initial_batch', event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="block text-xs font-bold text-slate-800 dark:text-white">Add opening batch and stock</span>
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">Add the first delivery and its local pricing.</span>
                </span>
              </label>

              {formData.add_initial_batch && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                    <Clock3 className="h-4 w-4 text-blue-600" /> Opening batch details
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Batch / lot number (optional)
                      <input value={formData.batch_number} onChange={event => updateForm('batch_number', event.target.value)} className={`${inputClassName} mt-1`} placeholder="Generated automatically" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Manufacturing date
                      <input type="date" value={formData.mfg_date} onChange={event => updateForm('mfg_date', event.target.value)} className={`${inputClassName} mt-1`} />
                    </label>
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.has_expiry}
                          onChange={event => updateForm('has_expiry', event.target.checked)}
                          className="h-4 w-4 accent-blue-600"
                        />
                        This batch has an expiry / best-before date
                      </label>
                      {formData.has_expiry && (
                        <input
                          type="date"
                          required
                          value={formData.expiry_date}
                          onChange={event => updateForm('expiry_date', event.target.value)}
                          className={`${inputClassName} mt-2`}
                        />
                      )}
                    </div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Opening quantity *
                      <input type="number" min="1" required value={formData.qty_received} onChange={event => updateForm('qty_received', event.target.value)} className={`${inputClassName} mt-1`} />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Purchase cost per unit *
                      <input type="number" min="0.01" step="0.01" required value={formData.purchase_price} onChange={event => updateForm('purchase_price', event.target.value)} className={`${inputClassName} mt-1`} />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Selling price per unit *
                      <input type="number" min="0.01" step="0.01" required value={formData.selling_price} onChange={event => updateForm('selling_price', event.target.value)} className={`${inputClassName} mt-1`} />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Supplier (optional)
                      <select value={formData.supplier_id} onChange={event => updateForm('supplier_id', event.target.value)} className={`${inputClassName} mt-1`}>
                        <option value="">Select supplier</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default ProductsList;
