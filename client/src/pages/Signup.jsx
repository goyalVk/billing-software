import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

const emptyForm = {
  name: "",
  mobile: "",
  password: "",
  confirmPassword: "",
  shopName: "",
  securityQuestion: "",
  securityAnswer: "",
};

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function Signup() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        shopName: form.shopName.trim(),
        securityQuestion: form.securityQuestion.trim(),
        securityAnswer: form.securityAnswer,
      });
      login(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create Account">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-3">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mobile Number</label>
          <input
            type="tel"
            value={form.mobile}
            onChange={(e) => update("mobile", e.target.value)}
            className={inputClass}
            maxLength={10}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Shop Name (optional)</label>
          <input
            type="text"
            value={form.shopName}
            onChange={(e) => update("shopName", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm Password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Security Question</label>
          <input
            type="text"
            value={form.securityQuestion}
            onChange={(e) => update("securityQuestion", e.target.value)}
            className={inputClass}
            placeholder="e.g. What is your pet's name?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Security Answer</label>
          <input
            type="text"
            value={form.securityAnswer}
            onChange={(e) => update("securityAnswer", e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
      <p className="text-sm text-center mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
