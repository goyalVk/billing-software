import { Fragment, useEffect, useState } from "react";
import api from "../api/client.js";

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function firstOfMonthStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fromDate, setFromDate] = useState(addDays(todayStr(), -6));
  const [toDate, setToDate] = useState(todayStr());
  const [dailyReport, setDailyReport] = useState([]);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyReportError, setDailyReportError] = useState("");
  const [expandedDate, setExpandedDate] = useState(null);
  const [dayDetailsCache, setDayDetailsCache] = useState({});
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/dashboard/summary", { params: { date } });
        setSummary(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date]);

  useEffect(() => {
    async function loadReport() {
      if (!fromDate || !toDate) return;
      if (fromDate > toDate) {
        setDailyReportError("'From' date must be on or before 'To' date");
        setDailyReport([]);
        return;
      }
      setDailyReportLoading(true);
      setDailyReportError("");
      try {
        const res = await api.get("/dashboard/daily-report", {
          params: { from: fromDate, to: toDate },
        });
        setDailyReport(res.data);
      } catch (err) {
        setDailyReportError(err.response?.data?.message || "Failed to load daily report");
        setDailyReport([]);
      } finally {
        setDailyReportLoading(false);
      }
    }
    loadReport();
  }, [fromDate, toDate]);

  function applyPreset(preset) {
    const today = todayStr();
    if (preset === "7d") {
      setFromDate(addDays(today, -6));
      setToDate(today);
    } else if (preset === "30d") {
      setFromDate(addDays(today, -29));
      setToDate(today);
    } else if (preset === "month") {
      setFromDate(firstOfMonthStr());
      setToDate(today);
    }
  }

  async function toggleDay(rowDate) {
    if (expandedDate === rowDate) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(rowDate);
    if (!dayDetailsCache[rowDate]) {
      setDayDetailsLoading(true);
      try {
        const res = await api.get("/dashboard/summary", { params: { date: rowDate } });
        setDayDetailsCache((prev) => ({
          ...prev,
          [rowDate]: { sales: res.data.sales, purchases: res.data.purchases },
        }));
      } catch {
        setDayDetailsCache((prev) => ({ ...prev, [rowDate]: { sales: [], purchases: [] } }));
      } finally {
        setDayDetailsLoading(false);
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Date:</label>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-4">{error}</div>
      )}
      {loading && <div className="text-gray-400 text-sm mb-4">Loading...</div>}

      {summary && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">Total Sales</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                Rs. {summary.totalSales.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{summary.sales.length} transaction(s)</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">Total Purchases</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                Rs. {summary.totalPurchases.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{summary.purchases.length} transaction(s)</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">Today's Due Amount</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-600">
                Rs. {summary.totalDue.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {summary.sales.filter((s) => s.paymentStatus !== "paid").length} due invoice(s)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Sales</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 text-left">
                    <tr>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                          No sales on this date.
                        </td>
                      </tr>
                    )}
                    {summary.sales.map((s) => (
                      <tr key={s._id} className="border-t border-gray-100">
                        <td className="px-4 py-2">{s.customerName || "Walk-in"}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {s.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          {s.paymentStatus === "paid" ? (
                            <span className="text-green-600 text-xs font-medium">Paid</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium capitalize">
                              {s.paymentStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">
                          {new Date(s.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Purchases</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 text-left">
                    <tr>
                      <th className="px-4 py-2">Supplier</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.purchases.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                          No purchases on this date.
                        </td>
                      </tr>
                    )}
                    {summary.purchases.map((p) => (
                      <tr key={p._id} className="border-t border-gray-100">
                        <td className="px-4 py-2">{p.supplierName}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {p.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">
                          {new Date(p.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-10">
        <h3 className="text-xl font-semibold mb-4">Daily Report</h3>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={todayStr()}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPreset("7d")}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-100"
            >
              Last 7 days
            </button>
            <button
              onClick={() => applyPreset("30d")}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-100"
            >
              Last 30 days
            </button>
            <button
              onClick={() => applyPreset("month")}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-100"
            >
              This Month
            </button>
          </div>
        </div>

        {dailyReportError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-4">
            {dailyReportError}
          </div>
        )}
        {dailyReportLoading && <div className="text-gray-400 text-sm mb-4">Loading...</div>}

        {!dailyReportLoading && !dailyReportError && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total Sale</th>
                  <th className="px-4 py-3 text-right">Total Purchase</th>
                  <th className="px-4 py-3 text-right">Total Due</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {dailyReport.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      No data for this range.
                    </td>
                  </tr>
                )}
                {dailyReport.map((row) => (
                  <Fragment key={row.date}>
                    <tr
                      onClick={() => toggleDay(row.date)}
                      className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatDisplayDate(row.date)}
                        {row.date === todayStr() && (
                          <span className="ml-2 text-xs font-normal text-blue-600">Today</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{row.totalSale.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{row.totalPurchase.toFixed(2)}</td>
                      <td
                        className={`px-4 py-3 text-right ${
                          row.totalDue > 0 ? "text-red-600 font-medium" : ""
                        }`}
                      >
                        {row.totalDue.toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          row.net >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {row.net.toFixed(2)}
                      </td>
                    </tr>
                    {expandedDate === row.date && (
                      <tr className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={5} className="px-4 py-4">
                          {dayDetailsLoading && !dayDetailsCache[row.date] && (
                            <p className="text-sm text-gray-400">Loading...</p>
                          )}
                          {dayDetailsCache[row.date] && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-2">Sales</p>
                                <table className="w-full text-sm">
                                  <thead className="text-gray-500 text-left">
                                    <tr>
                                      <th className="pr-4 py-1">Customer</th>
                                      <th className="pr-4 py-1 text-right">Amount</th>
                                      <th className="pr-4 py-1">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dayDetailsCache[row.date].sales.length === 0 && (
                                      <tr>
                                        <td colSpan={3} className="py-2 text-gray-400">
                                          No sales.
                                        </td>
                                      </tr>
                                    )}
                                    {dayDetailsCache[row.date].sales.map((s) => (
                                      <tr key={s._id} className="border-t border-gray-200">
                                        <td className="pr-4 py-1">{s.customerName || "Walk-in"}</td>
                                        <td className="pr-4 py-1 text-right">
                                          {s.totalAmount.toFixed(2)}
                                        </td>
                                        <td className="pr-4 py-1">
                                          {s.paymentStatus === "paid" ? (
                                            <span className="text-green-600 text-xs font-medium">
                                              Paid
                                            </span>
                                          ) : (
                                            <span className="text-red-600 text-xs font-medium capitalize">
                                              {s.paymentStatus}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-2">
                                  Purchases
                                </p>
                                <table className="w-full text-sm">
                                  <thead className="text-gray-500 text-left">
                                    <tr>
                                      <th className="pr-4 py-1">Supplier</th>
                                      <th className="pr-4 py-1 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dayDetailsCache[row.date].purchases.length === 0 && (
                                      <tr>
                                        <td colSpan={2} className="py-2 text-gray-400">
                                          No purchases.
                                        </td>
                                      </tr>
                                    )}
                                    {dayDetailsCache[row.date].purchases.map((p) => (
                                      <tr key={p._id} className="border-t border-gray-200">
                                        <td className="pr-4 py-1">{p.supplierName}</td>
                                        <td className="pr-4 py-1 text-right">
                                          {p.totalAmount.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
