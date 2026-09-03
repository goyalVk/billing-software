import { useState } from "react";
import { useLocation } from "react-router-dom";
import Products from "./Products.jsx";
import Purchase from "./Purchase.jsx";

const TABS = [
  { key: "stock", label: "Stock List" },
  { key: "purchase", label: "Add Purchase" },
];

export default function Inventory() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab === "purchase" ? "purchase" : "stock");

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Inventory</h2>

      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "stock" ? (
        <Products />
      ) : (
        <Purchase
          initialSupplierId={location.state?.supplierId}
          initialSupplierName={location.state?.supplierName}
        />
      )}
    </div>
  );
}
