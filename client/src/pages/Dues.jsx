import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";

function nowDateTimeLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateTimeInputValue(dateInput) {
  const d = new Date(dateInput);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
}

export default function Dues() {
  const [dues, setDues] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [payInputs, setPayInputs] = useState({});
  const [payDateInputs, setPayDateInputs] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/sales/dues");
      setDues(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(saleId) {
    setMarkingId(saleId);
    try {
      await api.put(`/sales/${saleId}/mark-paid`, {
        ...(payDateInputs[saleId] && { date: payDateInputs[saleId] }),
      });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to mark as paid");
    } finally {
      setMarkingId(null);
    }
  }

  async function recordPayment(saleId) {
    const amount = Number(payInputs[saleId]);
    if (!(amount > 0)) {
      alert("Enter a payment amount greater than 0");
      return;
    }
    setMarkingId(saleId);
    try {
      await api.put(`/sales/${saleId}/record-payment`, {
        amount,
        ...(payDateInputs[saleId] && { date: payDateInputs[saleId] }),
      });
      setPayInputs((prev) => ({ ...prev, [saleId]: "" }));
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to record payment");
    } finally {
      setMarkingId(null);
    }
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dueDate) < today;
  }

  const filteredDues = dues.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.customerName || "").toLowerCase().includes(q) ||
      (s.customerPhone || "").toLowerCase().includes(q)
    );
  });

  const totalDue = filteredDues.reduce(
    (sum, s) => sum + (s.totalAmount - (s.amountPaid ?? s.totalAmount)),
    0
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Dues</h2>
      <p className="text-sm text-gray-500 mb-4">
        {filteredDues.length} pending invoice(s) &middot; Total outstanding:{" "}
        <span className="font-semibold text-red-600">Rs. {totalDue.toFixed(2)}</span>
      </p>

      <input
        type="text"
        placeholder="Search by customer name or mobile number..."
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
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Amount Due</th>
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
            {!loading && filteredDues.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  {dues.length === 0
                    ? "No pending dues. Everyone's settled up."
                    : "No dues match that search."}
                </td>
              </tr>
            )}
            {!loading &&
              filteredDues.map((s) => (
                <Fragment key={s._id}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">
                      {s.customerId ? (
                        <Link to={`/customers/${s.customerId}`} className="text-blue-600 hover:underline">
                          {s.customerName || "Unknown"}
                        </Link>
                      ) : (
                        s.customerName || "Unknown"
                      )}
                      <div className="text-xs text-gray-400">{s.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3">{s.invoiceNo}</td>
                    <td className="px-4 py-3">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-red-600 text-xs font-medium capitalize">
                        {s.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.dueDate ? (
                        <span
                          className={
                            isOverdue(s.dueDate)
                              ? "text-red-600 font-semibold"
                              : "text-gray-600"
                          }
                        >
                          {new Date(s.dueDate).toLocaleDateString()}
                          {isOverdue(s.dueDate) && (
                            <span className="ml-1 text-xs font-medium">(Overdue)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      Rs. {(s.totalAmount - (s.amountPaid ?? s.totalAmount)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Amount"
                          value={payInputs[s._id] || ""}
                          onChange={(e) =>
                            setPayInputs((prev) => ({ ...prev, [s._id]: e.target.value }))
                          }
                          className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="datetime-local"
                          title="Payment date &amp; time (leave blank to use right now)"
                          min={toLocalDateTimeInputValue(s.date)}
                          max={nowDateTimeLocal()}
                          value={payDateInputs[s._id] || ""}
                          onChange={(e) =>
                            setPayDateInputs((prev) => ({ ...prev, [s._id]: e.target.value }))
                          }
                          className="w-48 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => recordPayment(s._id)}
                          disabled={markingId === s._id}
                          className="text-blue-600 hover:underline text-sm disabled:opacity-50 whitespace-nowrap"
                        >
                          Pay
                        </button>
                        <button
                          onClick={() => markPaid(s._id)}
                          disabled={markingId === s._id}
                          className="text-green-600 hover:underline text-sm disabled:opacity-50 whitespace-nowrap"
                        >
                          {markingId === s._id ? "..." : "Mark as Paid"}
                        </button>
                        {s.payments && s.payments.length > 0 && (
                          <button
                            onClick={() => setExpandedId(expandedId === s._id ? null : s._id)}
                            className="text-gray-500 hover:underline text-sm whitespace-nowrap"
                          >
                            {expandedId === s._id ? "Hide History" : "Payment History"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === s._id && s.payments && s.payments.length > 0 && (
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={7} className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Payment History
                        </p>
                        <table className="text-sm">
                          <thead className="text-gray-500 text-left">
                            <tr>
                              <th className="pr-6 py-1">Date</th>
                              <th className="pr-6 py-1 text-right">Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...s.payments].reverse().map((p, i) => (
                              <tr key={i} className="border-t border-gray-200">
                                <td className="pr-6 py-1">
                                  {new Date(p.date).toLocaleString()}
                                </td>
                                <td className="pr-6 py-1 text-right">
                                  Rs. {p.amount.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
