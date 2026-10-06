import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Printer, CheckCircle, Receipt, IndianRupee } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import Modal from '../../components/Common/Modal';
import api from '../../services/api';

const POSBilling = () => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [completedSale, setCompletedSale] = useState(null);
  const [isReceiptModal, setIsReceiptModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    if (searchInputRef.current) searchInputRef.current.focus();
  }, [searchQuery]);

  const fetchProducts = async () => {
    try {
      const res = await api.get(`/products?search=${searchQuery}&limit=12`);
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = (product) => {
    if (product.current_stock <= 0) {
      alert(`Cannot add "${product.name}": Out of active non-expired stock!`);
      return;
    }

    const existingIndex = cart.findIndex(i => i.product_id === product.id);
    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      if (existing.qty + 1 > product.current_stock) {
        alert(`Cannot add more: Max available non-expired stock is ${product.current_stock}`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].qty += 1;
      setCart(updated);
    } else {
      const defaultPrice = Number(product.selling_price);
      if (!Number.isFinite(defaultPrice) || defaultPrice <= 0) {
        alert(`Set a valid selling price on an active batch for "${product.name}" before billing it.`);
        return;
      }

      setCart([
        ...cart,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          unit_selling_price: defaultPrice,
          qty: 1,
          max_stock: product.current_stock
        }
      ]);
    }
  };

  const updateCartQty = (productId, delta) => {
    const updated = cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return null;
        if (newQty > item.max_stock) {
          alert(`Max available non-expired stock is ${item.max_stock}`);
          return item;
        }
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(Boolean);
    setCart(updated);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(i => i.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.unit_selling_price), 0);
  const discountAmount = (subtotal * (parseFloat(discount) || 0)) / 100;
  const taxAmount = ((subtotal - discountAmount) * (parseFloat(tax) || 0)) / 100;
  const netTotal = Math.max(0, subtotal - discountAmount + taxAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const payload = {
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        payment_mode: paymentMode,
        items: cart.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          unit_selling_price: i.unit_selling_price
        }))
      };

      const res = await api.post('/sales/checkout', payload);
      if (res.data.success) {
        setCompletedSale(res.data.data);
        setIsReceiptModal(true);
        setCart([]);
        setDiscount(0);
        setTax(0);
        fetchProducts();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Checkout failed. Stock error.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6">
      {/* Left: Product Selection Grid */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs overflow-hidden">
        <div className="mb-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by Name, SKU, or Barcode scan..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
          {products.map((p) => {
            const outOfStock = p.current_stock <= 0;
            const price = Number(p.selling_price);

            return (
              <button
                key={p.id}
                disabled={outOfStock}
                onClick={() => addToCart(p)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  outOfStock 
                    ? 'bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500 hover:shadow-md'
                }`}
              >
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block">{p.sku}</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 mt-0.5">{p.name}</h4>
                  {p.next_expiry_date && (
                    <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-400">
                      Next batch expires {p.next_expiry_date}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-blue-600">{Number.isFinite(price) ? `₹${price.toFixed(2)}` : 'Price required'}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${outOfStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                    {outOfStock ? 'Out of Stock' : `${p.current_stock} left`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Billing Sidebar */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-600" /> POS Cart ({cart.length})
          </h3>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-rose-500 font-semibold hover:underline">
              Clear All
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 my-2 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingCart className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
              <p className="text-xs font-semibold">Cart is empty</p>
              <p className="text-[11px]">Click items on the left to build order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-slate-900 dark:text-white leading-tight">{item.name}</p>
                  <p className="text-[10px] text-slate-400">₹{item.unit_selling_price.toFixed(2)} each</p>
                </div>
                <div className="flex items-center space-x-1">
                  <button onClick={() => updateCartQty(item.product_id, -1)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold w-6 text-center">{item.qty}</span>
                  <button onClick={() => updateCartQty(item.product_id, 1)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-right pl-3 font-bold text-slate-900 dark:text-white w-16">
                  ₹{(item.qty * item.unit_selling_price).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Controls */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Subtotal:</span>
            <span className="font-bold">₹{subtotal.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase">Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase">GST / Tax (%)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase">Payment Mode</label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {['CASH', 'CARD', 'UPI', 'MIXED'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1 rounded-lg text-[10px] font-bold transition-all ${
                    paymentMode === mode 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-base font-extrabold text-slate-900 dark:text-white">
            <span>Net Total:</span>
            <span className="text-xl text-blue-600">₹{netTotal.toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0 || loading}
            onClick={handleCheckout}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-sm shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 mt-2 flex items-center justify-center space-x-2"
          >
            <Receipt className="w-4 h-4" />
            <span>{loading ? 'Processing FEFO Sale...' : 'Complete & Pay'}</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <Modal isOpen={isReceiptModal} onClose={() => setIsReceiptModal(false)} title="Sales Receipt / Invoice">
        <div id="printable-receipt" className="space-y-4 p-4 text-slate-900 dark:text-slate-100">
          <div className="text-center pb-4 border-b border-dashed border-slate-300">
            <h2 className="text-xl font-black">SDMart Superstore</h2>
            <p className="text-xs">Invoice #: <strong>{completedSale?.invoice_no}</strong></p>
            <p className="text-[10px] text-slate-500">Date: {new Date(completedSale?.sale?.sale_date || Date.now()).toLocaleString()}</p>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-slate-500 font-bold">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Price</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completedSale?.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 font-semibold">{item.product_name} <span className="text-[10px] text-slate-400">({item.batch_number})</span></td>
                  <td className="py-1.5 text-center">{item.qty_sold}</td>
                  <td className="py-1.5 text-right">₹{item.unit_selling_price}</td>
                  <td className="py-1.5 text-right font-bold">₹{(item.qty_sold * item.unit_selling_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-3 border-t border-slate-200 text-xs space-y-1 text-right font-bold">
            <p className="text-slate-500">Payment Method: <span className="text-slate-900">{completedSale?.sale?.payment_mode}</span></p>
            <p className="text-lg text-emerald-600">Grand Total Paid: ₹{completedSale?.net_amount?.toFixed(2)}</p>
          </div>

          <div className="pt-4 border-t border-dashed text-center text-[10px] text-slate-500">
            Thank you for shopping with Smart Digital Mart!
          </div>

          <div className="flex space-x-2 pt-4">
            <button onClick={handlePrint} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2">
              <Printer className="w-4 h-4" /> <span>Print Invoice</span>
            </button>
            <button onClick={() => setIsReceiptModal(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default POSBilling;
