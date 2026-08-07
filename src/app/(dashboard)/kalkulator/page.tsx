"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Calculator, TrendingUp, Info, AlertTriangle, ChevronDown, HelpCircle,
  Sparkles, Save, Trash2, BarChart2, X, Check, Award, ThumbsUp, ShieldCheck
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart, BarChart, Bar, Cell
} from "recharts";
import { formatIDR, formatPct, formatNumberSeparator, parseNumberSeparator, formatDateShort } from "@/lib/utils";
import { computeCompoundInterest } from "@/lib/engines";
import type { CompoundResult } from "@/types";

// ─── History record type ──────────────────────────────────────────────────────
interface CompoundHistoryRecord {
  id: string;
  label: string | null;
  params: {
    principal: number;
    annual_rate?: number;
    tenor_years: number;
    frequency: string;
    custom_frequency?: number;
    additional_monthly?: number;
    use_dynamic?: boolean;
    portfolio_id?: string;
    [key: string]: unknown;
  };
  result: {
    final_value: number;
    total_interest: number;
    total_contributed: number;
    effective_rate: number;
    projection: Array<{
      period: number;
      label: string;
      sub_label?: string;
      value: number;
      interest_earned: number;
      total_contributed: number;
    }>;
    periodic_projection?: Array<{
      period: number;
      label: string;
      sub_label?: string;
      value: number;
      interest_earned: number;
      total_contributed: number;
    }>;
  };
  created_at: string;
  portfolio: { name: string } | null;
}

// ─── Tooltip "?" kecil ────────────────────────────────────────────
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
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 5 }}>
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
        }}
        aria-label="Info"
      >
        <HelpCircle size={11} />
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)",
          background: "hsl(var(--text-primary))", color: "#fff",
          borderRadius: 10, padding: "10px 14px",
          fontSize: "0.78rem", lineHeight: 1.55,
          width: 230, zIndex: 200,
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)",
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid hsl(var(--text-primary))",
          }} />
          {text}
        </div>
      )}
    </div>
  );
}

const FREQ_OPTIONS = [
  { value: "monthly", label: "Bulanan", times: 12 },
  { value: "quarterly", label: "Triwulanan", times: 4 },
  { value: "annually", label: "Tahunan", times: 1 },
  { value: "custom", label: "Kustom", times: null },
];

export default function KalkulatorPage() {
  const [principal, setPrincipal] = useState(0);
  const [annualRate, setAnnualRate] = useState(0);
  const [tenorYears, setTenorYears] = useState(0);
  const [frequency, setFrequency] = useState("monthly");
  const [customFrequency, setCustomFrequency] = useState<number>(2);
  const [additionalMonthly, setAdditionalMonthly] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"yearly" | "periodic">("yearly");
  const currentYear = new Date().getFullYear();

  const [result, setResult] = useState<CompoundResult | null>(null);
  const [error, setError] = useState("");

  // Dynamic returns states
  const [rateType, setRateType] = useState<"static" | "dynamic">("static");
  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);
  const [portfolioId, setPortfolioId] = useState("");
  const [availableAssets, setAvailableAssets] = useState<{ id: string; name: string; type: string; symbol: string }[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

  // History & Save states
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [history, setHistory] = useState<CompoundHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // History fetch
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/simulate/compound/history");
      const json = await res.json();
      if (json.data) setHistory(json.data);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSavedMsg("");

    const customHoldings = Object.entries(weights)
      .filter(([_, w]) => w > 0)
      .map(([assetId, w]) => ({ asset_id: assetId, weight: w / 100 }));

    try {
      await fetch("/api/simulate/compound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principal,
          annual_rate: rateType === "static" ? annualRate / 100 : undefined,
          tenor_years: tenorYears,
          frequency,
          custom_frequency: frequency === "custom" ? customFrequency : undefined,
          additional_monthly: additionalMonthly,
          portfolio_id: rateType === "dynamic" ? portfolioId : undefined,
          use_dynamic: rateType === "dynamic",
          custom_holdings: rateType === "dynamic" && portfolioId === "custom" ? customHoldings : undefined,
          save: true,
          label: saveLabel || null,
        }),
      });

      setSavedMsg("✓ Tersimpan ke Riwayat!");
      setSaveLabel("");
      fetchHistory();
      setTimeout(() => setSavedMsg(""), 3000);
    } catch {
      // ignore
    }
    setSaving(false);
  };

  const handleDeleteHistory = async (id: string) => {
    setDeletingId(id);
    await fetch("/api/simulate/compound/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    fetchHistory();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const supabase = createClient();
    const loadPortfolios = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("portfolios")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at");
      setPortfolios(data ?? []);
      if (data && data.length > 0) setPortfolioId(data[0].id);
      else setPortfolioId("custom");
    };

    const loadAssets = async () => {
      const res = await fetch("/api/assets");
      const json = await res.json();
      if (json.data) {
        const flattened = json.data.flatMap((g: any) => g.assets);
        setAvailableAssets(flattened);
        // Pre-fill weights
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

  const totalWeight = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  // Live calculation for static rate (only when user has provided inputs)
  useEffect(() => {
    if (rateType === "static") {
      if ((principal <= 0 && additionalMonthly <= 0) || tenorYears <= 0) {
        setResult(null);
        return;
      }
      try {
        const res = computeCompoundInterest({
          principal: Math.max(0, principal),
          annual_rate: Math.max(0, annualRate) / 100,
          tenor_years: Math.max(1, tenorYears),
          frequency,
          custom_frequency: customFrequency,
          additional_monthly: Math.max(0, additionalMonthly),
        });
        setResult(res);
        setError("");
      } catch (err: any) {
        setError(err?.message || "Gagal menghitung proyeksi.");
      }
    }
  }, [rateType, principal, annualRate, tenorYears, frequency, customFrequency, additionalMonthly]);

  const handleCalculate = useCallback(async () => {
    if (principal <= 0 && additionalMonthly <= 0) {
      setError("Silakan masukkan Modal Awal atau Setoran Bulanan lebih dari 0.");
      return;
    }
    if (tenorYears <= 0) {
      setError("Silakan tentukan Jangka Waktu investasi minimal 1 tahun.");
      return;
    }

    if (rateType === "static") {
      const res = computeCompoundInterest({
        principal: Math.max(0, principal),
        annual_rate: Math.max(0, annualRate) / 100,
        tenor_years: Math.max(1, tenorYears),
        frequency,
        custom_frequency: customFrequency,
        additional_monthly: Math.max(0, additionalMonthly),
      });
      setResult(res);
      setError("");
      return;
    }

    setLoading(true); setError("");

    const customHoldings = Object.entries(weights)
      .filter(([_, w]) => w > 0)
      .map(([assetId, w]) => ({
        asset_id: assetId,
        weight: w / 100,
      }));

    try {
      const res = await fetch("/api/simulate/compound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principal: Math.max(0, principal),
          annual_rate: annualRate / 100,
          tenor_years: tenorYears,
          frequency: frequency === "custom" ? "custom" : frequency,
          custom_frequency: frequency === "custom" ? customFrequency : undefined,
          additional_monthly: additionalMonthly,
          use_dynamic: rateType === "dynamic",
          portfolio_id: rateType === "dynamic" ? portfolioId : undefined,
          custom_holdings: rateType === "dynamic" && portfolioId === "custom" ? customHoldings : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Terjadi kesalahan saat menghitung return dinamis.");
      } else {
        setResult(json.data);
      }
    } catch (e: any) {
      setError("Gagal terhubung ke server. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  }, [principal, annualRate, tenorYears, frequency, customFrequency, additionalMonthly, rateType, portfolioId, weights]);

  const inputRow = (
    label: string,
    id: string,
    value: number,
    onChange: (v: number) => void,
    prefix?: string,
    suffix?: string,
    min = 0,
    max = 100000000000
  ) => {
    const isCurrency = prefix === "Rp";
    return (
      <div>
        {label && (
          <label htmlFor={id} style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
            {label}
          </label>
        )}
        <div style={{ position: "relative" }}>
          {prefix && (
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--text-muted))", fontSize: "0.85rem", pointerEvents: "none" }}>
              {prefix}
            </span>
          )}
          {isCurrency ? (
            <input
              id={id}
              type="text"
              inputMode="numeric"
              className="input-base"
              style={{ paddingLeft: prefix ? 40 : 14, paddingRight: suffix ? 44 : 14 }}
              value={formatNumberSeparator(value)}
              onChange={(e) => {
                const parsed = parseNumberSeparator(e.target.value);
                onChange(Math.min(max, Math.max(min, parsed)));
              }}
              placeholder="0"
            />
          ) : (
            <input
              id={id}
              type="number"
              className="input-base"
              style={{ paddingLeft: prefix ? 40 : 14, paddingRight: suffix ? 44 : 14 }}
              value={value}
              min={min}
              max={max}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          )}
          {suffix && (
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--text-muted))", fontSize: "0.85rem", pointerEvents: "none" }}>
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in-up w-full flex-1">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
          Kalkulator Bunga Berbunga
        </h1>
        <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>
          Hitung perkiraan uang Anda di masa depan dengan sistem keuntungan yang ditabung kembali (Compound Interest).
        </p>
      </div>

      {/* Info */}
      <div
        style={{
          background: "rgba(34, 197, 94, 0.1)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          display: "flex", gap: 12, alignItems: "flex-start",
        }}
      >
        <Info size={16} color="hsl(var(--primary))" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--primary-dark))", lineHeight: 1.6 }}>
          <strong>Bagaimana cara kerjanya?</strong> Keuntungan (bunga) yang Anda dapatkan tidak ditarik, melainkan ditambahkan ke modal awal. Sehingga, pada periode berikutnya, Anda mendapatkan keuntungan yang lebih besar karena modal Anda juga sudah bertambah. Begitu seterusnya!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Input panel */}
        <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))", marginBottom: 4 }}>
            Isi Data Berikut
          </h2>

          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <label htmlFor="ci-principal" style={{ fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))" }}>
              Modal Awal (Rp)
            </label>
            <InfoTooltip text="Ini adalah uang yang Anda investasikan di awal. Semakin besar modal awal, semakin besar pula keuntungan yang bisa Anda dapatkan dari efek bunga berbunga." />
          </div>
          {inputRow("", "ci-principal", principal, setPrincipal, "Rp", undefined, 1000)}

          {/* Rate type toggle */}
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 8 }}>
              Tipe Suku Bunga / Keuntungan
              <InfoTooltip text="Tetap (Flat): Anda menentukan sendiri persen keuntungan per tahun secara manual. Dinamis (Historis): Sistem menghitung otomatis berdasarkan data harga aset/portofolio Anda di masa lalu." />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: "static", label: "Tetap (Flat)" },
                { value: "dynamic", label: "Dinamis (Historis)" }
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={rateType === t.value ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  style={{ flex: 1, fontSize: "0.75rem" }}
                  onClick={() => setRateType(t.value as any)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {rateType === "static" ? (
            <div>
              <label htmlFor="ci-rate" style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                Suku Bunga Tahunan: <span style={{ color: "hsl(var(--primary))", marginLeft: 4 }}>{annualRate}%</span>
                <InfoTooltip text="Persentase keuntungan yang Anda dapatkan dalam 1 tahun. Contoh: deposito bank biasanya 4-7%, reksa dana bisa 8-15% per tahun, saham bervariasi lebih besar." />
              </label>
              <input
                id="ci-rate"
                type="range" min={0} max={30} step={0.5}
                value={annualRate}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                style={{ width: "100%", accentColor: "hsl(var(--primary))" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                <span>0%</span><span>30%</span>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label htmlFor="ci-portfolio" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                  Acuan Portofolio / Aset
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    id="ci-portfolio"
                    className="input-base"
                    style={{ appearance: "none", paddingRight: 36, fontSize: "0.82rem" }}
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                  >
                    <option value="custom">Kustom Komposisi (Aset Pilihan)</option>
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>

              {portfolioId === "custom" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, background: "hsl(var(--bg-base))", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "hsl(var(--text-secondary))", marginBottom: 4 }}>
                    Alokasi Aset (Total: <span style={{ color: totalWeight === 100 ? "hsl(var(--primary))" : "hsl(var(--danger))", fontWeight: 700 }}>{totalWeight}%</span>)
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto", paddingRight: 4 }}>
                    {availableAssets.map((asset) => (
                      <div key={asset.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-primary))", flex: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={asset.name}>
                          {asset.name}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            min={0} max={100}
                            className="input-base"
                            value={weights[asset.id] ?? 0}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, Number(e.target.value)));
                              setWeights(prev => ({ ...prev, [asset.id]: val }));
                            }}
                            style={{ width: 55, padding: "4px 6px", fontSize: "0.72rem", textAlign: "right" }}
                          />
                          <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalWeight !== 100 && (
                    <p style={{ fontSize: "0.68rem", color: "hsl(var(--danger))", display: "flex", gap: 2, alignItems: "center" }}>
                      <AlertTriangle size={10} /> Alokasi harus 100%
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="ci-tenor" style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
              Jangka Waktu: <span style={{ color: "hsl(var(--primary))", marginLeft: 4 }}>{tenorYears} tahun</span>
              <InfoTooltip text="Berapa lama Anda akan membiarkan uang Anda berinvestasi. Makin panjang jangka waktu, makin besar efek bunga berbunga — uang Anda bisa berlipat ganda berkali-kali!" />
            </label>
            <input
              id="ci-tenor"
              type="range" min={0} max={50} step={1}
              value={tenorYears}
              onChange={(e) => setTenorYears(Number(e.target.value))}
              style={{ width: "100%", accentColor: "hsl(var(--primary))" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
              <span>0 tahun</span><span>50 tahun</span>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 8 }}>
              Berapa Kali Bunga Dibagikan?
              <InfoTooltip text="Seberapa sering keuntungan Anda dihitung dan ditambahkan ke modal. Makin sering (misal: bulanan vs tahunan), makin cepat uang Anda bertumbuh karena bunganya juga ikut berbunga lebih cepat." />
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FREQ_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={frequency === f.value ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  style={{ fontSize: "0.72rem", padding: "6px 8px" }}
                  onClick={() => setFrequency(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {frequency === "custom" && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="ci-custom-freq"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={customFrequency}
                  onChange={(e) => setCustomFrequency(Math.max(1, Math.min(365, Number(e.target.value))))}
                  style={{
                    width: 80,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1.5px solid hsl(var(--border))",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    outline: "none",
                    textAlign: "center",
                  }}
                />
                <span style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))" }}>kali per tahun</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <label htmlFor="ci-additional" style={{ fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))" }}>
              Setoran Bulanan (Rp)
            </label>
            <InfoTooltip text="Uang tambahan yang Anda investasikan setiap bulan secara rutin. Meski jumlahnya kecil, jika dilakukan konsisten selama bertahun-tahun, dampaknya sangat besar terhadap total kekayaan akhir Anda." />
          </div>
          {inputRow("", "ci-additional", additionalMonthly, setAdditionalMonthly, "Rp", undefined, 0)}

          <button
            id="btn-calculate"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={handleCalculate}
            disabled={loading || (rateType === "dynamic" && portfolioId === "custom" && totalWeight !== 100)}
          >
            {loading ? "Menghitung..." : <><Calculator size={15} /> Hitung Perkiraan Hasil</>}
          </button>

          {error && (
            <div style={{ background: "rgba(225, 29, 72, 0.08)", border: "1px solid rgba(225, 29, 72, 0.2)", borderRadius: 8, padding: "10px 14px", fontSize: "0.83rem", color: "hsl(var(--danger))", display: "flex", gap: 8, alignItems: "center" }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
        </div>

        {/* Result panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!result && !loading && (
            <div className="card" style={{ padding: 64, textAlign: "center", borderStyle: "dashed" }}>
              <TrendingUp size={40} color="hsl(var(--text-muted))" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>
                Isi parameter di kiri lalu klik <strong style={{ color: "hsl(var(--text-primary))" }}>"Hitung Perkiraan Hasil"</strong>
              </p>
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[100, 280, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 16 }} />)}
            </div>
          )}

          {result && (
            <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Nilai Akhir",
                    value: formatIDR(result.final_value),
                    color: "hsl(var(--primary))",
                    sub: `Dalam ${tenorYears} Tahun (${currentYear} – ${currentYear + tenorYears})`,
                  },
                  {
                    label: "Total Bunga",
                    value: formatIDR(result.total_interest),
                    color: "hsl(var(--accent))",
                    sub: `${((result.total_interest / Math.max(1, result.total_contributed)) * 100).toFixed(1)}% dari modal`,
                  },
                  {
                    label: "Total Modal",
                    value: formatIDR(result.total_contributed),
                    color: "hsl(var(--text-primary))",
                    sub: rateType === "static"
                      ? `Rate efektif: ${(result.effective_rate * 100).toFixed(2)}%/thn`
                      : `Rata-rata rate: ${(result.effective_rate * 100).toFixed(2)}%/thn`,
                  },
                ].map((s) => (
                  <div key={s.label} className="stat-card">
                    <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                      {s.label}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: s.color, lineHeight: 1 }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", marginTop: 4 }}>
                      {s.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Area chart */}
              <div className="card py-4 sm:py-0 overflow-hidden">
                <div className="flex flex-col items-stretch border-b border-[hsl(var(--border))] sm:flex-row p-0">
                  <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0 py-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-[hsl(var(--text-primary))]">
                        Grafik Pertumbuhan Uang Anda {rateType === "dynamic" && "(Dinamis)"}
                      </h3>
                      {result.periodic_projection && result.periodic_projection.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-[hsl(var(--bg-base))] p-1 rounded-lg border border-[hsl(var(--border))]">
                          <button
                            type="button"
                            onClick={() => setViewMode("yearly")}
                            className={viewMode === "yearly" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                            style={{ fontSize: "0.72rem", padding: "4px 8px", height: "auto" }}
                          >
                            Tahunan ({tenorYears} Thn)
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode("periodic")}
                            className={viewMode === "periodic" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                            style={{ fontSize: "0.72rem", padding: "4px 8px", height: "auto" }}
                          >
                            {frequency === "monthly" ? "Per Bulan" : frequency === "quarterly" ? "Per Triwulan" : frequency === "daily" ? "Per Hari" : "Per Frekuensi"}
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">
                      Menampilkan proyeksi nilai investasi selama {tenorYears} tahun ({currentYear} – {currentYear + tenorYears}) berdasarkan {rateType === "static" ? "keuntungan tetap" : "keuntungan historis dinamis"}
                    </p>
                  </div>
                  <div className="flex">
                    <button
                      className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                    >
                      <span className="text-xs text-[hsl(var(--text-muted))]">
                        Nilai Akhir
                      </span>
                      <span className="text-lg leading-none font-bold sm:text-2xl text-[hsl(var(--primary))] truncate">
                        {formatIDR(result.final_value)}
                      </span>
                    </button>
                    <button
                      className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                    >
                      <span className="text-xs text-[hsl(var(--text-muted))]">
                        Total Modal
                      </span>
                      <span className="text-lg leading-none font-bold sm:text-2xl text-[hsl(var(--accent))] truncate">
                        {formatIDR(result.total_contributed)}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="p-4 sm:p-6 mt-2">
                  <div className="aspect-auto h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(viewMode === "periodic" && result.periodic_projection) ? result.periodic_projection : result.projection}
                        margin={{ top: 4, right: 20, bottom: 0, left: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorContrib" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "hsl(var(--text-muted))" }}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={12}
                          interval={Math.max(0, Math.floor(((viewMode === "periodic" && result.periodic_projection) ? result.periodic_projection : result.projection).length / 6))}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "hsl(var(--text-muted))" }}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(v) => formatIDR(v, true)}
                          width={75}
                        />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--text-primary))", fontSize: "0.82rem", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                          formatter={(v, name) => [formatIDR(Number(v)), name === "value" ? "Total Nilai" : "Total Modal"]}
                        />
                        <Legend formatter={(v) => <span style={{ color: "hsl(var(--text-secondary))", fontSize: "0.78rem" }}>{v === "value" ? "Total Nilai" : "Total Modal"}</span>} />
                        <Area type="monotone" dataKey="total_contributed" stroke="hsl(var(--accent))" fill="url(#colorContrib)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#colorValue)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Projection table */}
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(var(--text-primary))" }}>
                      Rincian Pertumbuhan per Periode ({viewMode === "yearly" ? `Tahunan: ${tenorYears} Tahun (${currentYear} – ${currentYear + tenorYears})` : `Rincian ${frequency === "monthly" ? "Bulanan" : frequency === "quarterly" ? "Triwulanan" : "Frekuensi"}`})
                    </h3>
                    <p style={{ fontSize: "0.76rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                      Melihat kronologi penambahan modal dan akumulasi bunga berbunga
                    </p>
                  </div>
                  {result.periodic_projection && result.periodic_projection.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-[hsl(var(--bg-base))] p-1 rounded-lg border border-[hsl(var(--border))]">
                      <button
                        type="button"
                        onClick={() => setViewMode("yearly")}
                        className={viewMode === "yearly" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                        style={{ fontSize: "0.72rem", padding: "4px 8px", height: "auto" }}
                      >
                        Tahunan
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("periodic")}
                        className={viewMode === "periodic" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                        style={{ fontSize: "0.72rem", padding: "4px 8px", height: "auto" }}
                      >
                        {frequency === "monthly" ? "Per Bulan" : frequency === "quarterly" ? "Per Triwulan" : "Per Frekuensi"}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ overflowX: "auto", maxHeight: 420 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                      <tr style={{ background: "hsl(var(--bg-base))" }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Periode
                        </th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Masa Waktu
                        </th>
                        <th style={{ padding: "10px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Total Nilai
                        </th>
                        <th style={{ padding: "10px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Total Modal
                        </th>
                        <th style={{ padding: "10px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Bunga Kumulatif
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {((viewMode === "periodic" && result.periodic_projection) ? result.periodic_projection : result.projection).map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                          <td style={{ padding: "10px 16px", color: "hsl(var(--text-primary))", fontWeight: 600 }}>
                            {row.label}
                          </td>
                          <td style={{ padding: "10px 16px", color: "hsl(var(--text-muted))", fontSize: "0.78rem" }}>
                            {row.sub_label || (row.period === 0 ? "Awal Investasi" : `Tahun ke-${row.period}`)}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "hsl(var(--primary))" }}>
                            {formatIDR(row.value)}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right", color: "hsl(var(--accent))" }}>
                            {formatIDR(row.total_contributed)}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right", color: "hsl(var(--text-muted))" }}>
                            {formatIDR(row.interest_earned)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Save to history card */}
              <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: "hsl(var(--bg-surface))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
                  <Save size={18} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Beri label (opsional, contoh: Target Pensiun 2036)"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    style={{ fontSize: "0.83rem", padding: "6px 12px", height: "auto" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {savedMsg && (
                    <span style={{ fontSize: "0.82rem", color: "hsl(var(--success))", fontWeight: 600 }}>
                      {savedMsg}
                    </span>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ gap: 6 }}
                  >
                    <Save size={14} />
                    {saving ? "Menyimpan..." : "Simpan ke Riwayat"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          HISTORY TABLE
         ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: "1.1rem", color: "hsl(var(--text-primary))", display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart2 size={20} /> Riwayat Simulasi Bunga Berbunga
            </h2>
            <p style={{ fontSize: "0.78rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
              Daftar skenario investasi yang pernah Anda simpan. Pilih 2 atau lebih simulasi untuk membandingkan.
            </p>
          </div>
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
              Belum ada simulasi yang disimpan. Atur parameter, lalu klik <strong>"Simpan ke Riwayat"</strong>.
            </p>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid hsl(var(--border))", background: "hsl(var(--bg-base))" }}>
                    <th style={{ padding: "12px 10px", textAlign: "center", width: 40 }}>
                      <span style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>Pilih</span>
                    </th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Tanggal</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Label Skenario</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Tipe & Suku Bunga</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Modal Awal</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Tenor</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Setoran/Bln</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Total Bunga</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>Nilai Akhir</th>
                    <th style={{ padding: "12px 10px", textAlign: "center", width: 50 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const isDynamic = Boolean(h.params?.use_dynamic);
                    const effRatePct = (h.result.effective_rate * 100).toFixed(2);
                    return (
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
                          {isDynamic ? (
                            <span className="badge badge-info" style={{ fontSize: "0.72rem" }}>
                              Dinamis: {h.portfolio?.name || "Kustom"} (~{effRatePct}%)
                            </span>
                          ) : (
                            <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(16,185,129,0.1)", color: "hsl(var(--primary))" }}>
                              Tetap: {effRatePct}%/thn
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "hsl(var(--text-primary))" }}>
                          {formatIDR(Number(h.params.principal) || 0)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {h.params.tenor_years} thn
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "hsl(var(--text-secondary))" }}>
                          {formatIDR(Number(h.params.additional_monthly) || 0)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "hsl(var(--accent))" }}>
                          {formatIDR(h.result.total_interest)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "hsl(var(--primary))" }}>
                          {formatIDR(h.result.final_value)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 8px" }}
                            onClick={() => handleDeleteHistory(h.id)}
                            disabled={deletingId === h.id}
                            title="Hapus"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

        // Evaluasi dan ranking
        const evaluated = selected.map((s, index) => {
          const labelText = s.label || (s.params.use_dynamic ? (s.portfolio?.name || "Kustom Dinamis") : `Skenario ${index + 1}`);
          const finalVal = s.result.final_value;
          const totalContrib = s.result.total_contributed;
          const totalInt = s.result.total_interest;
          const roi = totalContrib > 0 ? (totalInt / totalContrib) * 100 : 0;
          const monthly = Number(s.params.additional_monthly) || 0;
          const effRate = s.result.effective_rate;

          return {
            ...s,
            simIndex: index + 1,
            labelText,
            finalVal,
            totalContrib,
            totalInt,
            roi,
            monthly,
            effRate,
          };
        });

        // 1. Akumulasi Kekayaan Terbesar
        const bestWealth = [...evaluated].sort((a, b) => b.finalVal - a.finalVal)[0];
        // 2. Efisiensi Penggandaan Modal (ROI Tertinggi)
        const bestROI = [...evaluated].sort((a, b) => b.roi - a.roi)[0];
        // 3. Arus Kas Terhemat
        const bestBudget = [...evaluated].sort((a, b) => a.totalContrib - b.totalContrib)[0];

        const chartData = evaluated.map((e) => ({
          name: e.labelText.length > 14 ? e.labelText.substring(0, 12) + "…" : e.labelText,
          "Total Modal": e.totalContrib,
          "Nilai Akhir": e.finalVal,
        }));

        const rows: { label: string; key: string; format: (h: typeof evaluated[0]) => string; highlightBest?: "max" | "min" }[] = [
          {
            label: "Modal Awal",
            key: "principal",
            format: (h) => formatIDR(Number(h.params.principal) || 0),
          },
          {
            label: "Jangka Waktu (Tenor)",
            key: "tenor",
            format: (h) => `${h.params.tenor_years} Tahun`,
          },
          {
            label: "Frekuensi Compounding",
            key: "frequency",
            format: (h) => h.params.frequency === "monthly" ? "Bulanan (12x/thn)" : h.params.frequency === "quarterly" ? "Triwulanan (4x/thn)" : h.params.frequency === "annually" ? "Tahunan (1x/thn)" : `Kustom (${h.params.custom_frequency || "-"}x/thn)`,
          },
          {
            label: "Setoran Bulanan Rutin",
            key: "additional",
            format: (h) => formatIDR(Number(h.params.additional_monthly) || 0),
          },
          {
            label: "Suku Bunga Efektif (EAR)",
            key: "effRate",
            format: (h) => `${(h.effRate * 100).toFixed(2)}% / tahun`,
            highlightBest: "max",
          },
          {
            label: "Total Modal Disetor",
            key: "totalContrib",
            format: (h) => formatIDR(h.totalContrib),
          },
          {
            label: "Total Keuntungan Bunga",
            key: "totalInt",
            format: (h) => formatIDR(h.totalInt),
            highlightBest: "max",
          },
          {
            label: "Penggandaan Modal (ROI)",
            key: "roi",
            format: (h) => `+${h.roi.toFixed(1)}%`,
            highlightBest: "max",
          },
          {
            label: "Nilai Akhir Total Portofolio",
            key: "finalVal",
            format: (h) => formatIDR(h.finalVal),
            highlightBest: "max",
          },
        ];

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 12,
            }}
            onClick={() => setShowCompare(false)}
          >
            <div
              style={{
                background: "hsl(var(--bg-surface))",
                borderRadius: 16,
                border: "1px solid hsl(var(--border))",
                maxWidth: "98vw",
                width: Math.max(1000, Math.min(selected.length * 360 + 380, 1560)),
                maxHeight: "95vh",
                display: "flex", flexDirection: "column",
                boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.45)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div style={{ padding: "18px 28px", borderBottom: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.2rem", color: "hsl(var(--text-primary))", display: "flex", alignItems: "center", gap: 8 }}>
                    📊 Perbandingan Hasil Simulasi Bunga Berbunga
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", marginTop: 2 }}>
                    Membandingkan {selected.length} skenario investasi secara berdampingan dengan evaluasi analitis
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCompare(false)}
                  style={{ padding: "6px 10px" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: "24px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

                {/* Recommendation Box */}
                <div style={{ flexShrink: 0, background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.06) 100%)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Sparkles size={20} style={{ color: "hsl(var(--primary))" }} />
                    <h4 style={{ fontWeight: 700, fontSize: "1.02rem", color: "hsl(var(--text-primary))" }}>
                      Analisis & Rekomendasi Skenario Investasi
                    </h4>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
                    {/* Rekomendasi Akumulasi Kekayaan Maksimal */}
                    <div style={{ background: "hsl(var(--bg-surface))", borderRadius: 12, padding: "14px 18px", border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--primary))", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                          <Award size={14} /> Akumulasi Kekayaan Terbesar
                        </span>
                        <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>Nilai Akhir Juara</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--text-primary))" }}>
                        {bestWealth.labelText}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.6 }}>
                        Menghasilkan total akumulasi <strong>{formatIDR(bestWealth.finalVal)}</strong> dengan laba bunga <strong>{formatIDR(bestWealth.totalInt)}</strong>. Pilihan terbaik untuk target nominal jangka panjang.
                      </div>
                    </div>

                    {/* Rekomendasi Efisiensi Modal / ROI Tertinggi */}
                    <div style={{ background: "hsl(var(--bg-surface))", borderRadius: 12, padding: "14px 18px", border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--accent))", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                          <TrendingUp size={14} /> Penggandaan Modal (ROI) Terbaik
                        </span>
                        <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>Efisiensi Modal</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--text-primary))" }}>
                        {bestROI.labelText}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.6 }}>
                        Menghasilkan rasio penggandaan <strong>+{bestROI.roi.toFixed(1)}%</strong> terhadap modal yang disetor. Setiap rupiah modal bertumbuh paling optimal.
                      </div>
                    </div>

                    {/* Rekomendasi Arus Kas Ringan */}
                    <div style={{ background: "hsl(var(--bg-surface))", borderRadius: 12, padding: "14px 18px", border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                          <ShieldCheck size={14} /> Beban Modal Paling Ringan
                        </span>
                        <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(5,150,105,0.1)", color: "#059669" }}>Ramah Arus Kas</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--text-primary))" }}>
                        {bestBudget.labelText}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: 1.6 }}>
                        Hanya membutuhkan total modal <strong>{formatIDR(bestBudget.totalContrib)}</strong> dengan setoran bulanan <strong>{formatIDR(bestBudget.monthly)}</strong>.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparison Bar Chart */}
                <div style={{ flexShrink: 0, background: "hsl(var(--bg-base))", borderRadius: 14, padding: "20px 24px", border: "1px solid hsl(var(--border))" }}>
                  <h4 style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))", marginBottom: 14 }}>
                    Perbandingan Visual: Total Modal Disetor vs Nilai Akhir
                  </h4>
                  <div style={{ height: 280, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--text-secondary))" }} interval={0} />
                        <YAxis tick={{ fontSize: 12, fill: "hsl(var(--text-muted))" }} tickFormatter={(v) => formatIDR(v, true)} width={80} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: "0.85rem" }}
                          formatter={(v: any) => [formatIDR(Number(v)), ""]}
                        />
                        <Legend wrapperStyle={{ fontSize: "0.82rem", paddingTop: 10 }} />
                        <Bar dataKey="Total Modal" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Nilai Akhir" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Matrix Table */}
                <div style={{ flexShrink: 0, overflowX: "auto", border: "1px solid hsl(var(--border))", borderRadius: 14 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                    <thead>
                      <tr style={{ background: "hsl(var(--bg-base))", borderBottom: "1.5px solid hsl(var(--border))" }}>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 700, color: "hsl(var(--text-secondary))", width: 240, position: "sticky", left: 0, background: "hsl(var(--bg-base))", zIndex: 2 }}>
                          Parameter & Metrik
                        </th>
                        {evaluated.map((s) => (
                          <th key={s.id} style={{ padding: "14px 20px", textAlign: "right", fontWeight: 700, color: "hsl(var(--text-primary))", minWidth: 180 }}>
                            <div style={{ fontSize: "0.9rem" }}>{s.labelText}</div>
                            <div style={{ fontSize: "0.74rem", fontWeight: 400, color: "hsl(var(--text-muted))", marginTop: 2 }}>
                              {s.params.tenor_years} Thn • {formatDateShort(s.created_at)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const values = evaluated.map((e) => (row.key === "effRate" ? e.effRate : row.key === "totalInt" ? e.totalInt : row.key === "roi" ? e.roi : row.key === "finalVal" ? e.finalVal : 0));
                        const maxVal = Math.max(...values);

                        return (
                          <tr key={row.key} style={{ borderBottom: "1px solid hsl(var(--border))", background: idx % 2 === 0 ? "transparent" : "hsl(var(--bg-base) / 0.4)" }}>
                            <td style={{ padding: "12px 20px", fontWeight: 600, color: "hsl(var(--text-secondary))", position: "sticky", left: 0, background: idx % 2 === 0 ? "hsl(var(--bg-surface))" : "hsl(var(--bg-base))", zIndex: 1 }}>
                              {row.label}
                            </td>
                            {evaluated.map((s) => {
                              const isMax = row.highlightBest === "max" && (row.key === "effRate" ? s.effRate : row.key === "totalInt" ? s.totalInt : row.key === "roi" ? s.roi : row.key === "finalVal" ? s.finalVal : -1) === maxVal;
                              return (
                                <td
                                  key={s.id}
                                  style={{
                                    padding: "12px 20px",
                                    textAlign: "right",
                                    fontWeight: isMax ? 700 : 500,
                                    color: isMax ? "hsl(var(--primary))" : "hsl(var(--text-primary))",
                                    background: isMax ? "rgba(16,185,129,0.06)" : "transparent",
                                  }}
                                >
                                  {row.format(s)}
                                  {isMax && <span style={{ marginLeft: 6, fontSize: "0.8rem" }}>👑</span>}
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

              {/* Modal footer */}
              <div style={{ padding: "12px 24px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCompare(false)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
