import express from "express";
import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import { dayBoundaries } from "../utils/dayBoundaries.js";

const router = express.Router();

function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvField(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, headers) {
  const lines = [headers.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvField(row[h])).join(","));
  }
  return lines.join("\r\n");
}

// GET /api/dashboard/summary?date=YYYY-MM-DD
router.get("/summary", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { start, end } = dayBoundaries(req.query.date);

    const [sales, purchases] = await Promise.all([
      Sale.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: -1 }),
      Purchase.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: -1 }),
    ]);

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalDue = sales.reduce(
      (sum, s) => sum + (s.totalAmount - (s.amountPaid ?? s.totalAmount)),
      0
    );

    // Low stock is a current-inventory snapshot, independent of the selected date.
    const allProducts = await Product.find(
      { userId },
      { name: 1, currentStock: 1, lowStockThreshold: 1 }
    );
    const lowStockItems = allProducts
      .filter((p) => p.currentStock <= (p.lowStockThreshold ?? 5))
      .map((p) => ({
        _id: p._id,
        name: p.name,
        currentStock: p.currentStock,
        lowStockThreshold: p.lowStockThreshold ?? 5,
      }));

    res.json({
      date: formatLocalDate(start),
      totalSales,
      totalPurchases,
      totalDue,
      sales,
      purchases,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/daily-report?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/daily-report", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "'from' and 'to' date query params are required" });
    }

    const { start: rangeStart } = dayBoundaries(from);
    const { start: rangeEnd } = dayBoundaries(to);
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return res.status(400).json({ message: "Invalid 'from' or 'to' date" });
    }
    if (rangeStart > rangeEnd) {
      return res.status(400).json({ message: "'from' date must be on or before 'to' date" });
    }

    const dayCount = Math.round((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)) + 1;
    if (dayCount > 366) {
      return res.status(400).json({ message: "Date range is too large (max 366 days)" });
    }

    const report = [];
    for (let i = 0; i < dayCount; i++) {
      const day = new Date(rangeEnd);
      day.setDate(day.getDate() - i);
      const dateStr = formatLocalDate(day);
      const { start, end } = dayBoundaries(dateStr);

      const [sales, purchases] = await Promise.all([
        Sale.find({ userId, date: { $gte: start, $lte: end } }),
        Purchase.find({ userId, date: { $gte: start, $lte: end } }),
      ]);

      const totalSale = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalPurchase = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
      const totalDue = sales.reduce(
        (sum, s) => sum + (s.totalAmount - (s.amountPaid ?? s.totalAmount)),
        0
      );

      report.push({
        date: dateStr,
        totalSale,
        totalPurchase,
        totalDue,
        net: totalSale - totalPurchase,
      });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/export-csv?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/export-csv", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "'from' and 'to' date query params are required" });
    }

    const { start: rangeStart } = dayBoundaries(from);
    const { end: rangeEnd } = dayBoundaries(to);
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return res.status(400).json({ message: "Invalid 'from' or 'to' date" });
    }
    if (rangeStart > rangeEnd) {
      return res.status(400).json({ message: "'from' date must be on or before 'to' date" });
    }

    const [sales, purchases] = await Promise.all([
      Sale.find({ userId, date: { $gte: rangeStart, $lte: rangeEnd } }),
      Purchase.find({ userId, date: { $gte: rangeStart, $lte: rangeEnd } }),
    ]);

    const rows = [
      ...sales.map((s) => ({
        sortDate: new Date(s.date),
        date: new Date(s.date).toLocaleString(),
        type: "Sale",
        reference: s.invoiceNo,
        party: s.customerName || "Walk-in",
        amount: s.totalAmount.toFixed(2),
        paymentStatus: s.paymentStatus,
      })),
      ...purchases.map((p) => ({
        sortDate: new Date(p.date),
        date: new Date(p.date).toLocaleString(),
        type: "Purchase",
        reference: String(p._id),
        party: p.supplierName,
        amount: p.totalAmount.toFixed(2),
        paymentStatus: "-",
      })),
    ].sort((a, b) => a.sortDate - b.sortDate);

    const csv = toCsv(rows, ["date", "type", "reference", "party", "amount", "paymentStatus"]);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions-${from}-to-${to}.csv`
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
