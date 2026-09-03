import express from "express";
import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import { dayBoundaries } from "../utils/dayBoundaries.js";

const router = express.Router();

function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// GET /api/dashboard/summary?date=YYYY-MM-DD
router.get("/summary", async (req, res) => {
  try {
    const { start, end } = dayBoundaries(req.query.date);

    const [sales, purchases] = await Promise.all([
      Sale.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }),
      Purchase.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }),
    ]);

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalDue = sales.reduce(
      (sum, s) => sum + (s.totalAmount - (s.amountPaid ?? s.totalAmount)),
      0
    );

    res.json({
      date: formatLocalDate(start),
      totalSales,
      totalPurchases,
      totalDue,
      sales,
      purchases,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/daily-report?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/daily-report", async (req, res) => {
  try {
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
        Sale.find({ date: { $gte: start, $lte: end } }),
        Purchase.find({ date: { $gte: start, $lte: end } }),
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

export default router;
