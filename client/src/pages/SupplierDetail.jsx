import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/client.js";

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/suppliers/${id}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load supplier");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>;
  if (!data) return null;

  const { supplier, purchases, totalPurchases, totalPaid } = data;

  return (
    <div>
      <Link to="/suppliers" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Suppliers
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1">{supplier.name}</h2>
            {supplier.phone && <p className="text-gray-500 text-sm mb-1">{supplier.phone}</p>}
            {supplier.address && <p className="text-gray-500 text-sm mb-4">{supplier.address}</p>}
          </div>
          <button
            onClick={() =>
              navigate("/inventory", {
                state: { tab: "purchase", supplierId: supplier._id, supplierName: supplier.name },
              })
            }
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
          >
            + Add Purchase
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Purchases</p>
            <p className="text-xl font-bold">{totalPurchases}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Paid</p>
            <p className="text-xl font-bold text-orange-600">Rs. {totalPaid.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <h3 className="font-semibold mb-2">Purchase History</h3>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Misc</th>
              <th className="px-4 py-3 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No purchase history yet.
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p._id} className="border-t border-gray-100">
                <td className="px-4 py-3">{new Date(p.date).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">
                  {p.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {p.miscAmount > 0 ? `Rs. ${p.miscAmount.toFixed(2)}` : "-"}
                </td>
                <td className="px-4 py-3 text-right font-medium">{p.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
