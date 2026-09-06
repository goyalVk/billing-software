import express from "express";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { authenticate } from "../middleware/authenticate.js";

const router = express.Router();

function publicUser(user) {
  return { id: user._id, name: user.name, mobile: user.mobile, shopName: user.shopName };
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, mobile, password, confirmPassword, shopName, securityQuestion, securityAnswer } =
      req.body;

    if (!name?.trim() || !mobile?.trim() || !password || !confirmPassword) {
      return res.status(400).json({ message: "Name, mobile, password and confirm password are required" });
    }
    if (!securityQuestion?.trim() || !securityAnswer?.trim()) {
      return res.status(400).json({ message: "Security question and answer are required" });
    }
    if (!/^\d{10}$/.test(mobile.trim())) {
      return res.status(400).json({ message: "Mobile number must be exactly 10 digits" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password do not match" });
    }

    const existing = await User.findOne({ mobile: mobile.trim() });
    if (existing) {
      return res.status(400).json({ message: "This mobile number is already registered" });
    }

    const user = await User.create({
      name: name.trim(),
      mobile: mobile.trim(),
      password,
      shopName: shopName?.trim() || "",
      securityQuestion: securityQuestion.trim(),
      securityAnswer,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile?.trim() || !password) {
      return res.status(400).json({ message: "Mobile and password are required" });
    }

    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid mobile number or password" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: "Invalid mobile number or password" });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed" });
  }
});

// POST /api/auth/forgot-password/verify
router.post("/forgot-password/verify", async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile?.trim()) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(404).json({ message: "No account found with this mobile number" });
    }

    res.json({ securityQuestion: user.securityQuestion });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to verify mobile number" });
  }
});

// POST /api/auth/forgot-password/reset
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { mobile, securityAnswer, newPassword, confirmNewPassword } = req.body;
    if (!mobile?.trim() || !securityAnswer?.trim() || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Password and confirm password do not match" });
    }

    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(404).json({ message: "No account found with this mobile number" });
    }

    const answerMatch = await user.compareSecurityAnswer(securityAnswer);
    if (!answerMatch) {
      return res.status(401).json({ message: "Security answer is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to reset password" });
  }
});

// PUT /api/auth/change-password (protected)
router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "New password and confirm password do not match" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to change password" });
  }
});

// GET /api/auth/profile (protected)
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load profile" });
  }
});

// PUT /api/auth/profile (protected) — name and shopName only; mobile is not editable here
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, shopName } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name.trim();
    user.shopName = shopName?.trim() || "";
    await user.save();

    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update profile" });
  }
});

export default router;
