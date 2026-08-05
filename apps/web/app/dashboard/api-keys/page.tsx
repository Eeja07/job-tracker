"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { KeyRound, Plus, Trash2, CheckCircle2, ShieldCheck, Cpu, ExternalLink } from "lucide-react";
import styles from "./page.module.css";

export interface ApiKeyEntry {
  id: string;
  name: string;
  provider: "groq" | "openrouter" | "gemini";
  key: string;
  isActive: boolean;
  createdAt: string;
}

export default function ApiKeysVaultPage() {
  const { user } = useAuth();
  const userId = user?.id || "";

  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"groq" | "openrouter" | "gemini">("groq");
  const [keyValue, setKeyValue] = useState("");

  useEffect(() => {
    if (!userId) return;
    const raw = localStorage.getItem(`api_vault_${userId}`);
    if (raw) {
      try {
        setKeys(JSON.parse(raw));
      } catch {}
    }
  }, [userId]);

  const saveKeysToStorage = (updatedKeys: ApiKeyEntry[]) => {
    setKeys(updatedKeys);
    if (userId) {
      localStorage.setItem(`api_vault_${userId}`, JSON.stringify(updatedKeys));
    }
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !keyValue.trim()) {
      alert("Silakan isi nama label dan nilai API Key.");
      return;
    }

    // If it's the first key for this provider, mark it active automatically
    const existingProviderKeys = keys.filter(k => k.provider === provider);
    const newEntry: ApiKeyEntry = {
      id: "key_" + Date.now(),
      name: name.trim(),
      provider,
      key: keyValue.trim(),
      isActive: existingProviderKeys.length === 0,
      createdAt: new Date().toISOString()
    };

    const updated = [newEntry, ...keys];
    saveKeysToStorage(updated);

    setName("");
    setKeyValue("");
  };

  const handleToggleActive = (id: string) => {
    const targetKey = keys.find(k => k.id === id);
    if (!targetKey) return;

    // Set active key for this specific provider
    const updated = keys.map(k => {
      if (k.provider === targetKey.provider) {
        return { ...k, isActive: k.id === id };
      }
      return k;
    });

    saveKeysToStorage(updated);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus API Key ini?")) return;
    const updated = keys.filter(k => k.id !== id);
    saveKeysToStorage(updated);
  };

  const maskKey = (key: string) => {
    if (key.length <= 10) return "••••••••••••";
    return key.substring(0, 7) + "••••••••••••" + key.substring(key.length - 4);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <KeyRound size={22} />
          API Keys Vault
        </h1>
        <p className={styles.subtitle}>
          Simpan dan kelola beberapa API Key sekaligus untuk provider Groq, OpenRouter, atau Gemini.
        </p>
      </div>

      {/* Add New Key Card */}
      <div className={styles.addCard}>
        <h2 className={styles.cardTitle}>
          <Plus size={16} /> Tambah API Key Baru
        </h2>
        <form onSubmit={handleAddKey} className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>PROVIDER AI</label>
            <select
              className={styles.select}
              value={provider}
              onChange={e => setProvider(e.target.value as any)}
            >
              <option value="groq">Groq Cloud</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>NAMA LABEL (MISAL: GROQ UTAMA)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Contoh: Groq Account #1, Backup Key..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>API KEY / TOKEN</label>
            <input
              type="password"
              className={styles.input}
              placeholder={provider === "groq" ? "gsk_..." : provider === "openrouter" ? "sk-or-..." : "AIzaSy..."}
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.addBtn}>
            <Plus size={15} /> Simpan Key
          </button>
        </form>
      </div>

      {/* Keys List */}
      <div className={styles.keysList}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className={styles.cardTitle}>
            <ShieldCheck size={16} /> Daftar API Key Tersimpan ({keys.length})
          </h2>
        </div>

        {keys.length === 0 ? (
          <div className={styles.emptyBox}>
            <Cpu size={28} style={{ opacity: 0.4 }} />
            <p>Belum ada API Key tersimpan di Vault Anda.</p>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Tambahkan API Key Groq, OpenRouter, atau Gemini Anda di atas untuk digunakan pada CV Reviewer.
            </span>
          </div>
        ) : (
          keys.map(k => {
            const badgeClass =
              k.provider === "groq"
                ? styles.badgeGroq
                : k.provider === "openrouter"
                ? styles.badgeOpenrouter
                : styles.badgeGemini;

            return (
              <div key={k.id} className={`${styles.keyItem} ${k.isActive ? styles.keyItemActive : ""}`}>
                <div className={styles.keyLeft}>
                  <span className={`${styles.providerBadge} ${badgeClass}`}>
                    {k.provider === "groq" ? "Groq" : k.provider === "openrouter" ? "OpenRouter" : "Gemini"}
                  </span>
                  <div className={styles.keyMeta}>
                    <span className={styles.keyName}>{k.name}</span>
                    <span className={styles.keyMasked}>{maskKey(k.key)}</span>
                  </div>
                </div>

                <div className={styles.keyActions}>
                  <button
                    className={`${styles.activeToggle} ${k.isActive ? styles.activeToggleIsActive : ""}`}
                    onClick={() => handleToggleActive(k.id)}
                    title={k.isActive ? "Key ini sedang aktif" : "Aktifkan key ini"}
                  >
                    <CheckCircle2 size={13} />
                    <span>{k.isActive ? "Aktif Digunakan" : "Set Aktif"}</span>
                  </button>

                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(k.id)}
                    title="Hapus Key"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
