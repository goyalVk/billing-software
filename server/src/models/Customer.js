import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, trim: true, default: "" },
  createdAt: { type: Date, default: Date.now },
});

// Phone only needs to be unique within one shop owner's own customer list —
// two different users may each have a customer with the same phone number.
customerSchema.index({ userId: 1, phone: 1 }, { unique: true });

export default mongoose.model("Customer", customerSchema);
