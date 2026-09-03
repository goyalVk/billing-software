import express from "express";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";

const router = express.Router();

// GET /api/products?search=xyz
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};
    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/:id/purchase-history
router.get("/:id/purchase-history", async (req, res) => {
  try {
    const productId = req.params.id;
    const purchases = await Purchase.find({ "items.productId": productId }).sort({ date: -1 });

    const history = [];
    for (const purchase of purchases) {
      for (const item of purchase.items) {
        if (String(item.productId) === productId) {
          history.push({
            purchaseId: purchase._id,
            date: purchase.date,
            supplierName: purchase.supplierName,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          });
        }
      }
    }

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const { name, unit, purchaseRate, sellingRate, currentStock } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Product name is required" });
    }
    if (purchaseRate == null || purchaseRate < 0 || sellingRate == null || sellingRate < 0) {
      return res.status(400).json({ message: "Valid purchase and selling rate are required" });
    }
    const product = await Product.create({
      name: name.trim(),
      unit,
      purchaseRate,
      sellingRate,
      currentStock: currentStock || 0,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  try {
    const { name, unit, purchaseRate, sellingRate, currentStock } = req.body;
    if (name != null && !name.trim()) {
      return res.status(400).json({ message: "Product name cannot be empty" });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...(name != null && { name: name.trim() }),
        ...(unit != null && { unit }),
        ...(purchaseRate != null && { purchaseRate }),
        ...(sellingRate != null && { sellingRate }),
        ...(currentStock != null && { currentStock }),
      },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
