import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: (v) => /^\d{10}$/.test(v),
      message: "Mobile number must be exactly 10 digits",
    },
  },
  password: { type: String, required: true },
  shopName: { type: String, trim: true, default: "" },
  securityQuestion: { type: String, required: true, trim: true },
  securityAnswer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified("securityAnswer")) {
    this.securityAnswer = await bcrypt.hash(this.securityAnswer.toLowerCase().trim(), 10);
  }
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.compareSecurityAnswer = function (candidate) {
  return bcrypt.compare(candidate.toLowerCase().trim(), this.securityAnswer);
};

export default mongoose.model("User", userSchema);
