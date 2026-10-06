import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, CheckCircle, AlertTriangle, FileText, Upload, ShieldAlert, ClipboardList, PackageCheck, ReceiptText } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import Modal from '../../components/Common/Modal';
import api from '../../services/api';

const PurchaseOrdersList = () => {
  const [pos, setPos] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);

  // Modals
  const [isCreateModal, setIsCreateModal] = useState(false);
  const [isGRNModal, setIsGRNModal] = useState(false);
  const [isInvoiceModal, setIsInvoiceModal] = useState(false);
  const [isOverrideModal, setIsOverrideModal] = useState(false);

  // Forms
  const [poForm, setPoForm] = useState({ supplier_id: '', items: [{ product_id: '', ordered_qty: 10, agreed_unit_price: 100 }] });
  const [grnItems, setGrnItems] = useState([]);
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: '', invoice_amount: '', invoice_date: '', items: [] });
  const [overrideRemarks, setOverrideRemarks] = useState('');

  useEffect(() => {
    fetchPOs();
    fetchMeta();
  }, []);

  const fetchPOs = async () => {
    try {
      const res = await api.get('/purchases');
      if (res.data.success) setPos(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMeta = async () => {
    try {
      const [prodRes, supRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/suppliers')
      ]);
      setProducts(prodRes.data.data || []);
      setSuppliers(supRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases', poForm);
      setIsCreateModal(false);
      fetchPOs();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating PO');
    }
  };

  const getOutstandingGRNItems = (po) => {
    const receivedByProduct = new Map();
    (po.goodsReceipts || []).forEach(receipt => {
      (receipt.items || []).forEach(item => {
        receivedByProduct.set(
          item.product_id,
          (receivedByProduct.get(item.product_id) || 0) + Number(item.received_qty)
        );
      });
    });
    return po.items.map(item => ({
      ...item,
      remaining_qty: Math.max(0, Number(item.ordered_qty) - (receivedByProduct.get(item.product_id) || 0))
    }))
      .filter(item => item.remaining_qty > 0)
      .map(item => ({
        product_id: item.product_id,
        product_name: item.product?.name,
        batch_number: `B-${item.product?.sku || 'GRN'}-${Date.now().toString().slice(-4)}`,
        expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        received_qty: item.remaining_qty,
        purchase_price: item.agreed_unit_price,
        selling_price: (parseFloat(item.agreed_unit_price) * 1.2).toFixed(2)
      }));
  };

  const openGRN = (po) => {
    setSelectedPO(po);
    const items = getOutstandingGRNItems(po);
    if (items.length === 0) {
      alert('There is no outstanding quantity to receive for this purchase order.');
      return;
    }

    setGrnItems(items);
    setIsGRNModal(true);
  };

  const submitGRN = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases/grn', { po_id: selectedPO.id, items: grnItems });
      setIsGRNModal(false);
      fetchPOs();
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting GRN');
    }
  };

  const openInvoice = (po) => {
    setSelectedPO(po);
    const items = po.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product?.name,
      billed_qty: item.ordered_qty,
      billed_unit_price: item.agreed_unit_price
    }));
    const total = items.reduce((sum, i) => sum + i.billed_qty * i.billed_unit_price, 0);
    setInvoiceForm({
      invoice_number: `INV-SUP-${Date.now().toString().slice(-4)}`,
      invoice_amount: total,
      invoice_date: new Date().toISOString().split('T')[0],
      items
    });
    setIsInvoiceModal(true);
  };

  const submitInvoice = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases/invoice', { po_id: selectedPO.id, ...invoiceForm });
      setIsInvoiceModal(false);
      fetchPOs();
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting invoice');
    }
  };

  const updateInvoiceItem = (index, field, value) => {
    const parsedValue = value === '' ? '' : Number(value);
    setInvoiceForm(current => {
      const items = current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: parsedValue } : item
      );
      const invoiceAmount = items.reduce(
        (sum, item) => sum + Number(item.billed_qty || 0) * Number(item.billed_unit_price || 0),
        0
      );
      return { ...current, items, invoice_amount: invoiceAmount };
    });
  };

  const acceptReceivedQuantity = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases/accept-received-quantity', {
        po_id: selectedPO.id,
        remarks: overrideRemarks
      });
      setIsOverrideModal(false);
      setOverrideRemarks('');
      fetchPOs();
    } catch (err) {
      alert(err.response?.data?.message || 'Error accepting received quantity');
    }
  };

  const submitOverride = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases/override', { po_id: selectedPO.id, remarks: overrideRemarks });
      setIsOverrideModal(false);
      fetchPOs();
    } catch (err) {
      alert(err.response?.data?.message || 'Error overriding discrepancy');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved': return <Badge variant="success">Approved</Badge>;
      case 'Discrepancy': return <Badge variant="danger">Discrepancy</Badge>;
      case 'Matched': return <Badge variant="info">3-Way Matched</Badge>;
      case 'Fully Received': return <Badge variant="purple">Fully Received</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Purchase Orders & 3-Way Match</h2>
          <p className="text-xs text-slate-500">Automated 3-way matching validation (PO vs GRN vs Vendor Invoice)</p>
        </div>
        <button
          onClick={() => setIsCreateModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 dark:border-blue-900 dark:bg-blue-950/20">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">What does 3-way matching check?</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Before approving payment, the system compares three records for the same purchase:
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              icon: ClipboardList,
              title: '1. Purchase Order',
              detail: 'What you ordered: product, quantity, and agreed unit price.'
            },
            {
              icon: PackageCheck,
              title: '2. Goods Receipt (GRN)',
              detail: 'What arrived: received quantity and the batch/expiry details entered at receiving.'
            },
            {
              icon: ReceiptText,
              title: '3. Supplier Invoice',
              detail: 'What the supplier billed: billed quantity, unit price, and invoice total.'
            }
          ].map(step => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-xl border border-white bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                  <Icon className="h-4 w-4 text-blue-600" /> {step.title}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-400">{step.detail}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            A match means quantities, unit prices, and invoice totals are within the configured tolerance (2% by default), so payment is auto-approved. A discrepancy lists what differs; correct the GRN or invoice, or use the manager's quantity carry-forward/override action.
          </p>
        </div>
      </section>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">PO Number</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Status</th>
                <th className="p-4">3-Way Match Result</th>
                <th className="p-4">Auto Generated</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pos.map(po => (
                <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{po.po_number}</td>
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{po.supplier?.name}</td>
                  <td className="p-4">{getStatusBadge(po.status)}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {po.match ? (
                      <span className="font-bold">{po.match.match_status}: {po.match.remarks}</span>
                    ) : (
                      <span className="text-slate-400 italic">Pending GRN & Invoice</span>
                    )}
                  </td>
                  <td className="p-4">{po.is_auto_generated ? <Badge variant="warning">Auto Reorder</Badge> : 'Manual'}</td>
                  <td className="p-4 text-right space-x-2">
                    {po.status === 'Draft' && (
                      <button
                        onClick={async () => {
                          await api.put(`/purchases/${po.id}/status`, { status: 'Sent' });
                          fetchPOs();
                        }}
                        className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px]"
                      >
                        Send to Supplier
                      </button>
                    )}

                    {(po.status === 'Sent' || po.status === 'Partially Received' ||
                      (po.status === 'Discrepancy' && getOutstandingGRNItems(po).length > 0)) && (
                      <button onClick={() => openGRN(po)} className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg font-bold text-[11px]">
                        {po.status === 'Discrepancy' ? 'Correct GRN' : 'Receive GRN'}
                      </button>
                    )}

                    {(po.status === 'Fully Received' || po.status === 'Partially Received' || po.status === 'Sent' || po.status === 'Discrepancy') && (
                      <button onClick={() => openInvoice(po)} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px]">
                        {po.status === 'Discrepancy' ? 'Correct Invoice' : 'Log Invoice'}
                      </button>
                    )}

                    {po.status === 'Discrepancy' && po.match?.remarks?.toLowerCase().includes('quantity') && (
                      <button
                        onClick={() => { setSelectedPO(po); setOverrideRemarks(''); setIsOverrideModal(true); }}
                        className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px]"
                      >
                        Accept Qty & Carry Forward
                      </button>
                    )}

                    {po.status === 'Discrepancy' && !po.match?.remarks?.toLowerCase().includes('quantity') && (
                      <button
                        onClick={() => { setSelectedPO(po); setOverrideRemarks(''); setIsOverrideModal(true); }}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold text-[11px]"
                      >
                        Manager Override
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      <Modal isOpen={isCreateModal} onClose={() => setIsCreateModal(false)} title="Create Purchase Order">
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Select Supplier</label>
            <select
              required
              value={poForm.supplier_id}
              onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">Select Supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">PO Line Items</label>
            {poForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2">
                <select
                  required
                  value={item.product_id}
                  onChange={(e) => {
                    const newItems = [...poForm.items];
                    newItems[idx].product_id = e.target.value;
                    setPoForm({ ...poForm, items: newItems });
                  }}
                  className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                >
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Ordered Qty"
                  value={item.ordered_qty}
                  onChange={(e) => {
                    const newItems = [...poForm.items];
                    newItems[idx].ordered_qty = parseInt(e.target.value, 10);
                    setPoForm({ ...poForm, items: newItems });
                  }}
                  className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                />
                <input
                  type="number"
                  placeholder="Agreed Unit Price"
                  value={item.agreed_unit_price}
                  onChange={(e) => {
                    const newItems = [...poForm.items];
                    newItems[idx].agreed_unit_price = parseFloat(e.target.value);
                    setPoForm({ ...poForm, items: newItems });
                  }}
                  className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                />
              </div>
            ))}
          </div>

          <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs">
            Create Draft PO
          </button>
        </form>
      </Modal>

      {/* GRN Entry Modal */}
      <Modal isOpen={isGRNModal} onClose={() => setIsGRNModal(false)} title={`Receive GRN for ${selectedPO?.po_number}`}>
        <form onSubmit={submitGRN} className="space-y-4">
          <p className="text-xs text-slate-500">Specify batch numbers, expiry dates, and received quantities for stock entry.</p>
          {grnItems.map((gi, idx) => (
            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
              <p className="font-bold text-xs text-slate-900 dark:text-white">{gi.product_name}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Batch Number"
                  value={gi.batch_number}
                  onChange={(e) => {
                    const next = [...grnItems];
                    next[idx].batch_number = e.target.value;
                    setGrnItems(next);
                  }}
                  className="px-2 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                />
                <input
                  type="date"
                  value={gi.expiry_date}
                  onChange={(e) => {
                    const next = [...grnItems];
                    next[idx].expiry_date = e.target.value;
                    setGrnItems(next);
                  }}
                  className="px-2 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Received Qty</label>
                  <input
                    type="number"
                    value={gi.received_qty}
                    onChange={(e) => {
                      const next = [...grnItems];
                      next[idx].received_qty = parseInt(e.target.value, 10);
                      setGrnItems(next);
                    }}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Purchase Price</label>
                  <input
                    type="number"
                    value={gi.purchase_price}
                    onChange={(e) => {
                      const next = [...grnItems];
                      next[idx].purchase_price = parseFloat(e.target.value);
                      setGrnItems(next);
                    }}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">MRP / Selling</label>
                  <input
                    type="number"
                    value={gi.selling_price}
                    onChange={(e) => {
                      const next = [...grnItems];
                      next[idx].selling_price = parseFloat(e.target.value);
                      setGrnItems(next);
                    }}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl text-xs">
            Confirm GRN Receipt & Create Batches
          </button>
        </form>
      </Modal>

      {/* Invoice Entry Modal */}
      <Modal isOpen={isInvoiceModal} onClose={() => setIsInvoiceModal(false)} title={`Log Vendor Invoice for ${selectedPO?.po_number}`}>
        <form onSubmit={submitInvoice} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-400">Invoice Number</label>
              <input
                type="text"
                required
                value={invoiceForm.invoice_number}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400">Invoice Date</label>
              <input
                type="date"
                required
                value={invoiceForm.invoice_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400">Total Billed Amount (₹)</label>
            <input
              type="number"
              required
              value={invoiceForm.invoice_amount}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_amount: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold text-emerald-600"
            />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase text-slate-400">Invoice Line Items</p>
            {invoiceForm.items.map((item, index) => (
              <div key={item.product_id} className="grid grid-cols-[1fr_90px_110px] items-center gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.product_name}</span>
                <input
                  type="number"
                  min="1"
                  required
                  aria-label={`Billed quantity for ${item.product_name}`}
                  value={item.billed_qty}
                  onChange={event => updateInvoiceItem(index, 'billed_qty', event.target.value)}
                  className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  aria-label={`Billed unit price for ${item.product_name}`}
                  value={item.billed_unit_price}
                  onChange={event => updateInvoiceItem(index, 'billed_unit_price', event.target.value)}
                  className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                />
              </div>
            ))}
          </div>

          <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs">
            Submit Invoice & Run 3-Way Match Check
          </button>
        </form>
      </Modal>

      {/* Manager Override Modal */}
      <Modal isOpen={isOverrideModal} onClose={() => setIsOverrideModal(false)} title={`Manager Override for ${selectedPO?.po_number}`}>
        <form
          onSubmit={selectedPO?.match?.remarks?.toLowerCase().includes('quantity')
            ? acceptReceivedQuantity
            : submitOverride}
          className="space-y-4"
        >
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-500 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>
              {selectedPO?.match?.remarks?.toLowerCase().includes('quantity')
                ? 'Accept the received quantity; any outstanding quantity will be carried forward to a new draft purchase order.'
                : '3-Way Match discrepancy detected. Override requires a mandatory logged audit reason.'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Override Reason / Audit Remarks</label>
            <textarea
              required
              rows={3}
              value={overrideRemarks}
              onChange={(e) => setOverrideRemarks(e.target.value)}
              placeholder={selectedPO?.match?.remarks?.toLowerCase().includes('quantity')
                ? 'Explain why the received quantity is accepted and the outstanding quantity carried forward.'
                : 'e.g. Price discrepancy approved by regional procurement lead due to raw material rate hike.'}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
            />
          </div>

          <button type="submit" className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl text-xs">
            {selectedPO?.match?.remarks?.toLowerCase().includes('quantity')
              ? 'Accept Received Quantity & Carry Remainder Forward'
              : 'Confirm Manager Override & Approve PO'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default PurchaseOrdersList;
