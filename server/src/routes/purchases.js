import express from "express";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import { dayBoundaries, parseLocalDate } from "../utils/dayBoundaries.js";
import { recomputeProductCostBasis } from "../utils/recomputeProductCostBasis.js";

const router = express.Router();

// Applies up to `offerAmount` toward a purchase's outstanding balance owed to the
// supplier, clamped to what's actually owed. Mutates the purchase
// (paymentStatus/amountPaid/payments) but does not save it. Returns the amount
// actually applied. `paymentDate` lets a payment be logged as having happened on
// a manually chosen date (defaults to now).
function applyPaymentToPurchase(purchase, offerAmount, paymentDate) {
  const currentPaid = purchase.amountPaid ?? 0;
  const dueRemaining = purchase.totalAmount - currentPaid;
  const applied = Math.min(offerAmount, dueRemaining);
  if (applied <= 0) return 0;
  const newPaid = currentPaid + applied;
  purchase.amountPaid = newPaid;
  purchase.paymentStatus = newPaid >= purchase.totalAmount ? "paid" : "partial";
  purchase.payments = purchase.payments || [];
  purchase.payments.push({ amount: applied, date: paymentDate || new Date() });
  return applied;
}

// GET /api/purchases?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const filter = { userId: req.user.userId };
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

// GET /api/purchases/dues — all purchases with an outstanding balance owed to a supplier
router.get("/dues", async (req, res) => {
  try {
    const dues = await Purchase.find({
      userId: req.user.userId,
      paymentStatus: { $in: ["due", "partial"] },
    }).sort({ date: -1 });
    res.json(dues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/purchases
router.post("/", async (req, res) => {
  try {
    const userId = req.user.userId;
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

    const paymentStatus = ["due", "partial"].includes(req.body.paymentStatus)
      ? req.body.paymentStatus
      : "paid";

    let dueDate = null;
    if (req.body.dueDate) {
      dueDate = parseLocalDate(req.body.dueDate);
      if (isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: "Invalid due date" });
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

    // Resolve raw quantity/rate/amount per item (no DB writes yet) so itemsTotal —
    // and therefore totalAmount and the partial-payment validation below — are known
    // before any supplier/product records get created or mutated. Validating only
    // after those writes would risk a 400 response following already-applied,
    // unrollback-able stock/rate changes.
    const rawItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const rate = Number(item.rate);
      const sellingRate = Number(item.sellingRate);
      return { ...item, quantity, rate, sellingRate, amount: rate * quantity };
    });
    const itemsTotal = rawItems.reduce((sum, i) => sum + i.amount, 0);
    const totalAmount = itemsTotal + miscAmount;

    let amountPaid;
    if (paymentStatus === "paid") {
      amountPaid = totalAmount;
    } else if (paymentStatus === "due") {
      amountPaid = 0;
    } else {
      const provided = Number(req.body.amountPaid);
      if (!(provided > 0) || provided >= totalAmount) {
        return res.status(400).json({
          message: "Amount paid now must be greater than 0 and less than the total purchase amount",
        });
      }
      amountPaid = provided;
    }

    let supplier;
    if (supplierId) {
      supplier = await Supplier.findOne({ _id: supplierId, userId });
      if (!supplier) {
        return res.status(400).json({ message: "Supplier not found" });
      }
    } else {
      const trimmedName = supplierName.trim();
      supplier = await Supplier.findOne({ name: trimmedName, userId }).collation({
        locale: "en",
        strength: 2,
      });
      if (!supplier) {
        supplier = await Supplier.create({
          userId,
          name: trimmedName,
          phone: (supplierPhone || "").trim(),
        });
      }
    }

    // Resolve/create/update each product using a misc-inclusive
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

      let product = item.productId ? await Product.findOne({ _id: item.productId, userId }) : null;
      if (!product && item.productName) {
        product = await Product.findOne({ name: item.productName.trim(), userId }).collation({
          locale: "en",
          strength: 2,
        });
      }

      if (!product) {
        product = await Product.create({
          userId,
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

    const purchase = await Purchase.create({
      userId,
      supplierId: supplier._id,
      supplierName: supplier.name,
      items: purchaseItems,
      itemsTotal,
      miscAmount,
      totalAmount,
      paymentStatus,
      amountPaid,
      dueDate: paymentStatus === "paid" ? null : dueDate,
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
    const userId = req.user.userId;
    const purchase = await Purchase.findOne({ _id: req.params.id, userId });
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
    // Editing a historical item can change totalAmount out from under an already
    // recorded amountPaid — reclamp so paymentStatus stays consistent.
    purchase.amountPaid = Math.min(purchase.amountPaid ?? 0, purchase.totalAmount);
    purchase.paymentStatus =
      purchase.amountPaid >= purchase.totalAmount
        ? "paid"
        : purchase.amountPaid > 0
        ? "partial"
        : "due";
    await purchase.save();

    const { stock, rate: newRate } = await recomputeProductCostBasis(req.params.productId, userId);
    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, userId },
      { currentStock: stock, purchaseRate: newRate },
      { new: true }
    );

    res.json({ purchase, product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/purchases/:id/mark-paid
router.put("/:id/mark-paid", async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    let paymentDate;
    if (req.body.date) {
      paymentDate = parseLocalDate(req.body.date);
      if (isNaN(paymentDate.getTime())) {
        return res.status(400).json({ message: "Invalid payment date" });
      }
    }

    applyPaymentToPurchase(purchase, purchase.totalAmount - (purchase.amountPaid ?? 0), paymentDate);
    await purchase.save();
    res.json(purchase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/purchases/:id/record-payment — apply an additional payment toward a due/partial purchase
router.put("/:id/record-payment", async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    const amount = Number(req.body.amount);
    if (!(amount > 0)) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    let paymentDate;
    if (req.body.date) {
      paymentDate = parseLocalDate(req.body.date);
      if (isNaN(paymentDate.getTime())) {
        return res.status(400).json({ message: "Invalid payment date" });
      }
    }

    applyPaymentToPurchase(purchase, amount, paymentDate);
    await purchase.save();

    res.json(purchase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
