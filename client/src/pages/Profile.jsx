import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: "", shopName: "" });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/auth/profile");
        setForm({ name: res.data.name, shopName: res.data.shopName || "" });
      } catch {
        if (user) setForm({ name: user.name, shopName: user.shopName || "" });
      }
    }
    load();
  }, []);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);
    try {
      const res = await api.put("/auth/profile", {
        name: form.name.trim(),
        shopName: form.shopName.trim(),
      });
      updateUser(res.data);
      setProfileSuccess("Profile updated");
    } catch (err) {
      setProfileError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    setPwLoading(true);
    try {
      await api.put("/auth/change-password", pw);
      setPwSuccess("Password changed successfully");
      setPw({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setPwError(err.response?.data?.message || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-2xl font-semibold">Profile</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Account Details</h3>
        {profileError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-3">
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-md mb-3">
            {profileSuccess}
          </div>
        )}
        <form onSubmit={handleProfileSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Mobile Number</label>
            <input
              type="text"
              value={user?.mobile || ""}
              disabled
              className={`${inputClass} bg-gray-100 text-gray-500`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shop Name</label>
            <input
              type="text"
              value={form.shopName}
              onChange={(e) => setForm({ ...form, shopName: e.target.value })}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={profileLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {profileLoading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
        {pwError && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md mb-3">{pwError}</div>
        )}
        {pwSuccess && (
          <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-md mb-3">
            {pwSuccess}
          </div>
        )}
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input
              type="password"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pw.confirmNewPassword}
              onChange={(e) => setPw({ ...pw, confirmNewPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pwLoading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
