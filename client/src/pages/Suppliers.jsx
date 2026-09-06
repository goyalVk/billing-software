import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";

const emptyForm = { name: "", phone: "", address: "" };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [modalError, setModalError] = useState("");
  const navigate = useNavigate();

  async function load(q = "") {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/suppliers", { params: q ? { search: q } : {} });
      setSuppliers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function openAddModal() {
    setForm(emptyForm);
    setModalError("");
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Supplier name is required");
      return;
    }
    try {
      await api.post("/suppliers", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      setShowModal(false);
      load(search);
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to add supplier");
    }
  }

  function goToAddPurchase(supplier) {
    navigate("/inventory", {
      state: { tab: "purchase", supplierId: supplier._id, supplierName: supplier.name },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Suppliers</h2>
        <button
          onClick={openAddModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + Add Supplier
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-4">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Last Purchase</th>
              <th className="px-4 py-3 text-right">Total Purchases</th>
              <th className="px-4 py-3 text-right">Total Paid</th>
              <th className="px-4 py-3 text-right">Due</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && suppliers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No suppliers found.
                </td>
              </tr>
            )}
            {!loading &&
              suppliers.map((s) => (
                <tr key={s._id} className={`border-t border-gray-100 ${s.totalDue > 0 ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/suppliers/${s._id}`} className="text-blue-600 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{s.phone || "-"}</td>
                  <td className="px-4 py-3">
                    {s.lastPurchase ? new Date(s.lastPurchase).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">{s.totalPurchases}</td>
                  <td className="px-4 py-3 text-right">Rs. {s.totalPaid.toFixed(2)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      s.totalDue > 0 ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    Rs. {s.totalDue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => goToAddPurchase(s)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Add Purchase
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-full overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add Supplier</h3>
            {modalError && (
              <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-3">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
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
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
