import mongoose from "mongoose";
import express from "express";
import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const router = express.Router();

// GET /api/suppliers?search=xyz — list with purchase summary
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const match = { userId };
    if (search) {
      match.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { phone: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const suppliers = await Supplier.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "purchases",
          let: { supplierId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$supplierId", "$$supplierId"] }, { $eq: ["$userId", userId] }] } } },
          ],
          as: "purchases",
        },
      },
      {
        $addFields: {
          totalPurchases: { $size: "$purchases" },
          totalPaid: { $sum: "$purchases.amountPaid" },
          totalDue: {
            $subtract: [{ $sum: "$purchases.totalAmount" }, { $sum: "$purchases.amountPaid" }],
          },
          lastPurchase: { $max: "$purchases.date" },
        },
      },
      { $project: { purchases: 0 } },
      { $sort: { name: 1 } },
    ]);

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/suppliers — manually add a supplier
router.post("/", async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Supplier name is required" });
    }
    const supplier = await Supplier.create({
      userId: req.user.userId,
      name: name.trim(),
      phone: (phone || "").trim(),
      address: (address || "").trim(),
    });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/suppliers/:id — detail with full purchase history
router.get("/:id", async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const purchases = await Purchase.find({
      supplierId: supplier._id,
      userId: req.user.userId,
    }).sort({ date: -1 });
    const totalPurchases = purchases.length;
    const totalPaid = purchases.reduce((sum, p) => sum + (p.amountPaid ?? p.totalAmount), 0);
    const totalDue = purchases.reduce(
      (sum, p) => sum + (p.totalAmount - (p.amountPaid ?? p.totalAmount)),
      0
    );

    res.json({ supplier, purchases, totalPurchases, totalPaid, totalDue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
