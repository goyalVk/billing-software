import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  unit: {
    type: String,
    required: true,
    enum: ["pcs", "kg", "box", "ltr"],
    default: "pcs",
  },
  purchaseRate: { type: Number, required: true, min: 0 },
  sellingRate: { type: Number, required: true, min: 0 },
  currentStock: { type: Number, required: true, min: 0, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

productSchema.index({ name: "text" });

export default mongoose.model("Product", productSchema);
