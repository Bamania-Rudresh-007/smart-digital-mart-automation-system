import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, CheckCircle, AlertTriangle, FileText, Upload, ShieldAlert, ClipboardList, PackageCheck, ReceiptText, FileCheck2, Download, Trash2 } from 'lucide-react';
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
  const [isPdfValidationModal, setIsPdfValidationModal] = useState(false);
  const [pdfFiles, setPdfFiles] = useState({});
  const [pdfValidationResult, setPdfValidationResult] = useState(null);
  const [pdfValidationError, setPdfValidationError] = useState('');
  const [isValidatingPdfs, setIsValidatingPdfs] = useState(false);
  const [pdfValidationKey, setPdfValidationKey] = useState(0);

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
        product_category: item.product?.category?.name || '',
        batch_number: `B-${item.product?.sku || 'GRN'}-${Date.now().toString().slice(-4)}`,
        has_expiry: /food|drink|beverage|grocery|beauty|skin|health|medicine|fragrance/i.test(
          `${item.product?.category?.name || ''} ${item.product?.name || ''}`
        ),
        expiry_date: '',
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
      const items = grnItems.map(({ has_expiry, ...item }) => ({
        ...item,
        expiry_date: has_expiry ? item.expiry_date : null
      }));
      await api.post('/purchases/grn', { po_id: selectedPO.id, items });
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

  const openPdfValidation = (po) => {
    setSelectedPO(po);
    setPdfFiles({});
    setPdfValidationResult(null);
    setPdfValidationError('');
    setPdfValidationKey(key => key + 1);
    setIsPdfValidationModal(true);
  };

  const submitPdfValidation = async (e) => {
    e.preventDefault();
    setPdfValidationError('');
    setIsValidatingPdfs(true);
    const formData = new FormData();
    formData.append('goods_receipt_note', pdfFiles.goods_receipt_note);
    formData.append('supplier_invoice', pdfFiles.supplier_invoice);

    try {
      const response = await api.post(
        `/purchases/${selectedPO.id}/validate-documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setPdfValidationResult(response.data.data);
      fetchPOs();
    } catch (error) {
      setPdfValidationError(error.response?.data?.message || 'Unable to validate these PDFs.');
    } finally {
      setIsValidatingPdfs(false);
    }
  };

  const downloadPdf = async (url, filename) => {
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to download the PDF.');
    }
  };

  const deletePO = async (po) => {
    if (!window.confirm(`Delete ${po.po_number}? Only draft or rejected orders without receiving or invoice records can be deleted.`)) {
      return;
    }

    try {
      await api.delete(`/purchases/${po.id}`);
      fetchPOs();
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to delete this purchase order.');
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
            For each purchase order, the system generates the PO document from its saved items. Upload the supplier's GRN and invoice, and it checks quantity, unit price, total amount, and PO reference:
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
            Validation uses the selected purchase order's saved quantities and prices as the source of truth. Both supplier PDFs must reference that PO. Text-based PDFs with clearly labeled summary values are supported; scanned PDFs require OCR and cannot be validated here. The configured tolerance is 2% by default. A successful validation marks the purchase order Approved; mismatches are listed for review.
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
                      <span className="text-slate-400 italic">No validation result yet</span>
                    )}
                  </td>
                  <td className="p-4">{po.is_auto_generated ? <Badge variant="warning">Auto Reorder</Badge> : 'Manual'}</td>
                  <td className="p-4 text-right space-x-2">
                    {po.status === 'Draft' && (
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/purchases/${po.id}/status`, { status: 'Sent' });
                            fetchPOs();
                          } catch (error) {
                            alert(error.response?.data?.message || 'Unable to send this purchase order.');
                          }
                        }}
                        className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px]"
                      >
                        Send to Supplier
                      </button>
                    )}

                    {po.status !== 'Draft' && (
                      <button
                        onClick={() => downloadPdf(`/purchases/${po.id}/pdf`, `${po.po_number}.pdf`)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold text-[11px] dark:bg-slate-700 dark:text-slate-100"
                      >
                        <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download PO PDF</span>
                      </button>
                    )}

                    {(po.status === 'Sent' || po.status === 'Partially Received' ||
                      (po.status === 'Discrepancy' && getOutstandingGRNItems(po).length > 0)) && (
                      <button onClick={() => openGRN(po)} className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg font-bold text-[11px]">
                        {po.status === 'Discrepancy' ? 'Correct GRN' : 'Receive GRN'}
                      </button>
                    )}

                    {po.status !== 'Draft' && (
                      <button
                        onClick={() => openPdfValidation(po)}
                        className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px]"
                      >
                        <span className="inline-flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> Validate Documents</span>
                      </button>
                    )}

                    {['Draft', 'Rejected'].includes(po.status) && (
                      <button
                        onClick={() => deletePO(po)}
                        className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold text-[11px] dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</span>
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

      <Modal
        isOpen={isPdfValidationModal}
        onClose={() => setIsPdfValidationModal(false)}
        title={`Validate PDFs for ${selectedPO?.po_number || 'Purchase Order'}`}
        maxWidth="max-w-3xl"
      >
        <form key={pdfValidationKey} onSubmit={submitPdfValidation} className="space-y-5">
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
            The Purchase Order PDF is generated from this saved purchase order and is checked automatically. Upload the supplier's GRN and invoice PDFs; both must include this PO number and clearly labeled quantities, prices, and totals. Each file must be no larger than 10 MB.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['goods_receipt_note', 'Goods Receipt Note (GRN) PDF'],
              ['supplier_invoice', 'Supplier Invoice PDF']
            ].map(([field, label]) => (
              <label key={field} className="rounded-xl border border-slate-200 p-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                <span className="mb-2 block">{label} <span className="text-rose-500">*</span></span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  required
                  onChange={event => {
                    const selectedFile = event.target.files?.[0] || null;
                    setPdfFiles(current => ({ ...current, [field]: selectedFile }));
                    setPdfValidationResult(null);
                    setPdfValidationError('');
                  }}
                  className="block w-full text-[11px] file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-2 file:py-1.5 file:text-[11px] file:font-bold file:text-blue-700"
                />
              </label>
            ))}
          </div>
          {selectedPO && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-800 dark:text-white">Download PDFs to test this purchase order</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ['grn', 'matching', 'Matching GRN'],
                  ['invoice', 'matching', 'Matching invoice'],
                  ['grn', 'mismatch', 'GRN with quantity mismatch'],
                  ['invoice', 'mismatch', 'Invoice with price mismatch']
                ].map(([documentType, scenario, label]) => (
                  <button
                    key={`${documentType}-${scenario}`}
                    type="button"
                    onClick={() => downloadPdf(
                      `/purchases/${selectedPO.id}/validation-samples/${documentType}/${scenario}`,
                      `${selectedPO.po_number}-${documentType}-${scenario}.pdf`
                    )}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> {label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {pdfValidationError && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {pdfValidationError}
            </p>
          )}
          <button
            type="submit"
            disabled={isValidatingPdfs}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isValidatingPdfs ? 'Reading and comparing PDFs…' : 'Run 3-Way Validation'}
          </button>
        </form>

        {pdfValidationResult && (
          <section className="mt-6 space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700" aria-live="polite">
            <div className={`rounded-xl p-4 ${pdfValidationResult.match_status === 'Matched' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'}`}>
              <h4 className="font-bold">
                {pdfValidationResult.match_status === 'Matched' ? 'Matched — purchase order approved' : 'Discrepancy found'}
              </h4>
              <p className="mt-1 text-xs">{pdfValidationResult.remarks}</p>
              <p className="mt-2 text-[11px]">Allowed tolerance: {pdfValidationResult.tolerance_percent}%</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="p-3">Parameter</th>
                    <th className="p-3">Documents</th>
                    <th className="p-3">Values</th>
                    <th className="p-3">Variance</th>
                    <th className="p-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pdfValidationResult.checks.map((check, index) => (
                    <tr key={`${check.parameter}-${index}`}>
                      <td className="p-3 font-semibold">{check.parameter}</td>
                      <td className="p-3">{check.documents}</td>
                      <td className="p-3">{check.value_a} / {check.value_b}</td>
                      <td className="p-3">{check.variance_percent === null ? 'Not measurable' : `${check.variance_percent}%`}</td>
                      <td className={`p-3 font-bold ${check.within_tolerance ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {check.within_tolerance ? 'Pass' : 'Mismatch'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </Modal>

      {/* Create PO Modal */}
      <Modal isOpen={isCreateModal} onClose={() => setIsCreateModal(false)} title="Create Purchase Order">
        <form onSubmit={handleCreatePO} className="space-y-5">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <label htmlFor="po-supplier" className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Supplier <span className="text-rose-500">*</span>
            </label>
            <select
              id="po-supplier"
              required
              value={poForm.supplier_id}
              onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Choose a supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Select the supplier this order will be sent to.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Order items</h4>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Choose a product, then enter the quantity and unit price agreed with the supplier.
              </p>
            </div>
            {poForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label htmlFor={`po-product-${idx}`} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id={`po-product-${idx}`}
                    required
                    value={item.product_id}
                    onChange={(e) => {
                      const newItems = [...poForm.items];
                      newItems[idx].product_id = e.target.value;
                      setPoForm({ ...poForm, items: newItems });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Choose a product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`po-quantity-${idx}`} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Order quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`po-quantity-${idx}`}
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={item.ordered_qty}
                    onChange={(e) => {
                      const newItems = [...poForm.items];
                      newItems[idx].ordered_qty = parseInt(e.target.value, 10);
                      setPoForm({ ...poForm, items: newItems });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`po-unit-price-${idx}`} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Agreed unit price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`po-unit-price-${idx}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={item.agreed_unit_price}
                    onChange={(e) => {
                      const newItems = [...poForm.items];
                      newItems[idx].agreed_unit_price = parseFloat(e.target.value);
                      setPoForm({ ...poForm, items: newItems });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500">
            Create Draft PO
          </button>
        </form>
      </Modal>

      {/* GRN Entry Modal */}
      <Modal isOpen={isGRNModal} onClose={() => setIsGRNModal(false)} title={`Receive GRN for ${selectedPO?.po_number}`}>
        <form onSubmit={submitGRN} className="space-y-4">
          <p className="text-xs text-slate-500">Record what arrived. Enter the label's expiry date for perishable batches; uncheck expiry for non-perishable items.</p>
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
                <label className="col-span-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={gi.has_expiry}
                    onChange={(e) => {
                      const next = [...grnItems];
                      next[idx].has_expiry = e.target.checked;
                      setGrnItems(next);
                    }}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Expiry-tracked batch
                </label>
                {gi.has_expiry && (
                  <input
                    type="date"
                    required
                    value={gi.expiry_date}
                    onChange={(e) => {
                      const next = [...grnItems];
                      next[idx].expiry_date = e.target.value;
                      setGrnItems(next);
                    }}
                    className="col-span-2 px-2 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                  />
                )}
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
