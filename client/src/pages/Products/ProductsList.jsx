import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, ChevronLeft, ChevronRight, RefreshCw, ShoppingBag, Clock3 } from 'lucide-react';
import Modal from '../../components/Common/Modal';
import Badge from '../../components/Common/Badge';
import api from '../../services/api';
import { useSelector } from 'react-redux';

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
const SAMPLE_PAGE_SIZE = 8;

const toCategoryName = (category) => category
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const ProductsList = () => {
  const user = useSelector(state => state.auth.user);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sampleImport, setSampleImport] = useState(null);
  const [sampleExistingProduct, setSampleExistingProduct] = useState(null);
  const [sampleCategoryName, setSampleCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [sampleProducts, setSampleProducts] = useState([]);
  const [sampleTotal, setSampleTotal] = useState(0);
  const [sampleSkip, setSampleSkip] = useState(0);
  const [sampleQuery, setSampleQuery] = useState('');
  const [sampleSearchInput, setSampleSearchInput] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchMeta();
  }, [search, selectedCat]);

  useEffect(() => {
    fetchSampleProducts();
  }, [sampleQuery, sampleSkip]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/products?search=${search}`;
      if (selectedCat) url += `&category_id=${selectedCat}`;
      const res = await api.get(url);
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [catRes, uomRes] = await Promise.all([
        api.get('/products/meta/categories'),
        api.get('/products/meta/uoms')
      ]);
      setCategories(catRes.data.data || []);
      setUoms(uomRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
    try {
      const supplierRes = await api.get('/suppliers');
      setSuppliers(supplierRes.data.data || []);
    } catch (err) {
      console.warn('Optional supplier list unavailable for opening batch form.', err);
    }
  };

  const fetchSampleProducts = async () => {
    setSampleLoading(true);
    setSampleError('');
    try {
      const query = sampleQuery
        ? `/products/search?q=${encodeURIComponent(sampleQuery)}&limit=${SAMPLE_PAGE_SIZE}&skip=${sampleSkip}&select=id,title,description,category,price,thumbnail,brand`
        : `/products?limit=${SAMPLE_PAGE_SIZE}&skip=${sampleSkip}&select=id,title,description,category,price,thumbnail,brand`;
      const response = await fetch(`https://dummyjson.com${query}`);
      if (!response.ok) throw new Error(`Product catalog request failed (${response.status}).`);
      const data = await response.json();
      if (!Array.isArray(data.products)) throw new Error('The sample catalog returned an invalid response.');
      setSampleProducts(data.products);
      setSampleTotal(Number(data.total) || 0);
    } catch (error) {
      setSampleError(error.message || 'Unable to load sample products.');
      setSampleProducts([]);
    } finally {
      setSampleLoading(false);
    }
  };

  const updateForm = (field, value) => {
    setFormData(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (sampleExistingProduct) {
        const batchNumber = formData.batch_number.trim() ||
          `B-${sampleExistingProduct.sku}-${Date.now().toString(36).toUpperCase()}`;
        await api.post('/batches', {
          product_id: sampleExistingProduct.id,
          batch_number: batchNumber,
          mfg_date: formData.mfg_date || null,
          expiry_date: formData.has_expiry ? formData.expiry_date : null,
          purchase_price: Number(formData.purchase_price),
          selling_price: Number(formData.selling_price),
          qty_received: Number(formData.qty_received),
          supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null
        });
      } else {
        const payload = {
          name: formData.name.trim(),
          dummyjson_id: sampleImport?.id,
          unit_of_measure_id: formData.unit_of_measure_id ? Number(formData.unit_of_measure_id) : null,
          reorder_threshold: Number(formData.reorder_threshold),
          max_stock_level: Number(formData.max_stock_level),
          store_id: user?.store?.id
        };
        if (formData.category_id) {
          payload.category_id = Number(formData.category_id);
        } else if (sampleCategoryName) {
          payload.category_name = sampleCategoryName;
        } else {
          throw new Error('Select a product category.');
        }
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
      setIsModalOpen(false);
      setSampleImport(null);
      setSampleExistingProduct(null);
      setSampleCategoryName('');
      setFormData(EMPTY_FORM);
      await fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const addSampleToInventory = async (sample) => {
    const categoryName = toCategoryName(sample.category || 'Other');
    const category = categories.find(item => item.name.toLowerCase() === categoryName.toLowerCase());
    const existingProduct = products.find(product =>
      product.dummyjson_id === sample.id ||
      product.name.toLowerCase() === sample.title.toLowerCase()
    );
    const expiryTracked = /food|drink|beverage|grocery|beauty|skin|health|medicine|fragrance/i.test(
      `${sample.category || ''} ${sample.title || ''}`
    );

    setSampleImport(sample);
    setSampleExistingProduct(existingProduct || null);
    setSampleCategoryName(category || existingProduct ? '' : categoryName);
    setFormData({
      ...EMPTY_FORM,
      name: sample.title,
      category_id: existingProduct
        ? String(existingProduct.category_id)
        : category ? String(category.id) : '',
      add_initial_batch: true,
      has_expiry: expiryTracked,
      selling_price: '',
      reorder_threshold: 10,
      max_stock_level: 100
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Product Catalog & Master</h2>
          <p className="text-xs text-slate-500">Manage products, automatically assigned SKUs, and batch-level stock</p>
        </div>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setIsModalOpen(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              Product samples
            </h3>
            <p className="text-xs text-slate-500">Live demo listings from DummyJSON. Add a sample to your own catalog when useful.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSampleSkip(0);
              setSampleQuery(sampleSearchInput.trim());
            }}
            className="flex gap-2"
          >
            <input
              value={sampleSearchInput}
              onChange={event => setSampleSearchInput(event.target.value)}
              placeholder="Search sample products"
              aria-label="Search sample products"
              className="min-w-0 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
            <button className="px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold">
              Search
            </button>
          </form>
        </div>

        {sampleError && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
            <span>{sampleError} Check your internet connection and try again.</span>
            <button onClick={fetchSampleProducts} className="flex shrink-0 items-center gap-1 font-bold">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {sampleLoading ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
            Loading live product samples…
          </div>
        ) : sampleProducts.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {sampleProducts.map(sample => (
                <article key={sample.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="h-40 bg-slate-100 dark:bg-slate-800">
                    <img src={sample.thumbnail} alt={sample.title} loading="lazy" className="h-full w-full object-contain" />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900 dark:text-white">{sample.title}</h4>
                      <span className="shrink-0 font-bold text-emerald-600">${Number(sample.price).toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] capitalize text-slate-500">{toCategoryName(sample.category || 'Other')} {sample.brand ? `· ${sample.brand}` : ''}</p>
                    <p className="line-clamp-2 min-h-8 text-[11px] text-slate-500">{sample.description}</p>
                    <button
                      onClick={() => addSampleToInventory(sample)}
                      disabled={products.some(product =>
                        (product.dummyjson_id === sample.id ||
                          product.name.toLowerCase() === sample.title.toLowerCase()) &&
                        Number(product.current_stock) > 0
                      )}
                      className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {products.some(product =>
                        (product.dummyjson_id === sample.id ||
                          product.name.toLowerCase() === sample.title.toLowerCase()) &&
                        Number(product.current_stock) > 0
                      )
                        ? 'Already stocked'
                        : products.some(product =>
                          product.dummyjson_id === sample.id ||
                          product.name.toLowerCase() === sample.title.toLowerCase()
                        )
                          ? 'Add stock & expiry'
                          : 'Set stock & add'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {sampleSkip + 1}–{Math.min(sampleSkip + sampleProducts.length, sampleTotal)} of {sampleTotal} sample products
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSampleSkip(Math.max(0, sampleSkip - SAMPLE_PAGE_SIZE))}
                  disabled={sampleSkip === 0}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 disabled:opacity-40"
                  aria-label="Previous sample products"
                ><ChevronLeft className="h-4 w-4" /></button>
                <button
                  onClick={() => setSampleSkip(sampleSkip + SAMPLE_PAGE_SIZE)}
                  disabled={sampleSkip + SAMPLE_PAGE_SIZE >= sampleTotal}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 disabled:opacity-40"
                  aria-label="Next sample products"
                ><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </>
        ) : !sampleError ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
            No sample products found.
          </div>
        ) : null}
      </section>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
          />
        </div>
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">SKU</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">UOM</th>
                <th className="p-4">Active Stock</th>
                <th className="p-4">Reorder Threshold</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading products catalog...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No products found matching criteria.</td></tr>
              ) : (
                products.map((p) => {
                  const isLow = p.current_stock <= p.reorder_threshold;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">{p.sku}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                      <td className="p-4 text-slate-500">{p.category?.name || 'N/A'}</td>
                      <td className="p-4 text-slate-500">{p.unitOfMeasure?.symbol || 'Pcs'}</td>
                      <td className="p-4 font-extrabold text-slate-900 dark:text-white">{p.current_stock}</td>
                      <td className="p-4 text-slate-500">{p.reorder_threshold}</td>
                      <td className="p-4">
                        {isLow ? <Badge variant="warning">Low Stock Breached</Badge> : <Badge variant="success">Sufficient Stock</Badge>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSampleImport(null);
          setSampleExistingProduct(null);
          setSampleCategoryName('');
        }}
        title={sampleImport ? 'Add Sample to Store Inventory' : 'Add Product to Store'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            {sampleImport
              ? sampleExistingProduct
                ? 'This product is already in your catalog but has no active stock. Add a real batch below so it becomes available in POS and batch/expiry tracking.'
                : 'This sample becomes a real store item only after you enter your local stock and pricing. DummyJSON demo prices are in USD and are not copied into your store prices.'
              : 'Product ID and SKU are generated automatically when you save. Record each delivery as a batch so its quantity and expiry date can be tracked separately.'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Product ID / SKU</label>
              <input
                type="text"
                value="Assigned automatically on save"
                readOnly
                className="w-full cursor-not-allowed px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Product Name</label>
              <input
                type="text"
                required
                value={formData.name}
                readOnly={Boolean(sampleImport)}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="e.g. Whole milk, 1 litre"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Category</label>
              <select
                required={!sampleCategoryName}
                value={formData.category_id || (sampleCategoryName ? '__sample_category__' : '')}
                onChange={(e) => updateForm(
                  'category_id',
                  e.target.value === '__sample_category__' ? '' : e.target.value
                )}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="">Select Category</option>
                {sampleCategoryName && (
                  <option value="__sample_category__">Create “{sampleCategoryName}” category</option>
                )}
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Unit of Measure</label>
              <select
                value={formData.unit_of_measure_id}
                onChange={(e) => updateForm('unit_of_measure_id', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="">Select UOM</option>
                {uoms.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Reorder Threshold</label>
              <input
                type="number"
                min="0"
                value={formData.reorder_threshold}
                onChange={(e) => updateForm('reorder_threshold', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Max Stock Target</label>
              <input
                type="number"
                min="1"
                value={formData.max_stock_level}
                onChange={(e) => updateForm('max_stock_level', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          {!sampleImport && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <input
                type="checkbox"
                checked={formData.add_initial_batch}
                onChange={event => updateForm('add_initial_batch', event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="block text-xs font-bold text-slate-800 dark:text-white">Add opening batch and stock</span>
                <span className="block mt-1 text-[11px] text-slate-500">Food, beverages, cosmetics, and other dated goods can be expiry-tracked per batch.</span>
              </span>
            </label>
          )}

          {formData.add_initial_batch && (
            <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                <Clock3 className="h-4 w-4 text-blue-600" /> Opening batch details
              </div>
              <p className="text-[11px] text-slate-500">Batch number is generated if left blank. Enter local costs and available stock; the sample's USD price is not store inventory data.</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Batch / lot number (optional)
                  <input value={formData.batch_number} onChange={event => updateForm('batch_number', event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900" placeholder="Generated automatically" />
                </label>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Manufacturing date
                  <input type="date" value={formData.mfg_date} onChange={event => updateForm('mfg_date', event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900" />
                </label>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.has_expiry}
                      onChange={event => updateForm('has_expiry', event.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    This batch has an expiry / best-before date
                  </label>
                  {formData.has_expiry ? (
                    <input
                      type="date"
                      required
                      value={formData.expiry_date}
                      onChange={event => updateForm('expiry_date', event.target.value)}
                      className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-xs dark:bg-slate-900"
                    />
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">This non-perishable batch will be included in stock and POS but excluded from expiry alerts.</p>
                  )}
                </div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Opening quantity *
                  <input type="number" min="1" required value={formData.qty_received} onChange={event => updateForm('qty_received', event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900" placeholder="e.g. 24" />
                </label>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Purchase cost per unit *
                  <input type="number" min="0.01" step="0.01" required value={formData.purchase_price} onChange={event => updateForm('purchase_price', event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900" placeholder="0.00" />
                </label>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Selling price per unit *
                  <input type="number" min="0.01" step="0.01" required value={formData.selling_price} onChange={event => updateForm('selling_price', event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900" placeholder="0.00" />
                </label>
                <label className="col-span-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Supplier (optional)
                  <select value={formData.supplier_id} onChange={event => updateForm('supplier_id', event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="">Select supplier</option>
                    {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors mt-2"
          >
            {saving ? 'Saving product…' : 'Save Product'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default ProductsList;
