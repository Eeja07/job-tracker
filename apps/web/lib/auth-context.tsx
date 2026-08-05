"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, type User, getToken, setToken, clearToken } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const res = await authApi.me();
      setUser(res.user);
    } catch {
      // Try refresh token seamlessly before clearing auth
      const rfToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
      if (rfToken) {
        try {
          const tokens = await authApi.refreshToken(rfToken);
          setToken(tokens.accessToken);
          if (tokens.refreshToken) localStorage.setItem("refresh_token", tokens.refreshToken);
          const meRes = await authApi.me();
          setUser(meRes.user);
          setLoading(false);
          return;
        } catch {
          clearToken();
        }
      } else {
        clearToken();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setToken(res.accessToken);
    if (res.refreshToken) localStorage.setItem("refresh_token", res.refreshToken);
    setUser(res.user);
  };

  const register = async (email: string, password: string, fullName: string) => {
    const res = await authApi.register({ email, password, fullName });
    setToken(res.accessToken);
    if (res.refreshToken) localStorage.setItem("refresh_token", res.refreshToken);
    setUser(res.user);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearToken();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
