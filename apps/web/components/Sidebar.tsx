"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { LayoutDashboard, FileText, LogOut, User, Sun, Moon, Sparkles, KeyRound, Mail } from "lucide-react";
import NotificationBell from "./NotificationBell";
import styles from "./Sidebar.module.css";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/applications", icon: FileText, label: "Applications" },
  { href: "/dashboard/gmail", icon: Mail, label: "Gmail Sync" },
  { href: "/dashboard/cv-reviewer", icon: Sparkles, label: "CV & AI Reviewer" },
  { href: "/dashboard/api-keys", icon: KeyRound, label: "API Keys Vault" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <div className={styles.logoMark}>JT</div>
            <span className={styles.brandName}>JobTracker</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <NotificationBell />
            <button className={styles.themeToggleBtn} onClick={toggleTheme} title={`Mode ${theme === "dark" ? "Terang" : "Gelap"}`}>
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        <nav className={styles.nav}>
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`${styles.navItem} ${active ? styles.navActive : ""}`}>
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            <User size={13} />
          </div>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{user?.fullName ?? "User"}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Keluar">
          <LogOut size={14} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
