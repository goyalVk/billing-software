import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0.01 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  supplierName: { type: String, required: true, trim: true },
  items: { type: [purchaseItemSchema], required: true, validate: (v) => v.length > 0 },
  itemsTotal: { type: Number, required: true, min: 0 },
  miscAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paymentStatus: {
    type: String,
    enum: ["paid", "due", "partial"],
    default: "paid",
  },
  amountPaid: { type: Number, required: true, min: 0 },
  payments: { type: [paymentSchema], default: [] },
  dueDate: { type: Date },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Purchase", purchaseSchema);
