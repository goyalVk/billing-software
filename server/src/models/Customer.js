import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true, unique: true },
  address: { type: String, trim: true, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Customer", customerSchema);
