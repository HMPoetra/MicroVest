"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Briefcase,
  FlaskConical,
  Calculator,
  BarChart2,
  LogOut,
  Menu,
  X,
  RefreshCw,
  User,
  Building,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/portfolio", icon: Briefcase, label: "Portofolio" },
  { href: "/simulasi", icon: FlaskConical, label: "Simulasi VaR" },
  { href: "/kalkulator", icon: Calculator, label: "Kalkulator" },
  { href: "/aset", icon: BarChart2, label: "Data Aset" },
  { href: "/profile", icon: User, label: "Kelola Profil" },
  { href: "/business", icon: Building, label: "Kelola Bisnis" },
];

export default function Sidebar({ userName, logoUrl }: { userName?: string; logoUrl?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/prices/sync");
    } finally {
      setSyncing(false);
    }
  };

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: collapsed ? "20px 8px" : "20px 12px",
        transition: "padding 0.2s ease",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          padding: "0 8px",
          marginBottom: 32,
        }}
      >
        <img src="/logo.png" alt="MicroVest Logo" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "hsl(var(--text-primary))", whiteSpace: "nowrap" }}>
            MicroVest
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {!collapsed && (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "hsl(var(--text-muted))",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "0 8px",
              marginBottom: 6,
            }}
          >
            Menu Utama
          </span>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                padding: collapsed ? "10px 0" : "10px 12px",
                borderRadius: 10,
                fontSize: "0.9rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "hsl(var(--primary-dark))" : "hsl(var(--text-secondary))",
                background: isActive
                  ? "rgba(34, 197, 94, 0.1)"
                  : "transparent",
                border: isActive
                  ? "1px solid rgba(34, 197, 94, 0.2)"
                  : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.2s",
                width: "100%",
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn btn-ghost btn-sm"
          title="Sinkronisasi harga emas terbaru"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            gap: collapsed ? 0 : 10,
            padding: collapsed ? "10px 0" : "10px 12px",
            borderRadius: 10,
            fontSize: "0.85rem",
            color: "hsl(var(--text-secondary))",
            width: "100%",
          }}
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} style={{ flexShrink: 0 }} />
          {!collapsed && (syncing ? "Sinkronisasi..." : "Sync Harga")}
        </button>

        <hr className="divider" style={{ margin: collapsed ? "8px 0" : "16px 0" }} />

        {/* User info */}
        <div
          style={{
            padding: collapsed ? "8px 0" : "8px 12px",
            display: "flex",
            flexDirection: collapsed ? "column" : "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={userName ?? "User Logo"}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid hsl(var(--border))",
              }}
              title={collapsed ? (userName ?? "User") : undefined}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
              title={collapsed ? (userName ?? "User") : undefined}
            >
              {userName?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "hsl(var(--text-primary))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName ?? "User"}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="btn btn-ghost"
            style={{ padding: 6, borderRadius: 8 }}
            title="Keluar"
          >
            <LogOut size={16} color="hsl(var(--text-muted))" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{
          width: isCollapsed ? 70 : 230,
          flexShrink: 0,
          height: "100vh",
          position: "sticky",
          top: 0,
          background: "hsl(var(--bg-surface))",
          borderRight: "1px solid hsl(var(--border))",
          display: "none",
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 30,
        }}
        className="sidebar-desktop relative"
      >
        <SidebarContent collapsed={isCollapsed} />
        
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: "absolute",
            top: 24,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: "hsl(var(--bg-surface))",
            border: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            zIndex: 40,
            color: "hsl(var(--text-secondary))",
            transition: "all 0.2s",
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile header */}
      <header
        className="sidebar-mobile-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid hsl(var(--border))",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 12,
          width: "100%",
        }}
      >
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="btn btn-ghost"
          style={{ padding: 6 }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="MicroVest Logo" style={{ width: 30, height: 30, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, color: "hsl(var(--text-primary))" }}>MicroVest</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
          }}
        >
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
            }}
          />
          <aside
            style={{
              position: "relative",
              width: 240,
              height: "100%",
              background: "hsl(var(--bg-surface))",
              borderRight: "1px solid hsl(var(--border))",
              zIndex: 1,
              overflowY: "auto",
            }}
          >
            <SidebarContent collapsed={false} />
          </aside>
        </div>
      )}

      {/* Modal Logout Confirmation */}
      {showLogoutConfirm && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="animate-fade-in-up"
            style={{
              width: "100%",
              maxWidth: 400,
              background: "hsl(var(--bg-surface))",
              borderRadius: "var(--radius-lg)",
              border: "1px solid hsl(var(--border))",
              padding: "28px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              margin: "20px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(225, 29, 72, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "hsl(var(--danger))",
                  marginBottom: 16,
                }}
              >
                <LogOut size={24} />
              </div>
              
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "hsl(var(--text-primary))",
                  marginBottom: 8,
                }}
              >
                Yakin Untuk Keluar?
              </h3>
              
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "hsl(var(--text-secondary))",
                  marginBottom: 24,
                  lineHeight: "1.5",
                }}
              >
                Anda akan keluar dari akun MicroVest Anda.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: "12px 20px" }}
              >
                TIDAK
              </button>
              <button
                onClick={handleLogout}
                className="btn"
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  background: "linear-gradient(135deg, hsl(var(--danger)) 0%, #be123c 100%)",
                  color: "#fff",
                  boxShadow: "0 4px 12px rgba(225, 29, 72, 0.2)",
                  fontWeight: 600,
                }}
              >
                IYA
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: block !important; }
          .sidebar-mobile-header { display: none !important; }
        }
      `}</style>
    </>
  );
}
