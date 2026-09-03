import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
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

const saleSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  customerName: { type: String, trim: true, default: "" },
  customerPhone: { type: String, trim: true, default: "" },
  items: { type: [saleItemSchema], required: true, validate: (v) => v.length > 0 },
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

export default mongoose.model("Sale", saleSchema);
