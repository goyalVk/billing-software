import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

export default function CustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [payInputs, setPayInputs] = useState({});
  const [payDateInputs, setPayDateInputs] = useState({});
  const [showOnlyDues, setShowOnlyDues] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/customers/${id}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

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

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>;
  if (!data) return null;

  const { customer, sales, totalVisits, totalSpent, totalDue } = data;
  const displayedSales = showOnlyDues
    ? sales.filter((s) => s.paymentStatus !== "paid")
    : sales;

  return (
    <div>
      <Link to="/customers" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Customers
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-2xl font-semibold mb-1">{customer.name}</h2>
        <p className="text-gray-500 text-sm mb-4">{customer.phone}</p>
        {customer.address && <p className="text-gray-500 text-sm mb-4">{customer.address}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Visits</p>
            <p className="text-xl font-bold">{totalVisits}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Spent</p>
            <p className="text-xl font-bold text-green-600">Rs. {totalSpent.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Due Amount</p>
            <p className={`text-xl font-bold ${totalDue > 0 ? "text-red-600" : "text-gray-400"}`}>
              Rs. {totalDue.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h3 className="font-semibold">Purchase History</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyDues}
            onChange={(e) => setShowOnlyDues(e.target.checked)}
          />
          Show only dues
        </label>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Original Total</th>
              <th className="px-4 py-3 text-right">Amount Paid</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedSales.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  {showOnlyDues ? "No pending dues." : "No purchase history yet."}
                </td>
              </tr>
            )}
            {displayedSales.map((s) => {
              const amountPaid = s.amountPaid ?? s.totalAmount;
              const remaining = s.totalAmount - amountPaid;
              const isDue = s.paymentStatus !== "paid";
              const hasPayments = s.payments && s.payments.length > 0;
              return (
                <Fragment key={s._id}>
                <tr
                  className={`border-t border-gray-100 ${isDue ? "bg-red-50" : ""}`}
                >
                  <td className="px-4 py-3">{s.invoiceNo}</td>
                  <td className="px-4 py-3">{new Date(s.date).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {s.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">{amountPaid.toFixed(2)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      remaining > 0 ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {remaining.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {s.paymentStatus === "paid" ? (
                      <span className="text-green-600 text-xs font-medium">Paid</span>
                    ) : (
                      <span className="text-red-600 text-xs font-medium capitalize">
                        {s.paymentStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.dueDate ? (
                      <span
                        className={isOverdue(s.dueDate) ? "text-red-600 font-semibold" : "text-gray-600"}
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {isDue && (
                        <>
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
                        </>
                      )}
                      {hasPayments && (
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
                {expandedId === s._id && hasPayments && (
                  <tr className="bg-gray-50 border-t border-gray-100">
                    <td colSpan={9} className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Payment History</p>
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
                              <td className="pr-6 py-1">{new Date(p.date).toLocaleString()}</td>
                              <td className="pr-6 py-1 text-right">Rs. {p.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
