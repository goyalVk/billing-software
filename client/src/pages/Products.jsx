import { Fragment, useEffect, useState } from "react";
import api from "../api/client.js";

const UNITS = ["pcs", "kg", "box", "ltr"];
const emptyForm = { name: "", unit: "pcs", purchaseRate: "", sellingRate: "", currentStock: "" };

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalDateInputValue(dateInput) {
  const d = new Date(dateInput);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [historyCache, setHistoryCache] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);
  const [historyEditForm, setHistoryEditForm] = useState({ date: "", quantity: "", rate: "" });
  const [historyEditError, setHistoryEditError] = useState("");
  const [historyEditSaving, setHistoryEditSaving] = useState(false);

  async function loadProducts(q = "") {
    setLoading(true);
    try {
      const res = await api.get("/products", { params: q ? { search: q } : {} });
      setProducts(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function openEditModal(product) {
    setEditingId(product._id);
    setForm({
      name: product.name,
      unit: product.unit,
      purchaseRate: product.purchaseRate,
      sellingRate: product.sellingRate,
      currentStock: product.currentStock,
    });
    setError("");
    setShowModal(true);
  }

  function validate() {
    if (!form.name.trim()) return "Product name is required";
    if (form.purchaseRate === "" || Number(form.purchaseRate) < 0) return "Valid purchase rate is required";
    if (form.sellingRate === "" || Number(form.sellingRate) < 0) return "Valid selling rate is required";
    if (form.currentStock !== "" && Number(form.currentStock) < 0) return "Stock cannot be negative";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      purchaseRate: Number(form.purchaseRate),
      sellingRate: Number(form.sellingRate),
      currentStock: form.currentStock === "" ? 0 : Number(form.currentStock),
    };
    try {
      await api.put(`/products/${editingId}`, payload);
      setShowModal(false);
      loadProducts(search);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save product");
    }
  }

  async function toggleHistory(product) {
    if (expandedId === product._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(product._id);
    if (!historyCache[product._id]) {
      setHistoryLoading(true);
      try {
        const res = await api.get(`/products/${product._id}/purchase-history`);
        setHistoryCache((prev) => ({ ...prev, [product._id]: res.data }));
      } catch {
        setHistoryCache((prev) => ({ ...prev, [product._id]: [] }));
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function refreshHistory(productId) {
    try {
      const res = await api.get(`/products/${productId}/purchase-history`);
      setHistoryCache((prev) => ({ ...prev, [productId]: res.data }));
    } catch {
      // leave existing cached history in place on refresh failure
    }
  }

  function startEditHistory(productId, entry) {
    setEditingHistoryEntry({ productId, purchaseId: entry.purchaseId });
    setHistoryEditForm({
      date: toLocalDateInputValue(entry.date),
      quantity: entry.quantity,
      rate: entry.rate,
    });
    setHistoryEditError("");
  }

  function cancelEditHistory() {
    setEditingHistoryEntry(null);
    setHistoryEditError("");
  }

  async function saveHistoryEdit() {
    if (!editingHistoryEntry) return;
    const { productId, purchaseId } = editingHistoryEntry;
    if (!historyEditForm.quantity || Number(historyEditForm.quantity) <= 0) {
      setHistoryEditError("Quantity must be greater than 0");
      return;
    }
    if (historyEditForm.rate === "" || Number(historyEditForm.rate) < 0) {
      setHistoryEditError("Rate must be 0 or greater");
      return;
    }
    setHistoryEditSaving(true);
    setHistoryEditError("");
    try {
      await api.put(`/purchases/${purchaseId}/items/${productId}`, {
        quantity: Number(historyEditForm.quantity),
        rate: Number(historyEditForm.rate),
        date: historyEditForm.date,
      });
      await Promise.all([refreshHistory(productId), loadProducts(search)]);
      setEditingHistoryEntry(null);
    } catch (err) {
      setHistoryEditError(err.response?.data?.message || "Failed to update entry");
    } finally {
      setHistoryEditSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${product._id}`);
      loadProducts(search);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete product");
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Products</h2>
      <p className="text-sm text-gray-500 mb-4">
        New products are created automatically from the Inventory &rarr; Add Purchase tab.
      </p>

      <input
        type="text"
        placeholder="Search products by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Purchase Rate</th>
              <th className="px-4 py-3 text-right">Selling Rate</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No products found.
                </td>
              </tr>
            )}
            {!loading &&
              products.map((p) => (
                <Fragment key={p._id}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.unit}</td>
                    <td className="px-4 py-3 text-right">{p.purchaseRate.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{p.sellingRate.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.currentStock <= 0 ? "text-red-600 font-semibold" : ""}>
                        {p.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => toggleHistory(p)}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        {expandedId === p._id ? "Hide History" : "History"}
                      </button>
                      <button
                        onClick={() => openEditModal(p)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === p._id && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={6} className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Purchase History
                        </p>
                        {historyLoading && !historyCache[p._id] && (
                          <p className="text-sm text-gray-400">Loading...</p>
                        )}
                        {historyCache[p._id] && historyCache[p._id].length === 0 && (
                          <p className="text-sm text-gray-400">
                            No purchase history for this product yet.
                          </p>
                        )}
                        {historyCache[p._id] && historyCache[p._id].length > 0 && (
                          <>
                            {historyEditError &&
                              editingHistoryEntry?.productId === p._id && (
                                <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-md mb-2">
                                  {historyEditError}
                                </div>
                              )}
                            <table className="w-full text-sm">
                              <thead className="text-gray-500 text-left">
                                <tr>
                                  <th className="pr-4 py-1">Date</th>
                                  <th className="pr-4 py-1">Supplier</th>
                                  <th className="pr-4 py-1 text-right">Quantity</th>
                                  <th className="pr-4 py-1 text-right">Rate</th>
                                  <th className="pr-4 py-1 text-right">Amount</th>
                                  <th className="pr-4 py-1 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historyCache[p._id].map((h) => {
                                  const isEditing =
                                    editingHistoryEntry?.productId === p._id &&
                                    editingHistoryEntry?.purchaseId === h.purchaseId;
                                  return (
                                    <tr key={h.purchaseId} className="border-t border-gray-200">
                                      {isEditing ? (
                                        <>
                                          <td className="pr-4 py-1">
                                            <input
                                              type="date"
                                              max={todayStr()}
                                              value={historyEditForm.date}
                                              onChange={(e) =>
                                                setHistoryEditForm((f) => ({ ...f, date: e.target.value }))
                                              }
                                              className="w-36 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                          </td>
                                          <td className="pr-4 py-1">{h.supplierName}</td>
                                          <td className="pr-4 py-1 text-right">
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={historyEditForm.quantity}
                                              onChange={(e) =>
                                                setHistoryEditForm((f) => ({ ...f, quantity: e.target.value }))
                                              }
                                              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                          </td>
                                          <td className="pr-4 py-1 text-right">
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={historyEditForm.rate}
                                              onChange={(e) =>
                                                setHistoryEditForm((f) => ({ ...f, rate: e.target.value }))
                                              }
                                              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                          </td>
                                          <td className="pr-4 py-1 text-right">
                                            {(
                                              (Number(historyEditForm.rate) || 0) *
                                              (Number(historyEditForm.quantity) || 0)
                                            ).toFixed(2)}
                                          </td>
                                          <td className="pr-4 py-1 text-right space-x-2 whitespace-nowrap">
                                            <button
                                              onClick={saveHistoryEdit}
                                              disabled={historyEditSaving}
                                              className="text-blue-600 hover:underline text-sm disabled:opacity-50"
                                            >
                                              {historyEditSaving ? "Saving..." : "Save"}
                                            </button>
                                            <button
                                              onClick={cancelEditHistory}
                                              disabled={historyEditSaving}
                                              className="text-gray-500 hover:underline text-sm disabled:opacity-50"
                                            >
                                              Cancel
                                            </button>
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                          <td className="pr-4 py-1">{new Date(h.date).toLocaleString()}</td>
                                          <td className="pr-4 py-1">{h.supplierName}</td>
                                          <td className="pr-4 py-1 text-right">{h.quantity}</td>
                                          <td className="pr-4 py-1 text-right">{h.rate.toFixed(2)}</td>
                                          <td className="pr-4 py-1 text-right">{h.amount.toFixed(2)}</td>
                                          <td className="pr-4 py-1 text-right">
                                            <button
                                              onClick={() => startEditHistory(p._id, h)}
                                              className="text-blue-600 hover:underline text-sm"
                                            >
                                              Edit
                                            </button>
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-full overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Product</h3>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-3">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.purchaseRate}
                    onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Selling Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.sellingRate}
                    onChange={(e) => setForm({ ...form, sellingRate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Stock</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
