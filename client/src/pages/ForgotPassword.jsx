import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import AuthLayout from "../components/AuthLayout.jsx";

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password/verify", { mobile: mobile.trim() });
      setSecurityQuestion(res.data.securityQuestion);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Could not verify mobile number");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password/reset", {
        mobile: mobile.trim(),
        securityAnswer,
        newPassword,
        confirmNewPassword,
      });
      setSuccess("Password reset successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Forgot Password">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-md mb-3">
          {success}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleVerify} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className={inputClass}
              maxLength={10}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleReset} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Security Question</label>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              {securityQuestion}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your Answer</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}

      <p className="text-sm text-center mt-4">
        <Link to="/login" className="text-blue-600 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
