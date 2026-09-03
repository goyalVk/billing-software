import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(q = "") {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/customers", { params: q ? { search: q } : {} });
      setCustomers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers");
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

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Customers</h2>

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
              <th className="px-4 py-3">Last Visit</th>
              <th className="px-4 py-3 text-right">Total Visits</th>
              <th className="px-4 py-3 text-right">Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No customers found.
                </td>
              </tr>
            )}
            {!loading &&
              customers.map((c) => (
                <tr key={c._id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/customers/${c._id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">
                    {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">{c.totalVisits}</td>
                  <td className="px-4 py-3 text-right">Rs. {c.totalSpent.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
