"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import {
  FlaskConical, ChevronDown, Info, AlertTriangle, HelpCircle,
  Save, Trash2, BarChart2, X, Check, Sparkles, ShieldCheck,
  TrendingUp, Award, ThumbsUp, Coins, ArrowRight, Eye, RotateCcw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { formatIDR, formatPct, formatNumberSeparator, parseNumberSeparator, formatDateShort } from "@/lib/utils";
import type { Portfolio, VaRResult } from "@/types";

// ─── History record type ──────────────────────────────────────────────────────
interface HistoryRecord {
  id: string;
  label: string | null;
  params: {
    portfolio_id: string;
    confidence: number;
    period_days: number;
    holding_period: number;
    [key: string]: unknown;
  };
  result: {
    var_value: number;
    var_percentage: number;
    confidence: number;
    holding_period: number;
    portfolio_value: number;
    threshold: number;
    num_observations: number;
    mean_return: number;
    std_return: number;
  };
  created_at: string;
  portfolio: { name: string } | null;
}

// ─── Reusable tooltip with ? button ───────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginLeft: 4 }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%",
          background: "hsl(var(--text-muted) / 0.15)",
          border: "none", cursor: "pointer", padding: 0,
          color: "hsl(var(--text-muted))",
          transition: "background 0.15s",
        }}
        aria-label="Info"
      >
        <HelpCircle size={11} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
            transform: "translateX(-50%)",
            background: "hsl(var(--text-primary))",
            color: "#fff",
            borderRadius: 10, padding: "10px 14px",
            fontSize: "0.78rem", lineHeight: 1.55,
            width: 220, zIndex: 200,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute", top: "100%", left: "50%",
              transform: "translateX(-50%)",
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid hsl(var(--text-primary))",
            }}
          />
          {text}
        </div>
      )}
    </div>
  );
}

function SimulasiContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);
  const [portfolioId, setPortfolioId] = useState(searchParams.get("portfolio") ?? "");
  const [confidence, setConfidence] = useState(0.95);
  const [periodDays, setPeriodDays] = useState(252);
  const [holdingPeriod, setHoldingPeriod] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VaRResult | null>(null);
  const [error, setError] = useState("");

  // Save & History states
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Custom portfolio states
  const [availableAssets, setAvailableAssets] = useState<{
    id: string;
    name: string;
    type: string;
    symbol: string;
    unit: string;
    harga_terkini?: number;
    harga_sebelumnya?: number | null;
    persentase_perubahan?: number | null;
  }[]>([]);
  const [customValue, setCustomValue] = useState(10000000);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [goldType, setGoldType] = useState<"ANTAM_1GR" | "ANTAM_5GR" | "UBS_1GR">("ANTAM_1GR");
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [showGoldModal, setShowGoldModal] = useState(false);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<HistoryRecord | null>(null);

  const applyPreset = (preset: "konservatif" | "moderat" | "agresif" | "emas") => {
    if (portfolioId !== "custom") setPortfolioId("custom");
    const newWeights: Record<string, number> = {};
    availableAssets.forEach((a) => { newWeights[a.id] = 0; });

    const gold = availableAssets.find((a) => a.symbol === "ANTAM_1GR") || availableAssets.find((a) => a.type === "emas");
    const rdPasarUang = availableAssets.find((a) => a.name.toLowerCase().includes("likuid") || a.name.toLowerCase().includes("pasar uang") || a.type === "obligasi") || availableAssets.find((a) => a.type === "reksadana");
    const rdSaham = availableAssets.find((a) => a.name.toLowerCase().includes("saham") || a.type === "saham") || availableAssets.find((a) => a.type === "reksadana" && a.id !== rdPasarUang?.id);
    const crypto = availableAssets.find((a) => a.type === "kripto");

    if (preset === "emas") {
      if (gold) newWeights[gold.id] = 100;
    } else if (preset === "konservatif") {
      if (gold && rdPasarUang) {
        newWeights[gold.id] = 60;
        newWeights[rdPasarUang.id] = 40;
      } else if (gold) {
        newWeights[gold.id] = 100;
      }
    } else if (preset === "moderat") {
      if (gold && rdPasarUang && rdSaham) {
        newWeights[gold.id] = 35;
        newWeights[rdPasarUang.id] = 35;
        newWeights[rdSaham.id] = 30;
      } else if (gold && rdSaham) {
        newWeights[gold.id] = 50;
        newWeights[rdSaham.id] = 50;
      } else if (gold) {
        newWeights[gold.id] = 100;
      }
    } else if (preset === "agresif") {
      if (rdSaham && crypto && rdPasarUang) {
        newWeights[rdSaham.id] = 50;
        newWeights[rdPasarUang.id] = 30;
        newWeights[crypto.id] = 20;
      } else if (rdSaham && crypto) {
        newWeights[rdSaham.id] = 70;
        newWeights[crypto.id] = 30;
      } else if (rdSaham) {
        newWeights[rdSaham.id] = 100;
      } else if (gold) {
        newWeights[gold.id] = 100;
      }
    }

    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (sum === 0 && availableAssets.length > 0) {
      newWeights[availableAssets[0].id] = 100;
    }
    setWeights(newWeights);
  };

  useEffect(() => {
    const loadPortfolios = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("portfolios")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at");
      setPortfolios(data ?? []);
      if (!portfolioId && data && data.length > 0) setPortfolioId(data[0].id);
    };

    const loadAssets = async () => {
      const res = await fetch("/api/assets");
      const json = await res.json();
      if (json.data) {
        const flattened = json.data.flatMap((g: any) => g.assets);
        setAvailableAssets(flattened);
        // Pre-fill weights with 0, and ANTAM_1GR with 100
        const initialWeights: Record<string, number> = {};
        flattened.forEach((a: any) => {
          initialWeights[a.id] = a.symbol === "ANTAM_1GR" ? 100 : 0;
        });
        setWeights(initialWeights);
      }
    };

    loadPortfolios();
    loadAssets();
  }, []);

  // ─── History fetch ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/simulate/var/history");
      const json = await res.json();
      if (json.data) setHistory(json.data);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ─── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSavedMsg("");

    const customHoldings = Object.entries(weights)
      .filter(([_, w]) => w > 0)
      .map(([assetId, w]) => ({ asset_id: assetId, weight: w / 100 }));

    await fetch("/api/simulate/var", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        confidence,
        period_days: periodDays,
        holding_period: holdingPeriod,
        custom_holdings: portfolioId === "custom" ? customHoldings : undefined,
        portfolio_value: portfolioId === "custom" ? customValue : undefined,
        save: true,
        label: saveLabel || null,
      }),
    });

    setSaving(false);
    setSavedMsg("✓ Tersimpan!");
    setSaveLabel("");
    fetchHistory();
    setTimeout(() => setSavedMsg(""), 3000);
  };

  // ─── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteHistory = async (id: string) => {
    setDeletingId(id);
    await fetch("/api/simulate/var/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    fetchHistory();
  };

  // ─── Toggle selection ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioId) { setError("Pilih portofolio terlebih dahulu."); return; }

    if (portfolioId === "custom") {
      if (totalWeight !== 100) {
        setError("Total alokasi kustom komposisi portofolio harus bernilai 100%.");
        return;
      }
      if (customValue <= 0) {
        setError("Modal awal investasi harus lebih besar dari 0.");
        return;
      }
    }

    setLoading(true); setError(""); setResult(null);

    const customHoldings = Object.entries(weights)
      .filter(([_, w]) => w > 0)
      .map(([assetId, w]) => ({
        asset_id: assetId,
        weight: w / 100,
      }));

    const res = await fetch("/api/simulate/var", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        confidence,
        period_days: periodDays,
        holding_period: holdingPeriod,
        custom_holdings: portfolioId === "custom" ? customHoldings : undefined,
        portfolio_value: portfolioId === "custom" ? customValue : undefined,
      }),
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      setError(json.error ?? "Terjadi kesalahan simulasi.");
    } else {
      setResult(json.data);
    }
    setLoading(false);
  };

  // Prepare histogram data from returns
  const histogramData = (() => {
    if (!result) return [];
    const returns = result.returns;
    const min = returns[0];
    const max = returns[returns.length - 1];
    const bins = 30;
    const step = (max - min) / bins;
    const counts = Array(bins).fill(0).map((_, i) => ({
      x: min + step * i,
      count: 0,
      isTail: false,
    }));
    returns.forEach((r) => {
      const idx = Math.min(Math.floor((r - min) / step), bins - 1);
      counts[idx].count++;
    });
    // Mark tail bins
    counts.forEach((c) => { c.isTail = c.x <= result.threshold; });
    return counts.map((c) => ({
      label: `${(c.x * 100).toFixed(1)}%`,
      count: c.count,
      isTail: c.isTail,
    }));
  })();

  // ─── Custom allocation items (for recommendation card) ─────────────────────────
  const customAllocationItems = (portfolioId === "custom" && result)
    ? Object.entries(weights)
        .filter(([, w]) => w > 0)
        .flatMap(([assetId, w]) => {
          const asset = availableAssets.find((a) => a.id === assetId);
          if (!asset) return [];
          const amount = (customValue * w) / 100;
          return [{ asset, weight: w, amount }];
        })
    : [];

  const getAssetReason = (type: string): string => {
    if (type === "emas") return "Aset safe haven (lindung nilai) terhadap inflasi, depresiasi mata uang, dan ketidakpastian ekonomi. Cocok sebagai fondasi dan stabilisator portofolio.";
    if (type === "reksadana") return "Instrumen diversifikasi yang dikelola manajer investasi profesional. Menawarkan eksposur pasar lebih luas dengan risiko lebih terukur.";
    if (type === "obligasi") return "Memberikan pendapatan tetap (kupon) secara berkala dengan risiko relatif lebih rendah dibanding saham. Cocok untuk investor konservatif.";
    if (type === "kripto") return "Aset berisiko tinggi dengan volatilitas ekstrem namun berpotensi return besar. Alokasikan hanya sebagian kecil (<10%) dari total portofolio.";
    if (type === "saham") return "Potensi return tinggi mengikuti pertumbuhan perusahaan dengan volatilitas lebih besar. Cocok untuk horizon investasi jangka panjang (>3 tahun).";
    return "Aset investasi umum. Pastikan alokasi sesuai profil risiko dan tujuan investasi Anda.";
  };

  return (
    <div className="animate-fade-in-up w-full flex-1">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
          Simulasi Risiko Kerugian
        </h1>
        <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>
          Cari tahu seberapa besar potensi uang Anda berkurang saat kondisi pasar sedang buruk.
        </p>
      </div>

      {/* Info box */}
      <div
        style={{
          background: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          display: "flex", gap: 12, alignItems: "flex-start",
        }}
      >
        <Info size={16} color="hsl(var(--accent))" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--accent-dark))", lineHeight: 1.6 }}>
          <strong>Tingkat Keyakinan 95% (1 hari)</strong> artinya: Berdasarkan data naik-turunnya harga di masa lalu, ada kemungkinan kecil (5%) portofolio Anda mengalami kerugian lebih besar dari angka hasil simulasi dalam 1 hari ke depan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
        {/* Parameter form */}
        <div className="card" style={{ padding: "26px" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--text-primary))", marginBottom: 20 }}>
            Parameter Simulasi
          </h2>
          <form onSubmit={handleSimulate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Portfolio */}
            <div>
              <label htmlFor="sim-portfolio" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                Portofolio
              </label>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <select
                  id="sim-portfolio"
                  className="input-base"
                  style={{ appearance: "none", paddingRight: 36 }}
                  value={portfolioId}
                  onChange={(e) => setPortfolioId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Portofolio --</option>
                  <option value="custom">Kustom Komposisi (Simulasi Mandiri)</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>

              {portfolioId === "custom" && (
                <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "hsl(var(--bg-base))", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
                  <div>
                    <label htmlFor="custom-value-input" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "hsl(var(--text-secondary))", marginBottom: 4 }}>
                      Modal Awal Investasi (Rp)
                    </label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--text-muted))", fontSize: "0.82rem", pointerEvents: "none" }}>
                        Rp
                      </span>
                      <input
                        id="custom-value-input"
                        type="text"
                        inputMode="numeric"
                        className="input-base"
                        value={formatNumberSeparator(customValue)}
                        onChange={(e) => setCustomValue(parseNumberSeparator(e.target.value))}
                        placeholder="10.000.000"
                        style={{ padding: "6px 10px 6px 34px", fontSize: "0.82rem" }}
                      />
                    </div>

                    {/* Quick Action Buttons inside Card */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowRecommendationModal(true)}
                        style={{
                          fontSize: "0.72rem", padding: "6px 8px", borderRadius: 6,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          background: "rgba(16, 185, 129, 0.1)", color: "hsl(var(--primary))",
                          border: "1px solid rgba(16, 185, 129, 0.25)", fontWeight: 600, cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        <Sparkles size={13} />
                        Rekomendasi
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGoldModal(true)}
                        style={{
                          fontSize: "0.72rem", padding: "6px 8px", borderRadius: 6,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          background: "rgba(251, 191, 36, 0.12)", color: "#b45309",
                          border: "1px solid rgba(251, 191, 36, 0.3)", fontWeight: 600, cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        <Coins size={13} />
                        Konversi Emas
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>
                        Alokasi Aset (Total: <span style={{ color: totalWeight === 100 ? "hsl(var(--primary))" : "hsl(var(--danger))", fontWeight: 700 }}>{totalWeight}%</span>)
                      </label>
                    </div>

                    {/* Preset Pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: "0.68rem", color: "hsl(var(--text-muted))", whiteSpace: "nowrap" }}>Preset:</span>
                      {[
                        { key: "konservatif", label: "Konservatif" },
                        { key: "moderat", label: "Moderat" },
                        { key: "agresif", label: "Agresif" },
                        { key: "emas", label: "Emas 100%" },
                      ].map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => applyPreset(p.key as any)}
                          style={{
                            fontSize: "0.68rem", padding: "2px 7px", borderRadius: 4,
                            background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))",
                            color: "hsl(var(--text-primary))", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newWeights: Record<string, number> = {};
                          availableAssets.forEach((a) => { newWeights[a.id] = 0; });
                          setWeights(newWeights);
                        }}
                        title="Reset pembagian persenan menjadi 0%"
                        style={{
                          fontSize: "0.68rem", padding: "2px 7px", borderRadius: 4,
                          background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)",
                          color: "hsl(var(--danger))", cursor: "pointer", whiteSpace: "nowrap",
                          fontWeight: 600,
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
                      {availableAssets.map((asset) => {
                        const w = weights[asset.id] ?? 0;
                        const allocatedRp = (customValue * w) / 100;
                        const isGold = asset.type === "emas" || asset.symbol.startsWith("ANTAM") || asset.symbol.startsWith("UBS");
                        const rawPrice = asset.harga_terkini ?? 0;
                        const isAntam5 = asset.symbol === "ANTAM_5GR";
                        const pricePerUnit = rawPrice;
                        const units = (pricePerUnit > 0 && allocatedRp > 0) ? allocatedRp / pricePerUnit : 0;
                        const priceLabel = isAntam5
                          ? `@ ${formatIDR(rawPrice)}/5 gram`
                          : isGold
                            ? `@ ${formatIDR(rawPrice)}/gram`
                            : rawPrice > 0
                              ? `@ ${formatIDR(rawPrice)}/${asset.unit || "unit"}`
                              : "";

                        return (
                          <div key={asset.id} style={{ display: "flex", flexDirection: "column", gap: 3, paddingBottom: 6, borderBottom: "1px solid hsl(var(--border) / 0.4)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "hsl(var(--text-primary))", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={asset.name}>
                                  {asset.name}
                                </div>
                                {priceLabel && (
                                  <div style={{ fontSize: "0.66rem", color: "hsl(var(--text-muted))", marginTop: 1 }}>
                                    {priceLabel}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="input-base"
                                  value={weights[asset.id] ?? 0}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, Number(e.target.value)));
                                    setWeights(prev => ({ ...prev, [asset.id]: val }));
                                    if (val > 0 && (asset.symbol === "ANTAM_1GR" || asset.symbol === "ANTAM_5GR" || asset.symbol === "UBS_1GR")) {
                                      setGoldType(asset.symbol as any);
                                    }
                                  }}
                                  style={{ width: 55, padding: "3px 6px", fontSize: "0.75rem", textAlign: "right" }}
                                />
                                <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>%</span>
                              </div>
                            </div>

                            {/* Hasil Konversi Sinkron di bawah data aset & persenan */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem" }}>
                              <span style={{ color: w > 0 ? "hsl(var(--primary))" : "hsl(var(--text-muted))", fontWeight: w > 0 ? 700 : 400 }}>
                                {formatIDR(Math.round(allocatedRp))}
                              </span>
                              {isAntam5 ? (
                                <span
                                  style={{
                                    color: w > 0 ? "#b45309" : "hsl(var(--text-muted))",
                                    fontWeight: w > 0 ? 700 : 400,
                                    background: w > 0 ? "rgba(251,191,36,0.15)" : "transparent",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    border: w > 0 ? "1px solid rgba(251,191,36,0.3)" : "none",
                                  }}
                                >
                                  ≈ {units > 0 ? units.toLocaleString("id-ID", { minimumFractionDigits: 5, maximumFractionDigits: 5 }) : "0,00000"} (5 gram)
                                </span>
                              ) : isGold ? (
                                <span
                                  style={{
                                    color: w > 0 ? "#b45309" : "hsl(var(--text-muted))",
                                    fontWeight: w > 0 ? 700 : 400,
                                    background: w > 0 ? "rgba(251,191,36,0.15)" : "transparent",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    border: w > 0 ? "1px solid rgba(251,191,36,0.3)" : "none",
                                  }}
                                >
                                  ≈ {units > 0 ? units.toLocaleString("id-ID", { minimumFractionDigits: 5, maximumFractionDigits: 5 }) : "0,00000"} gram
                                </span>
                              ) : rawPrice > 0 && w > 0 ? (
                                <span style={{ color: "hsl(var(--text-secondary))", fontWeight: 500 }}>
                                  ≈ {(allocatedRp / rawPrice).toLocaleString("id-ID", { maximumFractionDigits: 2 })} {asset.unit || "unit"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {totalWeight !== 100 && (
                      <p style={{ fontSize: "0.68rem", color: "hsl(var(--danger))", marginTop: 4, display: "flex", gap: 3, alignItems: "center" }}>
                        <AlertTriangle size={10} /> Total alokasi harus 100%
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Confidence Level */}
            <div>
              <label style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 8 }}>
                Tingkat Keyakinan: <span style={{ color: "hsl(var(--accent))", marginLeft: 4 }}>{(confidence * 100).toFixed(0)}%</span>
                <InfoTooltip text="Seberapa 'yakin' simulasi ini menghitung risiko Anda. 95% artinya: dari 100 hari, ada 5 hari di mana kerugian bisa melebihi angka yang ditampilkan. 99% = lebih ketat, hanya 1 hari dari 100." />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[0.95, 0.99].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={confidence === c ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                    style={{ flex: 1 }}
                    onClick={() => setConfidence(c)}
                  >
                    {(c * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <label htmlFor="sim-period" style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                Gunakan Harga Historis (hari): <span style={{ color: "hsl(var(--accent))", marginLeft: 4 }}>{periodDays}</span>
                <InfoTooltip text="Berapa hari data harga masa lalu yang dipakai untuk simulasi. Makin banyak hari = makin banyak data = hasil lebih akurat. Contoh: 252 hari ≈ 1 tahun perdagangan." />
              </label>
              <input
                id="sim-period"
                type="range"
                min={30} max={365} step={1}
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
                style={{ width: "100%", accentColor: "hsl(var(--primary))" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                <span>30 hari</span><span>365 hari</span>
              </div>
            </div>

            {/* Holding Period */}
            <div>
              <label style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 8 }}>
                Lama Waktu Ditahan: <span style={{ color: "hsl(var(--accent))", marginLeft: 4 }}>{holdingPeriod} hari</span>
                <InfoTooltip text="Berapa hari Anda berencana memegang investasi ini tanpa menjualnya. Semakin lama ditahan, semakin besar potensi kerugian yang bisa terakumulasi. Masukkan nilai bebas 1–365 hari atau pilih preset." />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[1, 5, 10].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={holdingPeriod === d ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                    style={{ flex: "1 1 44px", minWidth: 44 }}
                    onClick={() => setHoldingPeriod(d)}
                  >
                    {d}h
                  </button>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 80px" }}>
                  <input
                    id="custom-holding-input"
                    type="number"
                    min={1}
                    max={365}
                    className="input-base"
                    value={holdingPeriod}
                    onChange={(e) => {
                      const val = Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 1)));
                      setHoldingPeriod(val);
                    }}
                    style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem", textAlign: "center" }}
                    placeholder="Kustom"
                  />
                  <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", whiteSpace: "nowrap" }}>hari</span>
                </div>
              </div>
              <div style={{ fontSize: "0.68rem", color: "hsl(var(--text-muted))", marginTop: 4 }}>
                Klik preset atau ketik nilai bebas (1–365 hari)
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(225, 29, 72, 0.08)", border: "1px solid rgba(225, 29, 72, 0.2)", borderRadius: 8, padding: "10px 14px", fontSize: "0.83rem", color: "hsl(var(--danger))", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                {error}
              </div>
            )}

            <button
              id="btn-simulate-var"
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 4 }}
              disabled={loading || (portfolioId === "custom" && totalWeight !== 100)}
            >
              {loading ? "Menghitung..." : (
                <><FlaskConical size={15} /> Jalankan Simulasi</>
              )}
            </button>
          </form>
        </div>

        {/* Result */}
        <div>
          {!result && !loading && (
            <div
              className="card"
              style={{ padding: 64, textAlign: "center", borderStyle: "dashed" }}
            >
              <FlaskConical size={40} color="hsl(var(--text-muted))" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>
                Isi parameter di kiri, lalu klik <strong style={{ color: "hsl(var(--text-primary))" }}>"Jalankan Simulasi"</strong> untuk melihat hasil VaR.
              </p>
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[120, 200, 80].map((h, i) => (
                <div key={i} className="skeleton" style={{ height: h, borderRadius: 16 }} />
              ))}
            </div>
          )}

          {result && (
            <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* VaR result cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  style={{
                    background: "rgba(225, 29, 72, 0.08)",
                    border: "1px solid rgba(225, 29, 72, 0.2)",
                    borderRadius: 14, padding: "20px 20px",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "hsl(var(--danger))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Perkiraan Kerugian ({(result.confidence * 100).toFixed(0)}%, {result.holding_period} hari)
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "hsl(var(--danger))", lineHeight: 1 }}>
                    {formatIDR(result.var_value)}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "hsl(var(--danger))", marginTop: 6 }}>
                    {formatPct(result.var_percentage * 100)} dari nilai portofolio
                  </div>
                </div>
                <div className="stat-card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Rangkuman Kinerja & Parameter
                    </div>
                    <span style={{ fontSize: "0.72rem", background: "hsl(var(--bg-base))", border: "1px solid hsl(var(--border))", padding: "2px 8px", borderRadius: 6, color: "hsl(var(--text-muted))" }}>
                      Modal: {formatIDR(result.portfolio_value)}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.83rem" }}>
                    {/* Total Observasi */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
                      <div>
                        <span style={{ color: "hsl(var(--text-secondary))", fontWeight: 500, display: "block" }}>Total Observasi:</span>
                        <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Sampel data pergerakan harga</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: "hsl(var(--text-primary))", display: "block" }}>
                          {result.num_observations} hari
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>hari perdagangan bursa</span>
                      </div>
                    </div>

                    {/* Rata-rata Untung */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
                      <div>
                        <span style={{ color: "hsl(var(--text-secondary))", fontWeight: 500, display: "block" }}>Rata-rata Untung (Return):</span>
                        <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Pertumbuhan rata-rata harian</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: result.mean_return >= 0 ? "hsl(var(--primary))" : "hsl(var(--danger))", display: "block" }}>
                          {formatPct(result.mean_return * 100)} / hari
                        </span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: result.mean_return >= 0 ? "hsl(var(--primary))" : "hsl(var(--danger))" }}>
                          ~{result.mean_return >= 0 ? "+" : ""}{formatIDR(Math.round(result.mean_return * result.portfolio_value))}/hari
                        </span>
                      </div>
                    </div>

                    {/* Tingkat Guncangan (Risiko / Volatilitas) */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
                      <div>
                        <span style={{ color: "hsl(var(--text-secondary))", fontWeight: 500, display: "block" }}>Tingkat Guncangan (Risiko):</span>
                        <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Standar deviasi fluktuasi harian</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: "hsl(var(--text-primary))", display: "block" }}>
                          ±{(result.std_return * 100).toFixed(2)}% / hari
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", fontWeight: 500 }}>
                          ~±{formatIDR(Math.round(result.std_return * result.portfolio_value))}/hari
                        </span>
                      </div>
                    </div>

                    {/* Batas Kerugian (VaR) */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ color: "hsl(var(--text-secondary))", fontWeight: 500, display: "block" }}>Batas Kerugian (VaR):</span>
                        <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Keyakinan {(result.confidence * 100).toFixed(0)}% ({result.holding_period} hari)</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: "hsl(var(--danger))", display: "block" }}>
                          {formatPct(result.threshold * 100)}
                        </span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--danger))" }}>
                          -{formatIDR(result.var_value)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ REKOMENDASI PENGALOKASIAN MODAL ═══ */}
              {customAllocationItems.length > 0 && (
                <div className="animate-fade-in-up" style={{ borderRadius: 16, overflow: "hidden", border: "1.5px solid rgba(16,185,129,0.25)", background: "linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(99,102,241,0.03) 100%)" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(16,185,129,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))", flexShrink: 0 }}>
                      <Sparkles size={15} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(var(--text-primary))" }}>Rekomendasi Pengalokasian Modal</div>
                      <div style={{ fontSize: "0.73rem", color: "hsl(var(--text-muted))" }}>Berdasarkan modal {formatIDR(customValue)} dan komposisi portofolio kustom Anda</div>
                    </div>
                  </div>
                  <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {customAllocationItems.map(({ asset, weight, amount }) => {
                      const type = asset.type;
                      const profileLabel = type === "kripto" ? "Agresif" : type === "emas" || type === "obligasi" ? "Konservatif" : "Moderat";
                      const profileColor = type === "kripto" ? "#f59e0b" : type === "emas" || type === "obligasi" ? "hsl(var(--accent))" : "hsl(var(--primary))";
                      return (
                        <div key={asset.id} style={{ background: "hsl(var(--bg-surface))", borderRadius: 12, border: "1px solid hsl(var(--border))", padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "hsl(var(--text-primary))" }}>{asset.name}</div>
                              <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 1 }}>
                                Alokasi: <strong style={{ color: "hsl(var(--text-primary))" }}>{weight}%</strong> dari modal
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: "1rem", color: "hsl(var(--primary))" }}>{formatIDR(Math.round(amount))}</div>
                              <span style={{ fontSize: "0.67rem", fontWeight: 700, color: profileColor, padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 2, background: `rgba(0,0,0,0.06)` }}>{profileLabel}</span>
                            </div>
                          </div>
                          <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-secondary))", lineHeight: 1.6, margin: 0 }}>💡 {getAssetReason(type)}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: "8px 20px", borderTop: "1px solid rgba(16,185,129,0.1)", fontSize: "0.7rem", color: "hsl(var(--text-muted))", background: "rgba(16,185,129,0.02)" }}>
                    ⚠️ Rekomendasi ini bersifat informatif berdasarkan data historis — bukan saran finansial profesional.
                  </div>
                </div>
              )}

              {/* ═══ TRANSCRIPT HARGA & KONVERSI EMAS (HANYA MUNCUL JIKA ADA ASET EMAS DIPILIH) ═══ */}
              {(() => {
                const allGoldOptions: Array<{ key: "ANTAM_1GR" | "ANTAM_5GR" | "UBS_1GR"; label: string; unitWeight: number }> = [
                  { key: "ANTAM_1GR", label: "Antam 1gr", unitWeight: 1 },
                  { key: "ANTAM_5GR", label: "Antam 5gr", unitWeight: 5 },
                  { key: "UBS_1GR", label: "UBS 1gr", unitWeight: 1 },
                ];

                // Filter HANYA aset emas yang dipilih (bobot > 0%) jika kustom
                const activeGoldOptions = allGoldOptions.filter((g) => {
                  const asset = availableAssets.find((a) => a.symbol === g.key);
                  if (!asset || !asset.harga_terkini) return false;
                  if (portfolioId === "custom") {
                    return (weights[asset.id] ?? 0) > 0;
                  }
                  return true;
                });

                // Jika tidak ada aset emas yang dipilih, JANGAN tampilkan card ini sama sekali
                if (activeGoldOptions.length === 0 || !result) return null;

                const currentSelectedKey = activeGoldOptions.some((g) => g.key === goldType)
                  ? goldType
                  : activeGoldOptions[0].key;

                const currentGoldOption = activeGoldOptions.find((g) => g.key === currentSelectedKey) || activeGoldOptions[0];
                const goldAsset = availableAssets.find((a) => a.symbol === currentGoldOption.key);
                const isAntam5 = currentGoldOption.key === "ANTAM_5GR";
                const rawPrice = goldAsset?.harga_terkini ?? 0;
                
                const assetWeight = portfolioId === "custom" && goldAsset ? (weights[goldAsset.id] ?? 0) : 100;
                const totalModal = portfolioId === "custom" ? customValue : result?.portfolio_value ?? 0;
                const goldModal = portfolioId === "custom" ? (totalModal * assetWeight) / 100 : totalModal;
                const unitsAvailable = rawPrice > 0 && goldModal > 0 ? goldModal / rawPrice : null;

                return (
                  <div className="animate-fade-in-up" style={{ borderRadius: 16, overflow: "hidden", border: "1.5px solid rgba(251,191,36,0.3)", background: "linear-gradient(135deg, rgba(251,191,36,0.05) 0%, rgba(245,158,11,0.03) 100%)" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(251,191,36,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "1.2rem" }}>🪙</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "hsl(var(--text-primary))" }}>Transcript Harga &amp; Konversi Emas</div>
                          <div style={{ fontSize: "0.74rem", color: "hsl(var(--text-muted))" }}>
                            Alokasi {currentGoldOption.label} ({assetWeight}%): {formatIDR(goldModal)}
                          </div>
                        </div>
                      </div>
                      {activeGoldOptions.length > 1 && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {activeGoldOptions.map((g) => (
                            <button
                              key={g.key}
                              type="button"
                              className={currentSelectedKey === g.key ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                              style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                              onClick={() => setGoldType(g.key)}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${activeGoldOptions.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
                        {activeGoldOptions.map((g) => {
                          const asset = availableAssets.find((a) => a.symbol === g.key);
                          if (!asset?.harga_terkini) return null;
                          const isSelected = currentSelectedKey === g.key;
                          const w = portfolioId === "custom" ? (weights[asset.id] ?? 0) : 100;
                          return (
                            <button
                              key={g.key}
                              type="button"
                              style={{
                                padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                                background: isSelected ? "rgba(251,191,36,0.12)" : "hsl(var(--bg-base))",
                                border: isSelected ? "1.5px solid rgba(251,191,36,0.45)" : "1px solid hsl(var(--border))",
                                transition: "all 0.15s",
                              }}
                              onClick={() => setGoldType(g.key)}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))", marginBottom: 3, fontWeight: 600 }}>{g.label}</div>
                                {portfolioId === "custom" && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "hsl(var(--primary))" }}>{w}%</span>}
                              </div>
                              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#92400e" }}>{formatIDR(asset.harga_terkini)}</div>
                              <div style={{ fontSize: "0.66rem", color: "#b45309", marginTop: 2 }}>per {g.unitWeight} gram</div>
                            </button>
                          );
                        })}
                      </div>
                      {rawPrice > 0 && unitsAvailable !== null ? (
                        <div style={{ padding: "18px 20px", background: "rgba(251,191,36,0.09)", borderRadius: 12, border: "1px solid rgba(251,191,36,0.25)", textAlign: "center" }}>
                          <div style={{ fontSize: "0.8rem", color: "#92400e", marginBottom: 8, fontWeight: 600 }}>
                            Dengan modal alokasi {formatIDR(goldModal)} ({currentGoldOption.label} · {assetWeight}%), Anda dapat memiliki:
                          </div>
                          <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#b45309", lineHeight: 1, letterSpacing: "-0.02em" }}>
                            {unitsAvailable.toLocaleString("id-ID", { minimumFractionDigits: 5, maximumFractionDigits: 5 })} {isAntam5 ? "(5 gram)" : "gram"}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#92400e", marginTop: 8, opacity: 0.9 }}>
                            {isAntam5
                              ? `Emas Antam 5 Gram · Total ${(unitsAvailable * 5).toLocaleString("id-ID", { minimumFractionDigits: 5, maximumFractionDigits: 5 })} gram murni · Harga: ${formatIDR(rawPrice)} / 5 gram`
                              : `Emas ${currentGoldOption.key === "ANTAM_1GR" ? "Antam 1 gram" : "UBS 1 gram"} · Harga: ${formatIDR(rawPrice)} / gram`}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", color: "hsl(var(--text-muted))", fontSize: "0.85rem", padding: "16px" }}>
                          Data harga emas tidak tersedia
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ SAVE TO HISTORY BUTTON ═══ */}
              <div
                style={{
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                  padding: "14px 18px", borderRadius: 12,
                  background: savedMsg ? "rgba(16,185,129,0.08)" : "hsl(var(--bg-surface))",
                  border: savedMsg ? "1px solid rgba(16,185,129,0.25)" : "1px solid hsl(var(--border))",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="text"
                  className="input-base"
                  placeholder="Label opsional (cth: Emas 95%)"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: "7px 12px", fontSize: "0.82rem" }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ gap: 6, whiteSpace: "nowrap" }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : <><Save size={14} /> Simpan ke Riwayat</>}
                </button>
                {savedMsg && (
                  <span style={{ fontSize: "0.82rem", color: "hsl(var(--primary))", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={14} /> {savedMsg}
                  </span>
                )}
              </div>

              {/* Histogram */}
              <div className="card py-4 sm:py-0 overflow-hidden">
                <div className="flex flex-col items-stretch border-b border-[hsl(var(--border))] sm:flex-row p-0">
                  <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0 py-4">
                    <h3 className="font-bold text-lg text-[hsl(var(--text-primary))]">Grafik Pergerakan Harga Masa Lalu</h3>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">
                      Area merah = Zona Risiko Kerugian Terburuk (di bawah batas VaR)
                    </p>
                  </div>
                  <div className="flex">
                    <button
                      className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] transition-colors"
                    >
                      <span className="text-xs text-[hsl(var(--text-muted))]">Perkiraan Kerugian</span>
                      <span className="text-lg leading-none font-bold sm:text-2xl text-[hsl(var(--danger))] truncate">
                        {formatIDR(result.var_value)}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="p-4 sm:p-6 mt-2">
                  <div className="aspect-auto h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "hsl(var(--text-muted))" }}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={12}
                          interval={4}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "hsl(var(--text-muted))" }}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--text-primary))", fontSize: "0.82rem", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                          formatter={(v) => [v, "Frekuensi"]}
                        />
                        <ReferenceLine x={`${(result.threshold * 100).toFixed(1)}%`} stroke="hsl(var(--danger))" strokeDasharray="4 2" label={{ value: "VaR", fill: "hsl(var(--danger))", fontSize: 10 }} />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                          {histogramData.map((entry, index) => (
                            <Cell key={index} fill={entry.isTail ? "hsl(var(--danger))" : "hsl(var(--accent))"} opacity={entry.isTail ? 0.9 : 0.6} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* === EXPLANATION SECTION === */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* What is VaR - simple */}
                <div style={{ borderRadius: 16, padding: "20px 22px", background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🛡️</div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>Apa itu VaR?</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: 1.75, marginBottom: 10 }}>
                    Bayangkan Anda ingin tahu: <em>"Kalau besok pasar lagi jelek, paling rugi berapa?"</em><br />
                    Nah, <strong style={{ color: "hsl(var(--text-primary))" }}>VaR (Value at Risk)</strong> menjawab pertanyaan itu! Angka ini dihitung dari data harga nyata portofolio Anda di masa lalu — bukan tebakan, tapi berdasarkan apa yang <em>sudah pernah terjadi</em>.
                  </p>
                  <div style={{ padding: "10px 14px", background: "rgba(59,130,246,0.07)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.15)", fontSize: "0.82rem", color: "hsl(var(--accent-dark))", lineHeight: 1.65 }}>
                    💡 <strong>Garis merah putus-putus di grafik (berlabel "VaR")</strong> = batas kerugian. Semua batang/bar di <strong>sebelah kiri</strong> garis itu adalah hari-hari di mana kerugian pernah melampaui angka <strong>{formatPct(result.threshold * 100)}</strong>.
                  </div>
                </div>

                {/* Red + Blue explanation side by side feel */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Red */}
                  <div style={{ borderRadius: 16, padding: "18px 18px", background: "rgba(225,29,72,0.04)", border: "1px solid rgba(225,29,72,0.18)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, background: "hsl(var(--danger))", flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "hsl(var(--danger))" }}>Bar Merah = Bahaya</span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.7 }}>
                      Ini hari-hari di mana portofolio Anda <strong style={{ color: "hsl(var(--danger))" }}>rugi besar</strong> di masa lalu — sekitar <strong>{(100 - result.confidence * 100).toFixed(0)}%</strong> dari {result.num_observations} hari data.
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))", lineHeight: 1.6, marginTop: 8 }}>
                      Makin banyak bar merah → risiko portofolio Anda makin tinggi.
                    </p>
                  </div>

                  {/* Blue */}
                  <div style={{ borderRadius: 16, padding: "18px 18px", background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.18)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, background: "hsl(var(--accent))", opacity: 0.8, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "hsl(var(--accent))" }}>Bar Biru = Aman</span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.7 }}>
                      Ini hari-hari <strong style={{ color: "hsl(var(--accent))" }}>normal</strong> — portofolio Anda naik atau hanya turun sedikit. Mencakup <strong>{(result.confidence * 100).toFixed(0)}%</strong> dari total data.
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))", lineHeight: 1.6, marginTop: 8 }}>
                      Rata-rata harian: <strong style={{ color: result.mean_return >= 0 ? "hsl(var(--primary))" : "hsl(var(--danger))" }}>{formatPct(result.mean_return * 100)}</strong> per hari.
                    </p>
                  </div>
                </div>

                {/* How it's calculated - simple steps */}
                <div style={{ borderRadius: 16, padding: "20px 22px", background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🧮</div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>Bagaimana Angkanya Dihitung?</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      {
                        n: "1",
                        title: "Lihat Riwayat Harga",
                        desc: `Sistem mengambil data perubahan harga portofolio Anda selama ${result.num_observations} hari ke belakang.`,
                        color: "hsl(var(--primary))",
                      },
                      {
                        n: "2",
                        title: "Urutkan dari yang Terparah",
                        desc: "Semua perubahan harga diurutkan — dari yang paling jelek (rugi besar) sampai yang paling bagus (untung besar). Grafik di atas menggambarkan urutan ini.",
                        color: "hsl(var(--primary))",
                      },
                      {
                        n: "3",
                        title: "Potong di Titik Risiko",
                        desc: "",
                        color: "hsl(var(--danger))",
                        extra: true,
                      },
                      {
                        n: "4",
                        title: "Konversi ke Rupiah",
                        desc: `Persentase kerugian dikalikan nilai portofolio Anda. Hasilnya: kerugian estimasi sebesar ${formatIDR(result.var_value)} (${formatPct(Math.abs(result.threshold) * 100)} dari nilai portofolio).`,
                        color: "hsl(var(--primary))",
                      },
                    ].map((step) => (
                      <div key={step.n} style={{ display: "flex", gap: 12 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: step.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
                          {step.n}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "hsl(var(--text-primary))", marginBottom: 4 }}>{step.title}</div>
                          {step.extra ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.65 }}>
                                Di sinilah perbedaan <strong>95%</strong> dan <strong>99%</strong>:
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(225,29,72,0.05)", border: "1px solid rgba(225,29,72,0.15)" }}>
                                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "hsl(var(--danger))", marginBottom: 5 }}>📌 95% Keyakinan</div>
                                  <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))", lineHeight: 1.65 }}>
                                    Potong di <strong>5% terburuk</strong> dari {result.num_observations} hari data (≈ hari ke-<strong>{Math.ceil(result.num_observations * 0.05)}</strong>).<br /><br />
                                    Artinya: <em>"95 dari 100 hari aman. 5 hari bisa lebih parah."</em><br /><br />
                                    <span style={{ color: "hsl(var(--text-muted))" }}>Cocok untuk investor biasa.</span>
                                  </div>
                                  <code style={{ display: "block", marginTop: 8, background: "hsl(var(--bg-base))", padding: "5px 8px", borderRadius: 5, fontSize: "0.72rem", fontFamily: "monospace", color: "hsl(var(--text-primary))" }}>
                                    VaR = Persentil(5%) × √{holdingPeriod}
                                  </code>
                                </div>
                                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
                                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#dc2626", marginBottom: 5 }}>🔴 99% Keyakinan</div>
                                  <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))", lineHeight: 1.65 }}>
                                    Potong di <strong>1% terburuk</strong> dari {result.num_observations} hari data (≈ hari ke-<strong>{Math.ceil(result.num_observations * 0.01) || 1}</strong>).<br /><br />
                                    Artinya: <em>"99 dari 100 hari aman. Hanya 1 hari bisa lebih parah."</em><br /><br />
                                    <span style={{ color: "hsl(var(--text-muted))" }}>Standar bank & lembaga keuangan.</span>
                                  </div>
                                  <code style={{ display: "block", marginTop: 8, background: "hsl(var(--bg-base))", padding: "5px 8px", borderRadius: 5, fontSize: "0.72rem", fontFamily: "monospace", color: "hsl(var(--text-primary))" }}>
                                    VaR = Persentil(1%) × √{holdingPeriod}
                                  </code>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.65 }}>{step.desc}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(251,191,36,0.08)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.2)", fontSize: "0.8rem", color: "#92400e", lineHeight: 1.65 }}>
                    ⚠️ <strong>Ingat:</strong> VaR bukan jaminan! Ini hanya perkiraan berdasarkan data masa lalu. Saat krisis besar (seperti pandemi atau crash pasar), kerugian bisa jauh lebih besar dari angka VaR. Gunakan sebagai <em>panduan</em>, bukan kepastian.
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          HISTORY TABLE
         ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.1rem", color: "hsl(var(--text-primary))", display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={20} /> Riwayat Simulasi VaR
          </h2>
          {selectedIds.size >= 2 && (
            <button
              className="btn btn-primary btn-sm"
              style={{ gap: 6 }}
              onClick={() => setShowCompare(true)}
            >
              📊 Bandingkan ({selectedIds.size} simulasi)
            </button>
          )}
        </div>

        {historyLoading ? (
          <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
        ) : history.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", borderStyle: "dashed" }}>
            <Save size={32} color="hsl(var(--text-muted))" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.88rem" }}>
              Belum ada simulasi yang disimpan. Jalankan simulasi lalu klik <strong>"Simpan ke Riwayat"</strong>.
            </p>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid hsl(var(--border))" }}>
                    <th style={{ padding: "12px 10px", textAlign: "center", width: 40 }}>
                      <span style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>Pilih</span>
                    </th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Tanggal</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Label</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Portofolio</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Keyakinan</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Ditahan</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>VaR (Rp)</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>VaR (%)</th>
                    <th style={{ padding: "12px 10px", textAlign: "center", width: 110 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      style={{
                        borderBottom: "1px solid hsl(var(--border))",
                        background: selectedIds.has(h.id) ? "rgba(16,185,129,0.04)" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(h.id)}
                          onChange={() => toggleSelect(h.id)}
                          style={{ accentColor: "hsl(var(--primary))", width: 16, height: 16, cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "10px 14px", color: "hsl(var(--text-primary))", whiteSpace: "nowrap" }}>
                        {formatDateShort(h.created_at)}
                      </td>
                      <td style={{ padding: "10px 14px", color: "hsl(var(--text-primary))", fontWeight: 500 }}>
                        {h.label || <span style={{ color: "hsl(var(--text-muted))", fontStyle: "italic" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", color: "hsl(var(--text-secondary))" }}>
                        {h.portfolio?.name || <span style={{ fontStyle: "italic" }}>Kustom</span>}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>
                        {(h.result.confidence * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {h.result.holding_period}h
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "hsl(var(--danger))" }}>
                        {formatIDR(h.result.var_value)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "hsl(var(--danger))" }}>
                        {formatPct(h.result.var_percentage * 100)}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 8px", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}
                            onClick={() => setSelectedHistoryDetail(h)}
                            title="Lihat Detail Riwayat"
                          >
                            <Eye size={12} /> Detail
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 6px" }}
                            onClick={() => handleDeleteHistory(h.id)}
                            disabled={deletingId === h.id}
                            title="Hapus"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          COMPARISON PANEL (modal overlay)
         ═══════════════════════════════════════════════════════════════════════ */}
      {showCompare && selectedIds.size >= 2 && (() => {
        const selected = history.filter((h) => selectedIds.has(h.id));

        // ─── Evaluasi & Logika Rekomendasi Investasi ────────────────────────
        const evaluated = selected.map((s, index) => {
          const labelText = s.label || s.portfolio?.name || `Simulasi ${index + 1}`;
          const displayName = s.label ? `${s.label} (${s.portfolio?.name || "Kustom"})` : s.portfolio?.name ? s.portfolio.name : `Simulasi ${index + 1}`;
          const mean = s.result.mean_return;
          const std = s.result.std_return;
          const varPct = Math.abs(s.result.var_percentage);
          const varRp = s.result.var_value;
          // Sharpe ratio harian (Reward to Volatility)
          const sharpe = std > 0 ? (mean / std) : 0;
          // Return to VaR ratio
          const returnToVaR = varPct > 0 ? (mean / varPct) : 0;

          return {
            ...s,
            labelText,
            displayName,
            simIndex: index + 1,
            mean,
            std,
            varPct,
            varRp,
            threshold: s.result.threshold,
            sharpe,
            returnToVaR,
          };
        });

        // 1. Terbaik untuk Keseimbangan / Rasio Sharpe (Moderat - Rekomendasi Utama)
        const bestSharpe = [...evaluated].sort((a, b) => b.sharpe - a.sharpe)[0];
        // 2. Terbaik untuk Keamanan / VaR Terkecil (Konservatif)
        const bestSafe = [...evaluated].sort((a, b) => a.varPct - b.varPct)[0];
        // 3. Terbaik untuk Potensi Return Tertinggi (Agresif)
        const bestReturn = [...evaluated].sort((a, b) => b.mean - a.mean)[0];

        const rows: { label: string; key: string; format: (h: HistoryRecord) => string; highlightBest?: "min" | "max" }[] = [
          { label: "Label", key: "label", format: (h) => h.label || "—" },
          { label: "Portofolio", key: "portfolio", format: (h) => h.portfolio?.name || "Kustom" },
          { label: "Tanggal", key: "date", format: (h) => formatDateShort(h.created_at) },
          { label: "Keyakinan", key: "confidence", format: (h) => `${(h.result.confidence * 100).toFixed(0)}%` },
          { label: "Ditahan", key: "holding", format: (h) => `${h.result.holding_period} hari` },
          { label: "Nilai Portofolio", key: "pv", format: (h) => formatIDR(h.result.portfolio_value) },
          { label: "VaR (Rp)", key: "var_rp", format: (h) => formatIDR(h.result.var_value), highlightBest: "min" },
          { label: "VaR (%)", key: "var_pct", format: (h) => `${(h.result.var_percentage * 100).toFixed(2)}%` },
          { label: "Rata-rata Return", key: "mean", format: (h) => `${formatPct(h.result.mean_return * 100)}/h (~${h.result.mean_return >= 0 ? "+" : ""}${formatIDR(Math.round(h.result.mean_return * h.result.portfolio_value))}/h)`, highlightBest: "max" },
          { label: "Volatilitas", key: "std", format: (h) => `±${(h.result.std_return * 100).toFixed(2)}%/h (~±${formatIDR(Math.round(h.result.std_return * h.result.portfolio_value))}/h)`, highlightBest: "min" },
          { label: "Efisiensi (Sharpe Ratio)", key: "sharpe", format: (h) => (h.result.std_return > 0 ? (h.result.mean_return / h.result.std_return) : 0).toFixed(3), highlightBest: "max" },
          { label: "Batas Kerugian", key: "threshold", format: (h) => `${formatPct(h.result.threshold * 100)} (-${formatIDR(h.result.var_value)})` },
          { label: "Data Observasi", key: "obs", format: (h) => `${h.result.num_observations} hari` },
        ];

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCompare(false); }}
          >
            <div
              className="card animate-fade-in-up"
              style={{
                maxWidth: "96vw",
                maxHeight: "92vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                width: Math.max(920, Math.min(selected.length * 320 + 360, 1400)),
                padding: 0,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              }}
            >
              {/* Header */}
              <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "hsl(var(--text-primary))", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    📊 Perbandingan {selected.length} Simulasi & Rekomendasi
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: "hsl(var(--text-muted))", margin: "2px 0 0" }}>
                    Analisis risiko VaR komparatif dan saran alokasi investasi berdasarkan profil risiko
                  </p>
                </div>
                <button
                  onClick={() => setShowCompare(false)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: "1px solid hsl(var(--border))", background: "hsl(var(--bg-base))",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    color: "hsl(var(--text-secondary))",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Body: Rekomendasi + Table */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>

                {/* ═══ REKOMENDASI INVESTASI SECTION ═══ */}
                <div style={{ flexShrink: 0, padding: "18px 20px", background: "rgba(16, 185, 129, 0.04)", borderBottom: "1px solid rgba(16, 185, 129, 0.18)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))" }}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))", margin: 0 }}>
                        Rekomendasi Keputusan Investasi
                      </h4>
                      <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>
                        Dievaluasi menggunakan rasio Return terhadap Risiko (Sharpe Ratio) dan proteksi batas bawah (VaR)
                      </span>
                    </div>
                  </div>

                  {/* Winner / Rekomendasi Utama Card */}
                  <div
                    style={{
                      background: "hsl(var(--bg-surface))",
                      border: "1.5px solid rgba(16, 185, 129, 0.35)",
                      borderRadius: 14,
                      padding: "16px 18px",
                      marginBottom: 14,
                      boxShadow: "0 2px 10px rgba(16, 185, 129, 0.06)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "hsl(var(--primary))", color: "#fff", padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
                        <ThumbsUp size={12} /> Rekomendasi Utama (Paling Optimal)
                      </span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "hsl(var(--primary))", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
                        Efisiensi Risiko Tertinggi • Sharpe: {bestSharpe.sharpe.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                      ⭐ Simulasi {bestSharpe.simIndex}: {bestSharpe.displayName}
                    </div>
                    <p style={{ fontSize: "0.83rem", color: "hsl(var(--text-secondary))", lineHeight: 1.65, margin: 0 }}>
                      Opsi ini paling disarankan untuk sebagian besar investor karena menghasilkan <strong>imbal hasil tertinggi untuk setiap satuan risiko (Sharpe Ratio: {bestSharpe.sharpe.toFixed(3)})</strong>.
                      Memberikan rata-rata keuntungan <strong>{formatPct(bestSharpe.mean * 100)}/hari</strong> (~{bestSharpe.mean >= 0 ? "+" : ""}{formatIDR(Math.round(bestSharpe.mean * bestSharpe.result.portfolio_value))}/hari) dengan tingkat guncangan terkendali di <strong>±{(bestSharpe.std * 100).toFixed(2)}%/hari</strong> dan batas risiko VaR <strong>{formatPct(bestSharpe.threshold * 100)}</strong> (-{formatIDR(bestSharpe.varRp)}).
                    </p>
                  </div>

                  {/* 3 Profil Investor Cards Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                    {/* 1. Konservatif */}
                    <div style={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "hsl(var(--accent))", fontSize: "0.78rem", fontWeight: 700 }}>
                        <ShieldCheck size={15} /> Profil Konservatif (Paling Aman)
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "hsl(var(--text-primary))", marginBottom: 4 }}>
                        Simulasi {bestSafe.simIndex}: {bestSafe.displayName}
                      </div>
                      <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", lineHeight: 1.5, margin: 0 }}>
                        Potensi kerugian terendah dengan batas VaR hanya <strong>{(bestSafe.varPct * 100).toFixed(2)}%</strong> (-{formatIDR(bestSafe.varRp)}). Cocok bagi investor yang mengutamakan proteksi modal utama.
                      </p>
                    </div>

                    {/* 2. Moderat */}
                    <div style={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "hsl(var(--primary))", fontSize: "0.78rem", fontWeight: 700 }}>
                        <Award size={15} /> Profil Moderat (Seimbang)
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "hsl(var(--text-primary))", marginBottom: 4 }}>
                        Simulasi {bestSharpe.simIndex}: {bestSharpe.displayName}
                      </div>
                      <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", lineHeight: 1.5, margin: 0 }}>
                        Keseimbangan ideal antara pertumbuhan dan stabilitas dengan Sharpe Ratio <strong>{bestSharpe.sharpe.toFixed(3)}</strong>. Direkomendasikan untuk akumulasi aset berkelanjutan.
                      </p>
                    </div>

                    {/* 3. Agresif */}
                    <div style={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "#f59e0b", fontSize: "0.78rem", fontWeight: 700 }}>
                        <TrendingUp size={15} /> Profil Agresif (Return Tertinggi)
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "hsl(var(--text-primary))", marginBottom: 4 }}>
                        Simulasi {bestReturn.simIndex}: {bestReturn.displayName}
                      </div>
                      <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", lineHeight: 1.5, margin: 0 }}>
                        Menawarkan rata-rata pertumbuhan tertinggi (<strong>{formatPct(bestReturn.mean * 100)}/hari</strong>). Cocok bagi yang siap menerima volatilitas lebih tinggi demi potensi hasil maksimal.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ═══ TABEL PERBANDINGAN METRIK ═══ */}
                <div style={{ flexShrink: 0, overflowX: "auto", width: "100%", paddingBottom: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid hsl(var(--border))", position: "sticky", top: 0, background: "hsl(var(--bg-surface))", zIndex: 2 }}>
                        <th style={{ padding: "12px 18px", textAlign: "left", fontWeight: 700, color: "hsl(var(--text-primary))", whiteSpace: "nowrap", minWidth: 140, position: "sticky", left: 0, background: "hsl(var(--bg-surface))", zIndex: 3 }}>
                          Metrik
                        </th>
                        {selected.map((s, i) => (
                          <th key={s.id} style={{ padding: "12px 18px", textAlign: "center", fontWeight: 600, color: "hsl(var(--text-primary))", whiteSpace: "nowrap", minWidth: 160 }}>
                            <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginBottom: 2 }}>Simulasi {i + 1}</div>
                            {s.label || formatDateShort(s.created_at)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        // Find best/worst values for highlighting
                        let bestValue: number | null = null;
                        let worstValue: number | null = null;
                        if (row.highlightBest) {
                          const numValues = selected.map((s) => {
                            if (row.key === "var_rp") return s.result.var_value;
                            if (row.key === "mean") return s.result.mean_return;
                            if (row.key === "std") return s.result.std_return;
                            if (row.key === "sharpe") return s.result.std_return > 0 ? s.result.mean_return / s.result.std_return : 0;
                            return 0;
                          });
                          if (row.highlightBest === "min") {
                            bestValue = Math.min(...numValues);
                            worstValue = Math.max(...numValues);
                          } else {
                            bestValue = Math.max(...numValues);
                            worstValue = Math.min(...numValues);
                          }
                        }

                        return (
                          <tr key={row.key} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                            <td style={{ padding: "10px 18px", fontWeight: 600, color: "hsl(var(--text-secondary))", whiteSpace: "nowrap", position: "sticky", left: 0, background: "hsl(var(--bg-surface))", zIndex: 1 }}>
                              {row.label}
                            </td>
                            {selected.map((s) => {
                              let cellBg = "transparent";
                              if (row.highlightBest && selected.length > 1) {
                                const val = row.key === "var_rp" ? s.result.var_value
                                  : row.key === "mean" ? s.result.mean_return
                                    : row.key === "std" ? s.result.std_return
                                      : row.key === "sharpe" ? (s.result.std_return > 0 ? s.result.mean_return / s.result.std_return : 0)
                                        : 0;
                                if (val === bestValue) cellBg = "rgba(16,185,129,0.08)";
                                else if (val === worstValue) cellBg = "rgba(225,29,72,0.06)";
                              }
                              return (
                                <td
                                  key={s.id}
                                  style={{
                                    padding: "10px 18px", textAlign: "center",
                                    color: "hsl(var(--text-primary))",
                                    background: cellBg,
                                    fontWeight: row.key === "var_rp" || row.key === "sharpe" ? 700 : 400,
                                    transition: "background 0.2s",
                                  }}
                                >
                                  {row.format(s)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div style={{ flexShrink: 0, padding: "14px 22px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center", background: "hsl(var(--bg-surface))" }}>
                <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>
                  💡 Hijau muda = nilai metrik paling menguntungkan • Merah muda = nilai paling berisiko
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCompare(false)}>
                  Tutup Perbandingan
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL REKOMENDASI PENGALOKASIAN MODAL (FROM CARD BUTTON)
         ═══════════════════════════════════════════════════════════════════════ */}
      {showRecommendationModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRecommendationModal(false); }}
        >
          <div
            className="card animate-fade-in-up"
            style={{
              maxWidth: 720, width: "100%", maxHeight: "90vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
              padding: 0, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))" }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "hsl(var(--text-primary))", margin: 0 }}>
                    Rekomendasi Pengalokasian Modal
                  </h3>
                  <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", margin: "2px 0 0" }}>
                    Saran pembagian modal {formatIDR(customValue)} berdasarkan profil risiko &amp; tujuan investasi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRecommendationModal(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--bg-base))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "hsl(var(--text-secondary))" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content list of 4 strategies */}
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  id: "konservatif",
                  title: "Profil Konservatif (Proteksi Modal & Anti-Inflasi)",
                  badge: "Paling Aman",
                  badgeBg: "rgba(16,185,129,0.1)",
                  badgeColor: "hsl(var(--primary))",
                  allocations: [
                    { name: "Emas Antam 1 Gram", pct: 60, val: customValue * 0.6 },
                    { name: "Reksa Dana Pasar Uang / Obligasi", pct: 40, val: customValue * 0.4 },
                  ],
                  reason: "Mengutamakan perlindungan nilai modal terhadap inflasi dengan porsi emas dominan dan likuiditas pasar uang berisiko minimal.",
                },
                {
                  id: "moderat",
                  title: "Profil Moderat (Keseimbangan Imbal Hasil & Risiko)",
                  badge: "Rekomendasi Utama",
                  badgeBg: "rgba(59,130,246,0.1)",
                  badgeColor: "hsl(var(--accent))",
                  allocations: [
                    { name: "Emas Antam 1 Gram", pct: 35, val: customValue * 0.35 },
                    { name: "Reksa Dana Likuid / Pasar Uang", pct: 35, val: customValue * 0.35 },
                    { name: "Reksa Dana Saham / Saham", pct: 30, val: customValue * 0.3 },
                  ],
                  reason: "Kombinasi ideal antara stabilitas emas, pendapatan pasar uang, dan potensi capital gain saham untuk pertumbuhan modal jangka menengah.",
                },
                {
                  id: "agresif",
                  title: "Profil Agresif (Maksimal Pertumbuhan Jangka Panjang)",
                  badge: "Tinggi Imbal Hasil",
                  badgeBg: "rgba(245,158,11,0.12)",
                  badgeColor: "#d97706",
                  allocations: [
                    { name: "Reksa Dana Saham / Saham", pct: 50, val: customValue * 0.5 },
                    { name: "Reksa Dana Pasar Uang", pct: 30, val: customValue * 0.3 },
                    { name: "Aset Kripto", pct: 20, val: customValue * 0.2 },
                  ],
                  reason: "Mengejar pertumbuhan return tertinggi dengan toleransi fluktuasi pasar dinamis. Cocok untuk jangka panjang (>3 tahun).",
                },
                {
                  id: "emas",
                  title: "Safe Haven Murni (100% Emas Fisik)",
                  badge: "Anti Krisis",
                  badgeBg: "rgba(251,191,36,0.15)",
                  badgeColor: "#b45309",
                  allocations: [
                    { name: "Emas Antam 1 Gram", pct: 100, val: customValue },
                  ],
                  reason: "Instrumen fisik bebas risiko pihak ketiga, terbukti mempertahankan daya beli selama ratusan tahun dan likuid dijual sewaktu-waktu.",
                },
              ].map((s) => (
                <div
                  key={s.id}
                  style={{
                    borderRadius: 12, padding: "16px",
                    background: "hsl(var(--bg-base))",
                    border: "1px solid hsl(var(--border))",
                    display: "flex", flexDirection: "column", gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "hsl(var(--text-primary))" }}>
                      {s.title}
                    </div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: s.badgeColor, background: s.badgeBg, padding: "2px 8px", borderRadius: 6 }}>
                      {s.badge}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    {s.allocations.map((a, i) => (
                      <div key={i} style={{ background: "hsl(var(--bg-surface))", padding: "8px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
                        <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>{a.name} ({a.pct}%)</div>
                        <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "hsl(var(--primary))" }}>{formatIDR(Math.round(a.val))}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))", margin: 0, lineHeight: 1.55 }}>
                    💡 <strong>Alasan:</strong> {s.reason}
                  </p>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "6px 12px", gap: 6 }}
                      onClick={() => {
                        applyPreset(s.id as any);
                        setShowRecommendationModal(false);
                      }}
                    >
                      <Check size={13} />
                      Terapkan Alokasi Ini
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--bg-surface))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>
                Klik tombol "Terapkan Alokasi Ini" untuk otomatis mengisi form parameter.
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRecommendationModal(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL KONVERSI EMAS & TRANSCRIPT (FROM CARD BUTTON)
         ═══════════════════════════════════════════════════════════════════════ */}
      {showGoldModal && (() => {
        const goldList: Array<{ key: "ANTAM_1GR" | "ANTAM_5GR" | "UBS_1GR"; label: string; unitWeight: number }> = [
          { key: "ANTAM_1GR", label: "Emas Antam 1 Gram", unitWeight: 1 },
          { key: "ANTAM_5GR", label: "Emas Antam 5 Gram", unitWeight: 5 },
          { key: "UBS_1GR", label: "Emas UBS 1 Gram", unitWeight: 1 },
        ];
        const modalValue = customValue > 0 ? customValue : 10000000;

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 1100,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowGoldModal(false); }}
          >
            <div
              className="card animate-fade-in-up"
              style={{
                maxWidth: 680, width: "100%", maxHeight: "90vh",
                display: "flex", flexDirection: "column", overflow: "hidden",
                padding: 0, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              }}
            >
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(251,191,36,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#b45309" }}>
                    <Coins size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "hsl(var(--text-primary))", margin: 0 }}>
                      Transcript Nilai &amp; Konversi Harga Emas
                    </h3>
                    <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", margin: "2px 0 0" }}>
                      Konversi presisi modal {formatIDR(modalValue)} ke gram emas Antam &amp; UBS
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGoldModal(false)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--bg-base))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "hsl(var(--text-secondary))" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Info Note */}
                <div style={{ padding: "10px 14px", background: "rgba(251,191,36,0.08)", borderRadius: 10, border: "1px solid rgba(251,191,36,0.2)", fontSize: "0.8rem", color: "#92400e", lineHeight: 1.55 }}>
                  💡 <strong>Informasi Konversi:</strong> Satuan disajikan dalam <strong>bilangan desimal presisi (5 digit di belakang koma)</strong> sesuai satuan data aset (per 1 gram untuk Antam 1g &amp; UBS, dan per 5 gram untuk Antam 5g).
                </div>

                {/* 3 Gold Types Grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {goldList.map((g) => {
                    const asset = availableAssets.find((a) => a.symbol === g.key);
                    const rawPrice = asset?.harga_terkini ?? 0;
                    const isAntam5 = g.key === "ANTAM_5GR";
                    const units = rawPrice > 0 ? modalValue / rawPrice : 0;

                    return (
                      <div
                        key={g.key}
                        style={{
                          borderRadius: 12, padding: "16px",
                          background: "hsl(var(--bg-base))",
                          border: "1.5px solid rgba(251,191,36,0.3)",
                          display: "flex", flexDirection: "column", gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>
                              {g.label}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                              Harga Satuan: <strong>{rawPrice > 0 ? formatIDR(rawPrice) : "Memuat..."}</strong> per {g.unitWeight} gram
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.72rem", color: "#92400e", fontWeight: 600 }}>Dapat Memiliki:</div>
                            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#b45309", lineHeight: 1.1 }}>
                              {units > 0 ? units.toLocaleString("id-ID", { minimumFractionDigits: 5, maximumFractionDigits: 5 }) : "0,00000"} {isAntam5 ? "(5 gram)" : "gram"}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid hsl(var(--border))" }}>
                          <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>
                            {isAntam5
                              ? `Total ${(units * 5).toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} gram murni (satuan 5 gram)`
                              : `Total ${units > 0 ? units.toFixed(3) : 0} gram murni`}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: "0.73rem", padding: "5px 10px" }}
                            onClick={() => {
                              if (portfolioId !== "custom") setPortfolioId("custom");
                              if (asset) {
                                const newWeights: Record<string, number> = {};
                                availableAssets.forEach((a) => { newWeights[a.id] = a.id === asset.id ? 100 : 0; });
                                setWeights(newWeights);
                                setGoldType(g.key);
                              }
                              setShowGoldModal(false);
                            }}
                          >
                            Pilih Emas Ini (100%)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--bg-surface))", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowGoldModal(false)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL DETAIL RIWAYAT SIMULASI VAR
         ═══════════════════════════════════════════════════════════════════════ */}
      {selectedHistoryDetail && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedHistoryDetail(null); }}
        >
          <div
            className="card animate-fade-in-up"
            style={{
              maxWidth: 680, width: "100%", maxHeight: "90vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
              padding: 0, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))" }}>
                  <Eye size={18} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "hsl(var(--text-primary))", margin: 0 }}>
                    {selectedHistoryDetail.label || "Detail Riwayat Simulasi VaR"}
                  </h3>
                  <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", margin: "2px 0 0" }}>
                    Disimpan pada {formatDateShort(selectedHistoryDetail.created_at)} · Portofolio: {selectedHistoryDetail.portfolio?.name || "Kustom Komposisi"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryDetail(null)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--bg-base))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "hsl(var(--text-secondary))" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Parameter Digunakan Grid */}
              <div style={{ background: "hsl(var(--bg-base))", borderRadius: 12, padding: "14px 16px", border: "1px solid hsl(var(--border))" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--text-secondary))", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Parameter yang Digunakan
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>Modal Investasi</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>
                      {formatIDR(selectedHistoryDetail.result.portfolio_value)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>Tingkat Keyakinan</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--primary))" }}>
                      {(selectedHistoryDetail.result.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>Waktu Ditahan</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--accent))" }}>
                      {selectedHistoryDetail.result.holding_period} hari
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>Data Historis</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>
                      {selectedHistoryDetail.result.num_observations} hari
                    </div>
                  </div>
                </div>
              </div>

              {/* Hasil Perhitungan Utama */}
              <div style={{ borderRadius: 12, padding: "16px", background: "linear-gradient(135deg, rgba(225,29,72,0.06) 0%, rgba(245,158,11,0.04) 100%)", border: "1.5px solid rgba(225,29,72,0.2)" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--danger))", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Hasil Perhitungan Risiko (VaR)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                  <div style={{ background: "hsl(var(--bg-surface))", padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))" }}>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Batas Kerugian Maksimum (VaR Rp)</div>
                    <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "hsl(var(--danger))", marginTop: 2 }}>
                      -{formatIDR(selectedHistoryDetail.result.var_value)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--danger))", fontWeight: 600, marginTop: 2 }}>
                      {formatPct(selectedHistoryDetail.result.var_percentage * 100)} dari total modal
                    </div>
                  </div>

                  <div style={{ background: "hsl(var(--bg-surface))", padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))" }}>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Rata-rata Return Harian</div>
                    <div style={{ fontWeight: 800, fontSize: "1.4rem", color: selectedHistoryDetail.result.mean_return >= 0 ? "hsl(var(--primary))" : "hsl(var(--danger))", marginTop: 2 }}>
                      {formatPct(selectedHistoryDetail.result.mean_return * 100)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                      ~{selectedHistoryDetail.result.mean_return >= 0 ? "+" : ""}{formatIDR(Math.round(selectedHistoryDetail.result.mean_return * selectedHistoryDetail.result.portfolio_value))}/hari
                    </div>
                  </div>

                  <div style={{ background: "hsl(var(--bg-surface))", padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))" }}>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Tingkat Guncangan (Volatilitas)</div>
                    <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "hsl(var(--text-primary))", marginTop: 2 }}>
                      ±{(selectedHistoryDetail.result.std_return * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                      ~±{formatIDR(Math.round(selectedHistoryDetail.result.std_return * selectedHistoryDetail.result.portfolio_value))}/hari
                    </div>
                  </div>

                  <div style={{ background: "hsl(var(--bg-surface))", padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))" }}>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>Efisiensi Risiko (Sharpe Ratio)</div>
                    <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "hsl(var(--accent))", marginTop: 2 }}>
                      {selectedHistoryDetail.result.std_return > 0 ? (selectedHistoryDetail.result.mean_return / selectedHistoryDetail.result.std_return).toFixed(3) : "0.000"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                      Reward per unit risiko
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--bg-surface))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <button
                className="btn btn-danger btn-sm"
                style={{ gap: 5 }}
                onClick={() => {
                  const id = selectedHistoryDetail.id;
                  setSelectedHistoryDetail(null);
                  handleDeleteHistory(id);
                }}
              >
                <Trash2 size={13} />
                Hapus Riwayat Ini
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ gap: 6 }}
                  onClick={() => {
                    const h = selectedHistoryDetail;
                    if (h.params.portfolio_id) setPortfolioId(h.params.portfolio_id);
                    if (h.params.confidence) setConfidence(h.params.confidence);
                    if (h.params.period_days) setPeriodDays(h.params.period_days);
                    if (h.params.holding_period) setHoldingPeriod(h.params.holding_period);
                    if (h.result.portfolio_value) setCustomValue(h.result.portfolio_value);
                    setSelectedHistoryDetail(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <RotateCcw size={13} />
                  Muat Parameter Ini ke Simulator
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedHistoryDetail(null)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function SimulasiPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 400, borderRadius: 16 }} />}>
      <SimulasiContent />
    </Suspense>
  );
}
