import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: "" },
  address: { type: String, trim: true, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Supplier", supplierSchema);
