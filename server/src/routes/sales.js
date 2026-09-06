import express from "express";
import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Counter from "../models/Counter.js";
import { generateInvoicePdf } from "../utils/generateInvoicePdf.js";
import { dayBoundaries, parseLocalDate } from "../utils/dayBoundaries.js";

const router = express.Router();

async function nextInvoiceNo() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "invoiceNo" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INV-${String(counter.seq).padStart(6, "0")}`;
}

// Applies up to `offerAmount` toward a sale's outstanding balance, clamped to what's
// actually owed. Mutates the sale (paymentStatus/amountPaid/payments) but does not
// save it. Returns the amount actually applied. `paymentDate` lets a payment be
// logged as having happened on a manually chosen date (defaults to now).
function applyPaymentToSale(sale, offerAmount, paymentDate) {
  const currentPaid = sale.amountPaid ?? 0;
  const dueRemaining = sale.totalAmount - currentPaid;
  const applied = Math.min(offerAmount, dueRemaining);
  if (applied <= 0) return 0;
  const newPaid = currentPaid + applied;
  sale.amountPaid = newPaid;
  sale.paymentStatus = newPaid >= sale.totalAmount ? "paid" : "partial";
  sale.payments = sale.payments || [];
  sale.payments.push({ amount: applied, date: paymentDate || new Date() });
  return applied;
}

// GET /api/sales?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const filter = { userId: req.user.userId };
    if (date) {
      const { start, end } = dayBoundaries(date);
      filter.date = { $gte: start, $lte: end };
    }
    const sales = await Sale.find(filter).sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sales/dues — all sales with an outstanding balance
router.get("/dues", async (req, res) => {
  try {
    const dues = await Sale.find({
      userId: req.user.userId,
      paymentStatus: { $in: ["due", "partial"] },
    }).sort({ date: -1 });
    res.json(dues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sales
router.post("/", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { customerName, customerPhone, customerAddress, items } = req.body;
    const paymentStatus = ["due", "partial"].includes(req.body.paymentStatus)
      ? req.body.paymentStatus
      : "paid";

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0 || item.rate == null || item.rate < 0) {
        return res.status(400).json({ message: "Each item needs a valid product, quantity > 0 and rate >= 0" });
      }
    }
    if (paymentStatus !== "paid" && !(customerPhone || "").trim()) {
      return res.status(400).json({
        message: "A customer WhatsApp number is required to track a due or partial amount",
      });
    }

    const validPaymentModes = ["Cash", "UPI", "Card", "Other"];
    const paymentMode = req.body.paymentMode;
    if (paymentStatus !== "due") {
      if (!validPaymentModes.includes(paymentMode)) {
        return res.status(400).json({
          message: "Payment mode is required (Cash, UPI, Card or Other) when marking a sale as Paid or Partial",
        });
      }
    } else if (paymentMode && !validPaymentModes.includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid payment mode" });
    }

    let saleDate = new Date();
    if (req.body.date) {
      saleDate = parseLocalDate(req.body.date);
      if (isNaN(saleDate.getTime())) {
        return res.status(400).json({ message: "Invalid invoice date" });
      }
    }

    let dueDate = null;
    if (req.body.dueDate) {
      dueDate = parseLocalDate(req.body.dueDate);
      if (isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: "Invalid due date" });
      }
    }

    const products = await Product.find({
      _id: { $in: items.map((i) => i.productId) },
      userId,
    });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const saleItems = items.map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      const amount = Number(item.rate) * Number(item.quantity);
      return {
        productId: product._id,
        productName: product.name,
        rate: Number(item.rate),
        quantity: Number(item.quantity),
        amount,
      };
    });

    const subtotal = saleItems.reduce((sum, i) => sum + i.amount, 0);

    const discountPercent = req.body.discountPercent != null ? Number(req.body.discountPercent) : 0;
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({ message: "Discount must be a percentage between 0 and 100" });
    }
    const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    const trimmedPhone = (customerPhone || "").trim();
    const trimmedName = (customerName || "").trim();
    const trimmedAddress = (customerAddress || "").trim();
    let customerId = null;
    let finalCustomerName = trimmedName;

    if (trimmedPhone) {
      let customer = await Customer.findOne({ phone: trimmedPhone, userId });
      if (customer) {
        let changed = false;
        if (trimmedName && customer.name !== trimmedName) {
          customer.name = trimmedName;
          changed = true;
        }
        if (trimmedAddress && customer.address !== trimmedAddress) {
          customer.address = trimmedAddress;
          changed = true;
        }
        if (changed) await customer.save();
      } else {
        customer = await Customer.create({
          userId,
          name: trimmedName || "Unknown",
          phone: trimmedPhone,
          address: trimmedAddress,
        });
      }
      customerId = customer._id;
      finalCustomerName = customer.name;
    }

    let amountPaid;
    let paymentAllocation = null;

    if (paymentStatus === "paid") {
      amountPaid = totalAmount;
    } else if (paymentStatus === "due") {
      amountPaid = 0;
    } else {
      // Previous outstanding invoices for this customer, oldest first — a "partial"
      // payment clears these before anything is applied to the new sale.
      const previousDueSales = customerId
        ? await Sale.find({
            customerId,
            userId,
            paymentStatus: { $in: ["due", "partial"] },
          }).sort({ date: 1 })
        : [];
      const previousDueTotal = previousDueSales.reduce(
        (sum, s) => sum + (s.totalAmount - (s.amountPaid ?? s.totalAmount)),
        0
      );

      const provided = Number(req.body.amountPaid);
      const combinedTotal = totalAmount + previousDueTotal;

      if (previousDueTotal > 0) {
        if (!(provided > 0) || provided > combinedTotal) {
          return res.status(400).json({
            message: `Amount paid now must be greater than 0 and at most Rs. ${combinedTotal.toFixed(2)} (current bill + previous due)`,
          });
        }
      } else if (!(provided > 0) || provided >= totalAmount) {
        return res.status(400).json({
          message: "Amount paid now must be greater than 0 and less than the total bill amount",
        });
      }

      // Allocate the payment to the oldest previous dues first, then whatever's
      // left goes toward this new sale.
      let remaining = provided;
      const allocations = [];
      for (const dueSale of previousDueSales) {
        if (remaining <= 0) break;
        const applied = applyPaymentToSale(dueSale, remaining);
        if (applied > 0) {
          await dueSale.save();
          remaining -= applied;
          allocations.push({
            saleId: dueSale._id,
            invoiceNo: dueSale.invoiceNo,
            appliedAmount: applied,
            newStatus: dueSale.paymentStatus,
          });
        }
      }

      const appliedToPreviousDues = provided - remaining;
      if (remaining >= totalAmount) {
        amountPaid = totalAmount;
      } else if (remaining > 0) {
        amountPaid = remaining;
      } else {
        amountPaid = 0;
      }

      paymentAllocation = {
        previousDueBefore: previousDueTotal,
        appliedToPreviousDues,
        previousDueAfter: previousDueTotal - appliedToPreviousDues,
        appliedToNewBill: amountPaid,
        allocations,
      };
    }

    // The "partial" request status may resolve to paid/due once allocation runs.
    const finalPaymentStatus =
      paymentStatus === "partial"
        ? amountPaid >= totalAmount
          ? "paid"
          : amountPaid > 0
          ? "partial"
          : "due"
        : paymentStatus;

    const invoiceNo = await nextInvoiceNo();

    const sale = await Sale.create({
      userId,
      invoiceNo,
      customerId,
      customerName: finalCustomerName,
      customerPhone: trimmedPhone,
      items: saleItems,
      subtotal,
      discountPercent,
      discountAmount,
      totalAmount,
      paymentStatus: finalPaymentStatus,
      paymentMode: paymentMode || undefined,
      amountPaid,
      dueDate: finalPaymentStatus === "paid" ? null : dueDate,
      date: saleDate,
    });

    for (const item of saleItems) {
      await Product.updateOne(
        { _id: item.productId, userId },
        { $inc: { currentStock: -item.quantity } }
      );
    }

    res.status(201).json({ ...sale.toObject(), paymentAllocation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/sales/:id/mark-paid
router.put("/:id/mark-paid", async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    let paymentDate;
    if (req.body.date) {
      paymentDate = parseLocalDate(req.body.date);
      if (isNaN(paymentDate.getTime())) {
        return res.status(400).json({ message: "Invalid payment date" });
      }
    }

    applyPaymentToSale(sale, sale.totalAmount - (sale.amountPaid ?? 0), paymentDate);
    await sale.save();
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/sales/:id/record-payment — apply an additional payment toward a due/partial sale
router.put("/:id/record-payment", async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!sale) return res.status(404).json({ message: "Sale not found" });

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

    applyPaymentToSale(sale, amount, paymentDate);
    await sale.save();

    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sales/:id/pdf
router.get("/:id/pdf", async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    generateInvoicePdf(res, sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
