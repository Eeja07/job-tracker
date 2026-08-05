"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Loader2, Sun, Moon } from "lucide-react";
import styles from "./auth.module.css";

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        if (!form.fullName.trim()) { setError("Nama lengkap wajib diisi"); setSubmitting(false); return; }
        await register(form.email, form.password, form.fullName);
      }
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className={styles.loadingScreen}>
      <Loader2 size={20} className={styles.spinner} />
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <div className={styles.header}>
          <div className={styles.brandRow}>
            <div className={styles.logoMark}>JT</div>
            <button type="button" className={styles.themeToggleBtn} onClick={toggleTheme} title={`Mode ${theme === "dark" ? "Terang" : "Gelap"}`}>
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
          <h1 className={styles.title}>
            {mode === "login" ? "Masuk ke JobTracker" : "Buat Akun JobTracker"}
          </h1>
          <p className={styles.subtitle}>
            {mode === "login"
              ? "Kelola dan pantau seluruh status lamaran kerjamu."
              : "Daftar untuk mulai mencatat lamaran kerja."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "register" && (
            <div className={styles.field}>
              <label className={styles.label}>Nama Lengkap</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Budi Santoso"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                required
              />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="nama@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Minimal 8-12 karakter (huruf besar, angka, simbol)"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.button} disabled={submitting}>
            {submitting ? <Loader2 size={16} className={styles.spinner} /> : (mode === "login" ? "Masuk" : "Daftar")}
          </button>
        </form>

        <div className={styles.footer}>
          {mode === "login" ? (
            <span>
              Belum punya akun?{" "}
              <button type="button" className={styles.switchLink} onClick={() => { setMode("register"); setError(""); }}>
                Daftar sekarang
              </button>
            </span>
          ) : (
            <span>
              Sudah punya akun?{" "}
              <button type="button" className={styles.switchLink} onClick={() => { setMode("login"); setError(""); }}>
                Masuk
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
