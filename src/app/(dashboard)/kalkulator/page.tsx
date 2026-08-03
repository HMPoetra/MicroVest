"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calculator, TrendingUp, Info, AlertTriangle, ChevronDown, HelpCircle } from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart
} from "recharts";
import { formatIDR, formatPct } from "@/lib/utils";
import type { CompoundResult } from "@/types";

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
  const [principal, setPrincipal] = useState(10000000);
  const [annualRate, setAnnualRate] = useState(8);
  const [tenorYears, setTenorYears] = useState(10);
  const [frequency, setFrequency] = useState("monthly");
  const [customFrequency, setCustomFrequency] = useState<number>(2);
  const [additionalMonthly, setAdditionalMonthly] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompoundResult | null>(null);
  const [error, setError] = useState("");

  // Dynamic returns states
  const [rateType, setRateType] = useState<"static" | "dynamic">("static");
  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);
  const [portfolioId, setPortfolioId] = useState("");
  const [availableAssets, setAvailableAssets] = useState<{ id: string; name: string; type: string; symbol: string }[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

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

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleCalculate = useCallback(async () => {
    setLoading(true); setError(""); setResult(null);

    const customHoldings = Object.entries(weights)
      .filter(([_, w]) => w > 0)
      .map(([assetId, w]) => ({
        asset_id: assetId,
        weight: w / 100,
      }));

    const res = await fetch("/api/simulate/compound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        principal,
        annual_rate: rateType === "static" ? annualRate / 100 : undefined,
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
    if (!res.ok || json.error) { setError(json.error ?? "Terjadi kesalahan."); }
    else { setResult(json.data); }
    setLoading(false);
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
  ) => (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
            {prefix}
          </span>
        )}
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
        {suffix && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

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
                type="range" min={1} max={30} step={0.5}
                value={annualRate}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                style={{ width: "100%", accentColor: "hsl(var(--primary))" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
                <span>1%</span><span>30%</span>
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
              type="range" min={1} max={50} step={1}
              value={tenorYears}
              onChange={(e) => setTenorYears(Number(e.target.value))}
              style={{ width: "100%", accentColor: "hsl(var(--primary))" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 2 }}>
              <span>1 tahun</span><span>50 tahun</span>
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
                    value: formatIDR(result.final_value, true),
                    color: "hsl(var(--primary))",
                    sub: `Dalam {tenorYears} tahun`,
                  },
                  {
                    label: "Total Bunga",
                    value: formatIDR(result.total_interest, true),
                    color: "hsl(var(--accent))",
                    sub: `${((result.total_interest / result.total_contributed) * 100).toFixed(1)}% dari modal`,
                  },
                  {
                    label: "Total Modal",
                    value: formatIDR(result.total_contributed, true),
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
                    <h3 className="font-bold text-lg text-[hsl(var(--text-primary))]">
                      Grafik Pertumbuhan Uang Anda {rateType === "dynamic" && "(Dinamis)"}
                    </h3>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">
                      Menampilkan proyeksi nilai investasi berdasarkan {rateType === "static" ? "keuntungan tetap" : "keuntungan historis berfluktuasi"}
                    </p>
                  </div>
                  <div className="flex">
                    <button
                      className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                    >
                      <span className="text-xs text-[hsl(var(--text-muted))]">
                        Nilai Akhir
                      </span>
                      <span className="text-lg leading-none font-bold sm:text-3xl text-[hsl(var(--primary))] truncate max-w-[200px]">
                        {formatIDR(result.final_value, true)}
                      </span>
                    </button>
                    <button
                      className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                    >
                      <span className="text-xs text-[hsl(var(--text-muted))]">
                        Total Modal
                      </span>
                      <span className="text-lg leading-none font-bold sm:text-3xl text-[hsl(var(--accent))] truncate max-w-[200px]">
                        {formatIDR(result.total_contributed, true)}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="p-4 sm:p-6 mt-2">
                  <div className="aspect-auto h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.projection} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
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
                          interval={Math.max(0, Math.floor(result.projection.length / 6))} 
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
                          formatter={(v, name) => [formatIDR(Number(v), true), name === "value" ? "Total Nilai" : "Total Modal"]}
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
                <div style={{ padding: "14px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(var(--text-primary))" }}>Rincian Pertumbuhan per Periode</h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                    <thead>
                      <tr style={{ background: "hsl(var(--bg-base))" }}>
                        {["Periode", "Total Nilai", "Total Modal", "Bunga Kumulatif"].map((h) => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.projection.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                          <td style={{ padding: "10px 16px", color: "hsl(var(--text-primary))", fontWeight: 500 }}>{row.label}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "hsl(var(--primary))" }}>{formatIDR(row.value)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", color: "hsl(var(--accent))" }}>{formatIDR(row.total_contributed)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", color: "hsl(var(--text-muted))" }}>{formatIDR(row.interest_earned)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
