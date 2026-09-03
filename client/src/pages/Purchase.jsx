import { useEffect, useRef, useState } from "react";
import api from "../api/client.js";

let nextLocalKey = 1;

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Purchase({ initialSupplierId, initialSupplierName }) {
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [items, setItems] = useState([]);
  const [miscAmount, setMiscAmount] = useState("0");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchBoxRef = useRef(null);
  const supplierBoxRef = useRef(null);

  useEffect(() => {
    if (initialSupplierId && initialSupplierName) {
      setSupplierQuery(initialSupplierName);
      setSelectedSupplierId(initialSupplierId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSupplierId, initialSupplierName]);

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
    if (!supplierQuery.trim()) {
      setSupplierSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/suppliers", { params: { search: supplierQuery } });
        setSupplierSuggestions(res.data);
        setShowSupplierSuggestions(true);
      } catch {
        setSupplierSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [supplierQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target)) {
        setShowSupplierSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSupplier(supplier) {
    setSupplierQuery(supplier.name);
    setSelectedSupplierId(supplier._id);
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
  }

  function addExistingProduct(product) {
    setItems((prev) => {
      const existing = prev.find((row) => row.productId === product._id);
      if (existing) {
        return prev.map((row) =>
          row.productId === product._id ? { ...row, quantity: row.quantity + 1 } : row
        );
      }
      return [
        ...prev,
        {
          localKey: nextLocalKey++,
          productId: product._id,
          productName: product.name,
          quantity: 1,
          rate: product.purchaseRate,
          sellingRate: product.sellingRate,
        },
      ];
    });
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function addNewProduct(name) {
    setItems((prev) => [
      ...prev,
      {
        localKey: nextLocalKey++,
        productId: null,
        productName: name,
        quantity: 1,
        rate: "",
        sellingRate: "",
      },
    ]);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function updateItem(localKey, field, value) {
    setItems((prev) =>
      prev.map((row) => (row.localKey === localKey ? { ...row, [field]: value } : row))
    );
  }

  function removeItem(localKey) {
    setItems((prev) => prev.filter((row) => row.localKey !== localKey));
  }

  const itemsTotal = items.reduce(
    (sum, row) => sum + (Number(row.rate) || 0) * (Number(row.quantity) || 0),
    0
  );
  const miscAmountNum = Number(miscAmount) || 0;
  const grandTotal = itemsTotal + miscAmountNum;

  function validate() {
    if (!supplierQuery.trim()) return "Supplier name is required";
    if (!purchaseDate) return "Purchase date is required";
    if (items.length === 0) return "Add at least one item";
    for (const row of items) {
      if (!row.quantity || Number(row.quantity) <= 0) return `Quantity for "${row.productName}" must be greater than 0`;
      if (row.rate === "" || Number(row.rate) < 0) return `Purchase rate for "${row.productName}" must be valid`;
      if (row.sellingRate === "" || Number(row.sellingRate) < 0) return `Selling rate for "${row.productName}" must be valid`;
    }
    if (miscAmount !== "" && (isNaN(Number(miscAmount)) || Number(miscAmount) < 0)) {
      return "Miscellaneous amount must be 0 or a positive number";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.post("/purchases", {
        ...(selectedSupplierId
          ? { supplierId: selectedSupplierId }
          : { supplierName: supplierQuery.trim() }),
        items: items.map((row) => ({
          ...(row.productId ? { productId: row.productId } : { productName: row.productName }),
          rate: Number(row.rate),
          sellingRate: Number(row.sellingRate),
          quantity: Number(row.quantity),
        })),
        miscAmount: miscAmountNum,
        date: purchaseDate,
      });
      setSuccess(
        `Purchase saved and stock updated successfully. Grand Total: Rs. ${grandTotal.toFixed(2)}${
          miscAmountNum > 0 ? ` (items Rs. ${itemsTotal.toFixed(2)} + misc Rs. ${miscAmountNum.toFixed(2)})` : ""
        }`
      );
      setSupplierQuery("");
      setSelectedSupplierId(null);
      setItems([]);
      setMiscAmount("0");
      setPurchaseDate(todayStr());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save purchase");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Purchase Entry</h2>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-4 max-w-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-md mb-4 max-w-md">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 max-w-md">
        <div className="relative mb-3" ref={supplierBoxRef}>
          <label className="block text-sm font-medium mb-1">
            Supplier Name
            {selectedSupplierId && (
              <span className="ml-2 text-xs font-normal text-green-600">
                Existing supplier
              </span>
            )}
          </label>
          <input
            type="text"
            placeholder="Search or enter a new supplier name..."
            value={supplierQuery}
            onChange={(e) => {
              setSupplierQuery(e.target.value);
              setSelectedSupplierId(null);
            }}
            onFocus={() => supplierQuery && setShowSupplierSuggestions(true)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showSupplierSuggestions && supplierSuggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
              {supplierSuggestions.map((s) => (
                <li
                  key={s._id}
                  onClick={() => selectSupplier(s)}
                  className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between"
                >
                  <span>{s.name}</span>
                  <span className="text-gray-400">{s.phone}</span>
                </li>
              ))}
            </ul>
          )}
          {showSupplierSuggestions && supplierQuery && supplierSuggestions.length === 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 px-3 py-2 text-sm text-gray-400">
              No matching supplier — will be added as new
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Purchase Date</label>
          <input
            type="date"
            value={purchaseDate}
            max={todayStr()}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Defaults to today — change it to record a past purchase.
          </p>
        </div>
      </div>

      <div className="relative mb-4 max-w-md" ref={searchBoxRef}>
        <input
          type="text"
          placeholder="Search product by name, or type a new product name..."
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
                onClick={() => addExistingProduct(p)}
                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between"
              >
                <span>{p.name}</span>
                <span className="text-gray-400">
                  purchase Rs.{p.purchaseRate} / {p.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
        {showSuggestions && query.trim() && suggestions.length === 0 && (
          <div
            onClick={() => addNewProduct(query.trim())}
            className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer"
          >
            + Add "{query.trim()}" as a new product
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Purchase Rate</th>
              <th className="px-4 py-3 text-right">Selling Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No items added yet. Search and select products above.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.localKey} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">
                  {row.productName}
                  {!row.productId && (
                    <span className="ml-2 text-xs font-normal text-blue-600">(new)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => updateItem(row.localKey, "quantity", e.target.value)}
                    className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.rate}
                    onChange={(e) => updateItem(row.localKey, "rate", e.target.value)}
                    className="w-24 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.sellingRate}
                    onChange={(e) => updateItem(row.localKey, "sellingRate", e.target.value)}
                    className="w-24 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {((Number(row.rate) || 0) * (Number(row.quantity) || 0)).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeItem(row.localKey)}
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 max-w-md">
        <label className="block text-sm font-medium mb-1">
          Miscellaneous Amount
          <span className="ml-1 font-normal text-gray-500">
            (transport/labour/other charges, optional)
          </span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={miscAmount}
          onChange={(e) => setMiscAmount(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end mb-6">
        <div className="text-right">
          <div className="text-sm text-gray-500">
            Items Total: Rs. {itemsTotal.toFixed(2)}
            {miscAmountNum > 0 && <> + Misc: Rs. {miscAmountNum.toFixed(2)}</>}
          </div>
          <div className="text-xl font-bold">
            Grand Total: <span className="text-blue-700">Rs. {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-blue-600 text-white px-6 py-3 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save Purchase"}
      </button>
    </div>
  );
}
