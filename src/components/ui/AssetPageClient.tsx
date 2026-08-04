"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { AssetGroup } from "@/types";
import { AssetGrid } from "./AssetGrid";
import { AssetCardSkeleton } from "./AssetCard";
import { RefreshCw, Wifi } from "lucide-react";

const REFRESH_INTERVAL = 60; // detik

export function AssetPageClient({
  initialData,
}: {
  initialData: AssetGroup[];
}) {
  const [groupedAssets, setGroupedAssets] = useState<AssetGroup[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [syncError, setSyncError] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!json.error) {
        setGroupedAssets(json.data);
        setLastUpdated(new Date());
        setSyncError(false);
      }
    } catch {
      setSyncError(true);
    }
  }, []);

  const doRefresh = useCallback(async () => {
    setLoading(true);
    // Panggil sync terlebih dahulu agar harga terbaru masuk DB
    try {
      await fetch("/api/prices/sync");
    } catch {
      // sync optional, lanjutkan fetch assets
    }
    await fetchAssets();
    setLoading(false);
    setCountdown(REFRESH_INTERVAL);
  }, [fetchAssets]);

  // Countdown timer — tick setiap 1 detik
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL;
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Auto-refresh setiap REFRESH_INTERVAL detik
  useEffect(() => {
    refreshRef.current = setInterval(doRefresh, REFRESH_INTERVAL * 1000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [doRefresh]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const skeletonGroups =
    groupedAssets.length === 0
      ? [{ count: 3 }, { count: 4 }, { count: 2 }]
      : [];

  return (
    <div className="animate-fade-in-up w-full flex-1">
      {/* Header */}
      <div className="mb-8">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.7rem",
                fontWeight: 800,
                color: "hsl(var(--text-primary))",
                marginBottom: 4,
              }}
            >
              Data Aset
            </h1>
            <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.95rem" }}>
              Harga instrumen investasi diperbarui otomatis setiap {REFRESH_INTERVAL} detik.
            </p>
          </div>

          {/* Live badge + controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* LIVE badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: syncError
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(34, 197, 94, 0.1)",
                border: `1px solid ${syncError ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                fontSize: "0.78rem",
                fontWeight: 700,
                color: syncError ? "hsl(var(--danger))" : "hsl(var(--primary))",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: syncError ? "hsl(var(--danger))" : "hsl(var(--primary))",
                  animation: syncError ? "none" : "pulse 2s infinite",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <Wifi size={12} />
              {syncError ? "Error" : "LIVE"}
            </div>

            {/* Countdown */}
            {!loading && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "hsl(var(--text-muted))",
                  whiteSpace: "nowrap",
                }}
              >
                Refresh dalam{" "}
                <span style={{ fontWeight: 700, color: "hsl(var(--text-secondary))" }}>
                  {countdown}s
                </span>
              </div>
            )}

            {/* Manual refresh button */}
            <button
              onClick={doRefresh}
              title="Refresh sekarang"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--bg-surface))",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "hsl(var(--text-secondary))",
                transition: "all 0.2s",
              }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              {loading ? "Updating..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Last updated */}
        <div
          style={{
            marginTop: 8,
            fontSize: "0.75rem",
            color: "hsl(var(--text-muted))",
          }}
        >
          Terakhir diperbarui: {formatTime(lastUpdated)}
        </div>
      </div>

      {/* Grid aset — selalu accessible, tidak pernah di-blur/disabled */}
      <div style={{ position: "relative" }}>
        {/* Skeleton hanya saat data belum ada sama sekali (first load kosong) */}
        {skeletonGroups.length > 0 ? (
          <div className="flex flex-col gap-10">
            {skeletonGroups.map((g, gi) => (
              <div key={gi}>
                <div className="h-7 w-40 bg-slate-200 rounded animate-pulse mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: g.count }).map((_, i) => (
                    <AssetCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AssetGrid groupedAssets={groupedAssets} />
        )}
      </div>

      {/* Toast indicator — muncul di pojok kanan bawah, tidak menghalangi konten */}
      {loading && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 99,
            background: "hsl(var(--bg-surface))",
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "hsl(var(--text-secondary))",
            animation: "slideUp 0.2s ease",
          }}
        >
          <RefreshCw size={13} className="animate-spin" style={{ color: "hsl(var(--primary))" }} />
          Memperbarui harga...
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
