"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown,
  ChevronDown, FlaskConical
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { formatIDR, formatPct, ASSET_TYPE_CONFIG, CHART_COLORS } from "@/lib/utils";
import type { Asset, PortfolioHolding } from "@/types";

interface HoldingForm {
  asset_id: string;
  quantity: string;
  avg_buy_price: string;
  buy_date: string;
  notes: string;
}

const EMPTY_FORM: HoldingForm = {
  asset_id: "", quantity: "", avg_buy_price: "", buy_date: "", notes: ""
};

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [portfolio, setPortfolio] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [holdings, setHoldings] = useState<(PortfolioHolding & { current_price?: number; current_value?: number; gain_loss?: number; gain_loss_pct?: number })[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<HoldingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Portfolio
    const { data: pf } = await supabase.from("portfolios").select("*").eq("id", id).single();
    if (!pf) { router.push("/portfolio"); return; }
    setPortfolio(pf);

    // Holdings with asset info
    const { data: hds } = await supabase
      .from("portfolio_holdings")
      .select("*, asset:assets(*)")
      .eq("portfolio_id", id)
      .order("created_at");

    // Assets for dropdown
    const { data: assetList } = await supabase.from("assets").select("*").order("type").order("name");
    setAssets(assetList ?? []);

    if (!hds || hds.length === 0) { setHoldings([]); setLoading(false); return; }

    // Get latest prices
    const assetIds = [...new Set(hds.map((h: PortfolioHolding) => h.asset_id))];
    const { data: prices } = await supabase
      .from("price_history")
      .select("asset_id, price, recorded_at")
      .in("asset_id", assetIds)
      .order("recorded_at", { ascending: false });

    const priceMap: Record<string, number> = {};
    prices?.forEach((p: { asset_id: string; price: number }) => {
      if (!priceMap[p.asset_id]) priceMap[p.asset_id] = p.price;
    });

    const enriched = hds.map((h: PortfolioHolding) => {
      const cp = priceMap[h.asset_id] ?? h.avg_buy_price;
      const cv = h.quantity * cp;
      const cost = h.quantity * h.avg_buy_price;
      return {
        ...h, current_price: cp, current_value: cv,
        gain_loss: cv - cost,
        gain_loss_pct: cost > 0 ? ((cv - cost) / cost) * 100 : 0,
      };
    });
    setHoldings(enriched);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalValue = holdings.reduce((a, h) => a + (h.current_value ?? 0), 0);
  const totalCost = holdings.reduce((a, h) => a + h.quantity * h.avg_buy_price, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Pie chart data by type
  const allocationByType: Record<string, number> = {};
  holdings.forEach((h) => {
    const type = (h.asset as Asset)?.type ?? "lainnya";
    allocationByType[type] = (allocationByType[type] ?? 0) + (h.current_value ?? 0);
  });
  const pieData = Object.entries(allocationByType).map(([type, value]) => ({
    name: ASSET_TYPE_CONFIG[type]?.label ?? type,
    value: Math.round(value),
    color: ASSET_TYPE_CONFIG[type]?.color ?? "hsl(var(--text-muted))",
  }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from("portfolio_holdings").insert({
      portfolio_id: id,
      asset_id: form.asset_id,
      quantity: parseFloat(form.quantity),
      avg_buy_price: parseFloat(form.avg_buy_price),
      buy_date: form.buy_date,
      notes: form.notes || null,
    });
    setForm(EMPTY_FORM); setShowAdd(false); setSaving(false);
    loadData();
  };

  const handleDelete = async (hid: string) => {
    if (!confirm("Hapus holding ini?")) return;
    setDeletingId(hid);
    await supabase.from("portfolio_holdings").delete().eq("id", hid);
    setDeletingId(null);
    loadData();
  };

  if (loading) return (
    <div className="w-full flex-1">
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16, marginBottom: 12 }} />)}
    </div>
  );
  if (!portfolio) return null;

  return (
    <div className="animate-fade-in-up w-full flex-1">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/portfolio" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, color: "hsl(var(--text-secondary))" }}>
          <ArrowLeft size={14} /> Kembali ke Daftar
        </Link>
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
              {portfolio.name}
            </h1>
            {portfolio.description && (
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>{portfolio.description}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href={`/simulasi?portfolio=${id}`} className="btn btn-secondary btn-sm">
              <FlaskConical size={14} /> Simulasi
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Tambah Aset
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {[
          { label: "Nilai Saat Ini", value: formatIDR(totalValue), sub: null },
          { label: "Total Modal", value: formatIDR(totalCost), sub: null },
          {
            label: "Keuntungan/Kerugian",
            value: `${totalGain >= 0 ? "+" : ""}${formatIDR(totalGain)}`,
            sub: formatPct(totalGainPct),
            color: totalGain >= 0 ? "hsl(var(--primary))" : "hsl(var(--danger))",
          },
          { label: "Jumlah Aset", value: String(holdings.length), sub: "holding aktif" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: "0.75rem", color: "hsl(var(--text-secondary))", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: s.color ?? "hsl(var(--text-primary))" }}>
              {s.value}
            </div>
            {s.sub && <div style={{ fontSize: "0.8rem", color: s.color ?? "hsl(var(--text-secondary))", marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 mb-6">
        {/* Holdings table */}
        <div className="card overflow-x-auto">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
            <h2 style={{ fontWeight: 700, fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>Daftar Holding</h2>
          </div>
          {holdings.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem", marginBottom: 16 }}>
                Belum ada aset. Tambahkan holding pertama.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Tambah Aset
              </button>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div
                className="grid grid-cols-[1fr_80px_80px_80px_80px_36px] min-w-[600px] gap-2 px-5 py-2.5 text-[0.72rem] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider border-b border-[hsl(var(--border))]"
              >
                <span>Aset</span><span style={{ textAlign: "right" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Harga Beli</span>
                <span style={{ textAlign: "right" }}>Harga Kini</span>
                <span style={{ textAlign: "right" }}>Gain/Loss</span>
                <span />
              </div>
              {holdings.map((h) => {
                const isProfit = (h.gain_loss ?? 0) >= 0;
                return (
                  <div
                    key={h.id}
                    className="grid grid-cols-[1fr_80px_80px_80px_80px_36px] min-w-[600px] gap-2 px-5 py-3 items-center border-b border-[hsl(var(--border))] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "hsl(var(--text-primary))", fontSize: "0.88rem" }}>
                        {(h.asset as Asset)?.name ?? h.asset_id}
                      </div>
                      <span className={`badge ${ASSET_TYPE_CONFIG[(h.asset as Asset)?.type]?.badgeClass ?? "badge-neutral"}`} style={{ fontSize: "0.65rem", marginTop: 2 }}>
                        {ASSET_TYPE_CONFIG[(h.asset as Asset)?.type]?.label ?? "Lainnya"}
                      </span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.82rem", color: "hsl(var(--text-primary))" }}>{h.quantity}</div>
                    <div style={{ textAlign: "right", fontSize: "0.78rem", color: "hsl(var(--text-secondary))" }}>
                      {formatIDR(h.avg_buy_price)}
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.78rem", color: "hsl(var(--text-primary))" }}>
                      {formatIDR(h.current_price ?? 0)}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: isProfit ? "hsl(var(--primary))" : "hsl(var(--danger))" }}>
                        {isProfit ? "+" : ""}{formatIDR(h.gain_loss ?? 0)}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: isProfit ? "hsl(var(--primary))" : "hsl(var(--danger))" }}>
                        {isProfit ? "+" : ""}{formatPct(h.gain_loss_pct ?? 0)}
                      </div>
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: "4px 8px" }}
                      onClick={() => handleDelete(h.id)}
                      disabled={deletingId === h.id}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie chart allocation */}
        <div className="card py-4 sm:py-0 overflow-hidden">
          <div className="flex flex-col items-stretch border-b border-[hsl(var(--border))] sm:flex-row p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0 py-4">
              <h3 className="font-bold text-lg text-[hsl(var(--text-primary))]">Alokasi Aset</h3>
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                Sebaran instrumen investasi Anda
              </p>
            </div>
            <div className="flex">
              <button
                className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] transition-colors"
              >
                <span className="text-xs text-[hsl(var(--text-muted))]">
                  Total Nilai
                </span>
                <span className="text-lg leading-none font-bold sm:text-3xl text-[hsl(var(--text-primary))] truncate max-w-[200px]">
                  {formatIDR(totalValue, true)}
                </span>
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6 mt-2">
            <div className="aspect-auto h-[250px] w-full">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: "hsl(var(--text-secondary))", fontSize: "0.78rem" }}>{value}</span>
                      )}
                    />
                    <Tooltip
                      formatter={(value) => formatIDR(Number(value), true)}
                      contentStyle={{
                        background: "hsl(var(--bg-surface))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        color: "hsl(var(--text-primary))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
                  Tambahkan aset untuk melihat alokasi
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add holding modal */}
      {showAdd && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div
            className="animate-fade-in-up"
            style={{
              width: "100%", maxWidth: 440,
              background: "hsl(var(--bg-surface))",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              borderRadius: 20, padding: "32px 28px",
            }}
          >
            <h2 style={{ fontWeight: 700, fontSize: "1.2rem", color: "hsl(var(--text-primary))", marginBottom: 24 }}>
              Tambah Holding Baru
            </h2>
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="h-asset" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                  Pilih Aset *
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    id="h-asset"
                    className="input-base"
                    style={{ appearance: "none", paddingRight: 36 }}
                    value={form.asset_id}
                    onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                    required
                  >
                    <option value="">-- Pilih Aset --</option>
                    {["emas", "reksadana", "obligasi"].map((type) => (
                      <optgroup key={type} label={ASSET_TYPE_CONFIG[type]?.label ?? type}>
                        {assets.filter((a) => a.type === type).map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="h-qty" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                    Jumlah *
                  </label>
                  <input id="h-qty" type="number" step="any" min="0.0001" className="input-base" placeholder="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="h-price" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                    Harga Beli (Rp) *
                  </label>
                  <input id="h-price" type="number" step="any" min="1" className="input-base" placeholder="1050000" value={form.avg_buy_price} onChange={(e) => setForm({ ...form, avg_buy_price: e.target.value })} required />
                </div>
              </div>
              <div>
                <label htmlFor="h-date" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                  Tanggal Beli *
                </label>
                <input id="h-date" type="date" className="input-base" value={form.buy_date} onChange={(e) => setForm({ ...form, buy_date: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="h-notes" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                  Catatan (opsional)
                </label>
                <input id="h-notes" type="text" className="input-base" placeholder="cth: Beli di Antam Pulogadung" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Batal</button>
                <button id="btn-save-holding" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
