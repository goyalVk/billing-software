import express from "express";
import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const router = express.Router();

// GET /api/suppliers?search=xyz — list with purchase summary
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const match = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { phone: { $regex: escapeRegex(search), $options: "i" } },
          ],
        }
      : {};

    const suppliers = await Supplier.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "purchases",
          localField: "_id",
          foreignField: "supplierId",
          as: "purchases",
        },
      },
      {
        $addFields: {
          totalPurchases: { $size: "$purchases" },
          totalPaid: { $sum: "$purchases.totalAmount" },
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
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const purchases = await Purchase.find({ supplierId: supplier._id }).sort({ date: -1 });
    const totalPurchases = purchases.length;
    const totalPaid = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

    res.json({ supplier, purchases, totalPurchases, totalPaid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
