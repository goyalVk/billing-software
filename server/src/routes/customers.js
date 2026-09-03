import express from "express";
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";

const router = express.Router();

// GET /api/customers?search=xyz — list with visit/spend summary
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const match = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const customers = await Customer.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "sales",
          localField: "_id",
          foreignField: "customerId",
          as: "sales",
        },
      },
      {
        $addFields: {
          totalVisits: { $size: "$sales" },
          totalSpent: { $sum: "$sales.totalAmount" },
          lastVisit: { $max: "$sales.date" },
        },
      },
      { $project: { sales: 0 } },
      { $sort: { name: 1 } },
    ]);

    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers/lookup?phone=xxx — used by Billing to auto-fill an existing
// customer and show their outstanding dues
router.get("/lookup", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || !phone.trim()) return res.json(null);
    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) return res.json(null);

    const dueSales = await Sale.find({
      customerId: customer._id,
      paymentStatus: { $in: ["due", "partial"] },
    }).sort({ date: -1 });

    const dues = dueSales.map((s) => ({
      saleId: s._id,
      invoiceNo: s.invoiceNo,
      date: s.date,
      remaining: s.totalAmount - (s.amountPaid ?? s.totalAmount),
    }));
    const totalDue = dues.reduce((sum, d) => sum + d.remaining, 0);

    res.json({ ...customer.toObject(), dues, totalDue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers/:id — detail with full purchase history
router.get("/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const sales = await Sale.find({ customerId: customer._id }).sort({ date: -1 });
    const totalVisits = sales.length;
    const totalSpent = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalDue = sales.reduce(
      (sum, s) => sum + (s.totalAmount - (s.amountPaid ?? s.totalAmount)),
      0
    );

    res.json({ customer, sales, totalVisits, totalSpent, totalDue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
