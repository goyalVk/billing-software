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

function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export default function Dues() {
  const [duesType, setDuesType] = useState("customer");
  const [dues, setDues] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [payInputs, setPayInputs] = useState({});
  const [payDateInputs, setPayDateInputs] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const endpoint = duesType === "customer" ? "/sales/dues" : "/purchases/dues";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(endpoint);
      setDues(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setExpandedId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duesType]);

  function switchTab(type) {
    if (type === duesType) return;
    setDuesType(type);
    setSearch("");
  }

  async function markPaid(id) {
    setMarkingId(id);
    try {
      await api.put(`${duesType === "customer" ? "/sales" : "/purchases"}/${id}/mark-paid`, {
        ...(payDateInputs[id] && { date: payDateInputs[id] }),
      });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to mark as paid");
    } finally {
      setMarkingId(null);
    }
  }

  async function recordPayment(id) {
    const amount = Number(payInputs[id]);
    if (!(amount > 0)) {
      alert("Enter a payment amount greater than 0");
      return;
    }
    setMarkingId(id);
    try {
      await api.put(`${duesType === "customer" ? "/sales" : "/purchases"}/${id}/record-payment`, {
        amount,
        ...(payDateInputs[id] && { date: payDateInputs[id] }),
      });
      setPayInputs((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to record payment");
    } finally {
      setMarkingId(null);
    }
  }

  const filteredDues = dues.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (duesType === "customer") {
      return (
        (d.customerName || "").toLowerCase().includes(q) ||
        (d.customerPhone || "").toLowerCase().includes(q)
      );
    }
    return (d.supplierName || "").toLowerCase().includes(q);
  });

  const totalDue = filteredDues.reduce(
    (sum, d) => sum + (d.totalAmount - (d.amountPaid ?? d.totalAmount)),
    0
  );

  const colCount = 7;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Dues</h2>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button
          onClick={() => switchTab("customer")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            duesType === "customer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Customer Dues
        </button>
        <button
          onClick={() => switchTab("supplier")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            duesType === "supplier"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Supplier Dues
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {filteredDues.length} pending {duesType === "customer" ? "invoice(s)" : "purchase(s)"}{" "}
        &middot; Total {duesType === "customer" ? "receivable" : "payable"}:{" "}
        <span className="font-semibold text-red-600">Rs. {totalDue.toFixed(2)}</span>
      </p>

      <input
        type="text"
        placeholder={
          duesType === "customer"
            ? "Search by customer name or mobile number..."
            : "Search by supplier name..."
        }
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
              <th className="px-4 py-3">{duesType === "customer" ? "Customer" : "Supplier"}</th>
              <th className="px-4 py-3">{duesType === "customer" ? "Invoice No" : "Items"}</th>
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
                <td colSpan={colCount} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filteredDues.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-gray-400">
                  {dues.length === 0
                    ? duesType === "customer"
                      ? "No pending dues. Everyone's settled up."
                      : "No pending payments to suppliers."
                    : "No dues match that search."}
                </td>
              </tr>
            )}
            {!loading &&
              filteredDues.map((d) => (
                <Fragment key={d._id}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">
                      {duesType === "customer" ? (
                        <>
                          {d.customerId ? (
                            <Link
                              to={`/customers/${d.customerId}`}
                              className="text-blue-600 hover:underline"
                            >
                              {d.customerName || "Unknown"}
                            </Link>
                          ) : (
                            d.customerName || "Unknown"
                          )}
                          <div className="text-xs text-gray-400">{d.customerPhone}</div>
                        </>
                      ) : d.supplierId ? (
                        <Link to={`/suppliers/${d.supplierId}`} className="text-blue-600 hover:underline">
                          {d.supplierName || "Unknown"}
                        </Link>
                      ) : (
                        d.supplierName || "Unknown"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {duesType === "customer"
                        ? d.invoiceNo
                        : d.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-red-600 text-xs font-medium capitalize">
                        {d.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.dueDate ? (
                        <span
                          className={
                            isOverdue(d.dueDate) ? "text-red-600 font-semibold" : "text-gray-600"
                          }
                        >
                          {new Date(d.dueDate).toLocaleDateString()}
                          {isOverdue(d.dueDate) && (
                            <span className="ml-1 text-xs font-medium">(Overdue)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      Rs. {(d.totalAmount - (d.amountPaid ?? d.totalAmount)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Amount"
                          value={payInputs[d._id] || ""}
                          onChange={(e) =>
                            setPayInputs((prev) => ({ ...prev, [d._id]: e.target.value }))
                          }
                          className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="datetime-local"
                          title="Payment date &amp; time (leave blank to use right now)"
                          min={toLocalDateTimeInputValue(d.date)}
                          max={nowDateTimeLocal()}
                          value={payDateInputs[d._id] || ""}
                          onChange={(e) =>
                            setPayDateInputs((prev) => ({ ...prev, [d._id]: e.target.value }))
                          }
                          className="w-48 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => recordPayment(d._id)}
                          disabled={markingId === d._id}
                          className="text-blue-600 hover:underline text-sm disabled:opacity-50 whitespace-nowrap"
                        >
                          Pay
                        </button>
                        <button
                          onClick={() => markPaid(d._id)}
                          disabled={markingId === d._id}
                          className="text-green-600 hover:underline text-sm disabled:opacity-50 whitespace-nowrap"
                        >
                          {markingId === d._id ? "..." : "Mark as Paid"}
                        </button>
                        {d.payments && d.payments.length > 0 && (
                          <button
                            onClick={() => setExpandedId(expandedId === d._id ? null : d._id)}
                            className="text-gray-500 hover:underline text-sm whitespace-nowrap"
                          >
                            {expandedId === d._id ? "Hide History" : "Payment History"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === d._id && d.payments && d.payments.length > 0 && (
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={colCount} className="px-4 py-3">
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
                            {[...d.payments].reverse().map((p, i) => (
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
