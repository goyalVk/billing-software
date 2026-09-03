import express from "express";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import { dayBoundaries, parseLocalDate } from "../utils/dayBoundaries.js";
import { recomputeProductCostBasis } from "../utils/recomputeProductCostBasis.js";

const router = express.Router();

// GET /api/purchases?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const filter = {};
    if (date) {
      const { start, end } = dayBoundaries(date);
      filter.date = { $gte: start, $lte: end };
    }
    const purchases = await Purchase.find(filter).sort({ date: -1 });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/purchases
router.post("/", async (req, res) => {
  try {
    const { supplierId, supplierName, supplierPhone, items } = req.body;
    const miscAmount = req.body.miscAmount == null || req.body.miscAmount === "" ? 0 : Number(req.body.miscAmount);

    if (!supplierId && (!supplierName || !supplierName.trim())) {
      return res.status(400).json({ message: "Supplier name is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }
    if (isNaN(miscAmount) || miscAmount < 0) {
      return res.status(400).json({ message: "Miscellaneous amount must be 0 or a positive number" });
    }
    let purchaseDate = new Date();
    if (req.body.date) {
      purchaseDate = parseLocalDate(req.body.date);
      if (isNaN(purchaseDate.getTime())) {
        return res.status(400).json({ message: "Invalid purchase date" });
      }
    }
    for (const item of items) {
      const hasProduct = item.productId || (item.productName && item.productName.trim());
      if (!hasProduct) {
        return res.status(400).json({ message: "Each item needs a product" });
      }
      if (!item.quantity || item.quantity <= 0 || item.rate == null || item.rate < 0) {
        return res.status(400).json({
          message: "Each item needs quantity > 0 and a purchase rate >= 0",
        });
      }
      if (item.sellingRate == null || item.sellingRate < 0) {
        return res.status(400).json({ message: "Each item needs a selling rate >= 0" });
      }
    }

    let supplier;
    if (supplierId) {
      supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        return res.status(400).json({ message: "Supplier not found" });
      }
    } else {
      const trimmedName = supplierName.trim();
      supplier = await Supplier.findOne({ name: trimmedName }).collation({
        locale: "en",
        strength: 2,
      });
      if (!supplier) {
        supplier = await Supplier.create({
          name: trimmedName,
          phone: (supplierPhone || "").trim(),
        });
      }
    }

    // First pass: resolve raw quantity/rate/amount per item (no DB writes yet)
    // so itemsTotal is known before allocating the shared misc amount.
    const rawItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const rate = Number(item.rate);
      const sellingRate = Number(item.sellingRate);
      return { ...item, quantity, rate, sellingRate, amount: rate * quantity };
    });
    const itemsTotal = rawItems.reduce((sum, i) => sum + i.amount, 0);

    // Second pass: resolve/create/update each product using a misc-inclusive
    // effective cost rate (each item's share of transport/labour/other charges,
    // allocated proportionally to its amount), so the true landed cost feeds the
    // weighted-average purchaseRate. The Purchase record itself still stores each
    // item's raw agreed rate/amount — misc is purchase-level overhead, not a
    // per-item contractual price. Sequential because each existing product's
    // weighted-average purchase rate depends on reading its current stock/rate
    // before writing.
    const purchaseItems = [];
    for (const item of rawItems) {
      const allocatedMisc = itemsTotal > 0 ? (item.amount / itemsTotal) * miscAmount : 0;
      const effectiveRate = item.quantity > 0 ? (item.amount + allocatedMisc) / item.quantity : item.rate;

      let product = item.productId ? await Product.findById(item.productId) : null;
      if (!product && item.productName) {
        product = await Product.findOne({ name: item.productName.trim() }).collation({
          locale: "en",
          strength: 2,
        });
      }

      if (!product) {
        product = await Product.create({
          name: (item.productName || "").trim(),
          unit: "pcs",
          purchaseRate: Math.round(effectiveRate * 100) / 100,
          sellingRate: item.sellingRate,
          currentStock: item.quantity,
        });
      } else {
        const existingStock = product.currentStock;
        const newStock = existingStock + item.quantity;
        const weightedRate =
          Math.round(
            ((existingStock * product.purchaseRate + item.quantity * effectiveRate) / newStock) * 100
          ) / 100;
        product.currentStock = newStock;
        product.purchaseRate = weightedRate;
        product.sellingRate = item.sellingRate;
        await product.save();
      }

      purchaseItems.push({
        productId: product._id,
        productName: product.name,
        rate: item.rate,
        quantity: item.quantity,
        amount: item.amount,
      });
    }

    const totalAmount = itemsTotal + miscAmount;

    const purchase = await Purchase.create({
      supplierId: supplier._id,
      supplierName: supplier.name,
      items: purchaseItems,
      itemsTotal,
      miscAmount,
      totalAmount,
      date: purchaseDate,
    });

    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/purchases/:id/items/:productId — correct a single item's date/quantity/rate
// on a historical purchase entry. Recomputes that purchase's totals and, since the
// product's moving-average purchase rate depends on chronological order, replays
// the product's full purchase/sale history to rebuild its stock and rate.
router.put("/:id/items/:productId", async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    const item = purchase.items.find(
      (i) => String(i.productId) === req.params.productId
    );
    if (!item) {
      return res.status(404).json({ message: "This product is not part of that purchase" });
    }

    const { quantity, rate, date } = req.body;
    if (quantity == null || Number(quantity) <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }
    if (rate == null || Number(rate) < 0) {
      return res.status(400).json({ message: "Rate must be 0 or greater" });
    }

    item.quantity = Number(quantity);
    item.rate = Number(rate);
    item.amount = item.quantity * item.rate;

    if (date) {
      const parsed = parseLocalDate(date);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }
      purchase.date = parsed;
    }

    purchase.itemsTotal = purchase.items.reduce((sum, i) => sum + i.amount, 0);
    purchase.totalAmount = purchase.itemsTotal + (purchase.miscAmount || 0);
    await purchase.save();

    const { stock, rate: newRate } = await recomputeProductCostBasis(req.params.productId);
    const product = await Product.findByIdAndUpdate(
      req.params.productId,
      { currentStock: stock, purchaseRate: newRate },
      { new: true }
    );

    res.json({ purchase, product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
