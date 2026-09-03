import { useEffect, useRef, useState } from "react";
import api from "../api/client.js";

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Billing() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cart, setCart] = useState([]);
  const [saleDate, setSaleDate] = useState(todayStr());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [knownCustomer, setKnownCustomer] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerDues, setCustomerDues] = useState([]);
  const [customerTotalDue, setCustomerTotalDue] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountPaidNow, setAmountPaidNow] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [completedPreviousDue, setCompletedPreviousDue] = useState(0);
  const searchBoxRef = useRef(null);
  const customerBoxRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/products", { params: { search: query } });
        setSuggestions(res.data);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const phone = customerPhone.trim();
    if (phone.length < 7) {
      setKnownCustomer(false);
      setCustomerDues([]);
      setCustomerTotalDue(0);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/customers/lookup", { params: { phone } });
        if (res.data) {
          setCustomerName(res.data.name);
          setCustomerAddress(res.data.address || "");
          setKnownCustomer(true);
          setCustomerDues(res.data.dues || []);
          setCustomerTotalDue(res.data.totalDue || 0);
        } else {
          setKnownCustomer(false);
          setCustomerDues([]);
          setCustomerTotalDue(0);
        }
      } catch {
        setKnownCustomer(false);
        setCustomerDues([]);
        setCustomerTotalDue(0);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  useEffect(() => {
    const phone = customerPhone.trim();
    if (phone.length < 3) {
      setCustomerSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/customers", { params: { search: phone } });
        setCustomerSuggestions(res.data);
        setShowCustomerSuggestions(true);
      } catch {
        setCustomerSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target)) {
        setShowCustomerSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((row) => row.productId === product._id);
      if (existing) {
        return prev.map((row) =>
          row.productId === product._id ? { ...row, quantity: row.quantity + 1 } : row
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          productName: product.name,
          unit: product.unit,
          rate: product.sellingRate,
          quantity: 1,
        },
      ];
    });
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function selectCustomer(customer) {
    setCustomerPhone(customer.phone);
    setCustomerName(customer.name);
    setCustomerAddress(customer.address || "");
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
  }

  function updateRow(productId, field, value) {
    setCart((prev) =>
      prev.map((row) => (row.productId === productId ? { ...row, [field]: value } : row))
    );
  }

  function removeRow(productId) {
    setCart((prev) => prev.filter((row) => row.productId !== productId));
  }

  const grandTotal = cart.reduce(
    (sum, row) => sum + (Number(row.rate) || 0) * (Number(row.quantity) || 0),
    0
  );

  function validate() {
    if (!saleDate) return "Invoice date is required";
    if (cart.length === 0) return "Add at least one product to the cart";
    for (const row of cart) {
      if (!row.quantity || Number(row.quantity) <= 0) return `Quantity for "${row.productName}" must be greater than 0`;
      if (row.rate === "" || Number(row.rate) < 0) return `Rate for "${row.productName}" must be valid`;
    }
    if (paymentStatus !== "paid" && !customerPhone.trim()) {
      return "A customer WhatsApp number is required to mark a sale as Due or Partial";
    }
    if (paymentStatus === "partial") {
      const amount = Number(amountPaidNow);
      if (customerTotalDue > 0) {
        const combinedTotal = grandTotal + customerTotalDue;
        if (!(amount > 0) || amount > combinedTotal) {
          return `Amount Paid Now must be greater than 0 and at most Rs. ${combinedTotal.toFixed(2)} (current bill + previous due)`;
        }
      } else if (!(amount > 0) || amount >= grandTotal) {
        return "Amount Paid Now must be greater than 0 and less than the total bill amount";
      }
    }
    return "";
  }

  async function handleGenerateInvoice() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/sales", {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        date: saleDate,
        paymentStatus,
        ...(paymentStatus === "partial" && { amountPaid: Number(amountPaidNow) }),
        ...(paymentStatus !== "paid" && dueDate && { dueDate }),
        items: cart.map((row) => ({
          productId: row.productId,
          rate: Number(row.rate),
          quantity: Number(row.quantity),
        })),
      });
      setCompletedSale(res.data);
      setCompletedPreviousDue(customerTotalDue);
      setCart([]);
      setSaleDate(todayStr());
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setKnownCustomer(false);
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
      setCustomerDues([]);
      setCustomerTotalDue(0);
      setPaymentStatus("paid");
      setAmountPaidNow("");
      setDueDate("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate invoice");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadInvoice() {
    if (!completedSale) return;
    window.open(`/api/sales/${completedSale._id}/pdf`, "_blank");
  }

  function sendOnWhatsApp() {
    if (!completedSale?.customerPhone) return;
    const digits = completedSale.customerPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${digits}`, "_blank");
  }

  function startNewBill() {
    setCompletedSale(null);
    setCompletedPreviousDue(0);
  }

  if (completedSale) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Invoice Generated</h2>
        <p className="text-gray-500 mb-1">Invoice No: {completedSale.invoiceNo}</p>
        <p className="text-2xl font-bold text-blue-700 mb-1">
          Rs. {completedSale.totalAmount.toFixed(2)}
        </p>
        <p
          className={`text-sm font-medium ${
            completedSale.paymentStatus === "paid" ? "text-green-600" : "text-red-600"
          }`}
        >
          {completedSale.paymentStatus === "paid" && "Paid"}
          {completedSale.paymentStatus === "due" && "Due"}
          {completedSale.paymentStatus === "partial" &&
            `Partial (Rs. ${completedSale.amountPaid.toFixed(2)} paid, Rs. ${(
              completedSale.totalAmount - completedSale.amountPaid
            ).toFixed(2)} pending)`}
        </p>
        {completedSale.dueDate && (
          <p className="text-xs text-gray-500 mt-1">
            Due date: {new Date(completedSale.dueDate).toLocaleDateString()}
          </p>
        )}

        {completedSale.paymentAllocation &&
          completedSale.paymentAllocation.previousDueBefore > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-4 mb-2 text-left text-sm space-y-1">
              <p className="font-semibold text-gray-700 mb-1">Payment Allocation</p>
              <div className="flex justify-between">
                <span className="text-gray-500">Applied to previous dues</span>
                <span>
                  Rs. {completedSale.paymentAllocation.appliedToPreviousDues.toFixed(2)}
                  {completedSale.paymentAllocation.previousDueAfter === 0
                    ? " (fully cleared)"
                    : ` (Rs. ${completedSale.paymentAllocation.previousDueAfter.toFixed(2)} still due)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Applied to this bill</span>
                <span>Rs. {completedSale.paymentAllocation.appliedToNewBill.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t border-gray-200 mt-1">
                <span>This bill status</span>
                <span className={completedSale.paymentStatus === "paid" ? "text-green-600" : "text-red-600"}>
                  {completedSale.paymentStatus === "paid" && "Paid"}
                  {completedSale.paymentStatus === "due" &&
                    `Due (Rs. ${completedSale.totalAmount.toFixed(2)} pending)`}
                  {completedSale.paymentStatus === "partial" &&
                    `Partial (Rs. ${(
                      completedSale.totalAmount - completedSale.amountPaid
                    ).toFixed(2)} pending)`}
                </span>
              </div>
            </div>
          )}

        {(!completedSale.paymentAllocation || completedSale.paymentAllocation.previousDueBefore === 0) &&
          completedPreviousDue > 0 && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 mt-4 mb-2 text-left">
              Note: this customer still has a separate previous due of{" "}
              <span className="font-semibold text-red-600">
                Rs. {completedPreviousDue.toFixed(2)}
              </span>{" "}
              — unaffected by this invoice.
            </p>
          )}

        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={downloadInvoice}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Download Invoice
          </button>
          <button
            onClick={sendOnWhatsApp}
            disabled={!completedSale.customerPhone}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send on WhatsApp
          </button>
          <button
            onClick={startNewBill}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Start New Bill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Billing</h2>

      <div className="relative mb-4 max-w-md" ref={searchBoxRef}>
        <input
          type="text"
          placeholder="Search product by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowSuggestions(true)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
            {suggestions.map((p) => (
              <li
                key={p._id}
                onClick={() => addToCart(p)}
                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between"
              >
                <span>{p.name}</span>
                <span className="text-gray-400">
                  Rs.{p.sellingRate} / {p.unit} &middot; stock {p.currentStock}
                </span>
              </li>
            ))}
          </ul>
        )}
        {showSuggestions && query && suggestions.length === 0 && (
          <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 px-3 py-2 text-sm text-gray-400">
            No products found
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-4 max-w-md">
          {error}
        </div>
      )}

      <div className="mb-4 max-w-xs">
        <label className="block text-sm font-medium mb-1">Invoice Date</label>
        <input
          type="date"
          value={saleDate}
          max={todayStr()}
          onChange={(e) => setSaleDate(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cart.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Cart is empty. Search and select products above.
                </td>
              </tr>
            )}
            {cart.map((row) => (
              <tr key={row.productId} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{row.productName}</td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.rate}
                    onChange={(e) => updateRow(row.productId, "rate", e.target.value)}
                    className="w-24 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.productId, "quantity", e.target.value)}
                    className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {((Number(row.rate) || 0) * (Number(row.quantity) || 0)).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeRow(row.productId)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-6">
        <div className="text-xl font-bold">
          Grand Total: <span className="text-blue-700">Rs. {grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 max-w-md">
        <h3 className="font-semibold mb-3">Customer Details</h3>
        <div className="space-y-3">
          <div className="relative" ref={customerBoxRef}>
            <label className="block text-sm font-medium mb-1">Customer WhatsApp Number</label>
            <input
              type="text"
              placeholder="e.g. 91xxxxxxxxxx"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                setKnownCustomer(false);
                setCustomerDues([]);
                setCustomerTotalDue(0);
              }}
              onFocus={() => customerPhone.trim().length >= 3 && setShowCustomerSuggestions(true)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showCustomerSuggestions && customerSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
                {customerSuggestions.map((c) => (
                  <li
                    key={c._id}
                    onClick={() => selectCustomer(c)}
                    className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                  >
                    {c.name} - {c.phone}
                  </li>
                ))}
              </ul>
            )}
            {showCustomerSuggestions &&
              customerPhone.trim().length >= 3 &&
              customerSuggestions.length === 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 px-3 py-2 text-sm text-gray-400">
                  No matching customer — will be added as new
                </div>
              )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Customer Name
              {knownCustomer && (
                <span className="ml-2 text-xs font-normal text-green-600">
                  Existing customer
                </span>
              )}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Address <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {knownCustomer && customerDues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 max-w-md">
          <p className="font-semibold text-red-700 mb-2">
            Previous Due: Rs. {customerTotalDue.toFixed(2)}
          </p>
          <table className="w-full text-xs">
            <thead className="text-red-500 text-left">
              <tr>
                <th className="pr-2 py-1">Invoice No</th>
                <th className="pr-2 py-1">Date</th>
                <th className="pr-2 py-1 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {customerDues.map((d) => (
                <tr key={d.saleId} className="border-t border-red-100">
                  <td className="pr-2 py-1">{d.invoiceNo}</td>
                  <td className="pr-2 py-1">{new Date(d.date).toLocaleDateString()}</td>
                  <td className="pr-2 py-1 text-right">{d.remaining.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {knownCustomer && customerTotalDue > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 max-w-md">
          <h3 className="font-semibold mb-3">Payable Today</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Bill Amount</span>
              <span>Rs. {grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Previous Due</span>
              <span>Rs. {customerTotalDue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-gray-200 mt-1">
              <span>Total Payable Today</span>
              <span>Rs. {(grandTotal + customerTotalDue).toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            This is for your reference only — the new invoice total below does not include the
            previous due, which stays tracked as a separate outstanding amount.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 max-w-md">
        <h3 className="font-semibold mb-3">Payment Status</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="paymentStatus"
              checked={paymentStatus === "paid"}
              onChange={() => setPaymentStatus("paid")}
            />
            Paid
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="paymentStatus"
              checked={paymentStatus === "due"}
              onChange={() => setPaymentStatus("due")}
            />
            Due
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="paymentStatus"
              checked={paymentStatus === "partial"}
              onChange={() => setPaymentStatus("partial")}
            />
            Partial
          </label>
        </div>

        {(paymentStatus === "due" || paymentStatus === "partial") && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">
              Due Date <span className="font-normal text-gray-400">(optional, for reminders)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              min={saleDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {paymentStatus === "due" && (
          <p className="text-xs text-gray-500 mt-2">
            A customer WhatsApp number is required to track this as a due amount.
          </p>
        )}
        {paymentStatus === "partial" && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">
              Amount Paid Now (max Rs.{" "}
              {(customerTotalDue > 0 ? grandTotal + customerTotalDue : grandTotal).toFixed(2)})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountPaidNow}
              onChange={(e) => setAmountPaidNow(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {customerTotalDue > 0 ? (
              <p className="text-xs text-gray-500 mt-2">
                This customer has a previous due of Rs. {customerTotalDue.toFixed(2)}. Payment is
                applied to the oldest previous dues first, then to this bill (Rs.{" "}
                {grandTotal.toFixed(2)}). Must be greater than 0 and at most Rs.{" "}
                {(grandTotal + customerTotalDue).toFixed(2)}.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                Must be greater than 0 and less than the total bill amount (Rs.{" "}
                {grandTotal.toFixed(2)}). A customer WhatsApp number is required.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleGenerateInvoice}
        disabled={submitting}
        className="bg-blue-600 text-white px-6 py-3 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Generating..." : "Generate Invoice"}
      </button>
    </div>
  );
}
