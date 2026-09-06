import { createContext, useContext, useEffect, useState } from "react";
import { getToken, getStoredUser, setAuth, clearAuth } from "./storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getToken());

  useEffect(() => {
    function onStorage() {
      setUser(getStoredUser());
      setToken(getToken());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function login(newToken, newUser) {
    setAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    clearAuth();
    setToken(null);
    setUser(null);
  }

  function updateUser(newUser) {
    setUser(newUser);
    const t = getToken();
    if (t) setAuth(t, newUser);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: Boolean(token), login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
