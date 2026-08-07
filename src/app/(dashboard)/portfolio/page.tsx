"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Plus, Briefcase, ArrowRight, TrendingUp, TrendingDown, Trash2, ChevronDown, X } from "lucide-react";
import { formatIDR, formatPct } from "@/lib/utils";
import type { Portfolio, PortfolioHolding } from "@/types";

interface EnrichedPortfolio extends Portfolio {
  portfolio_holdings: PortfolioHolding[];
  total_value: number;
  total_cost: number;
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<EnrichedPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<{ id: string; name: string; symbol: string; type: string }[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const supabase = createClient();

  const loadPortfolios = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("portfolios")
      .select("*, portfolio_holdings(*, asset:assets(*))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Get latest prices
    const allAssetIds = data.flatMap((p: Portfolio & { portfolio_holdings?: PortfolioHolding[] }) =>
      (p.portfolio_holdings ?? []).map((h: PortfolioHolding) => h.asset_id)
    );
    const uniqueIds = [...new Set(allAssetIds)];
    const { data: prices } = await supabase
      .from("price_history")
      .select("asset_id, price, recorded_at")
      .in("asset_id", uniqueIds)
      .order("recorded_at", { ascending: false });

    const priceMap: Record<string, number> = {};
    prices?.forEach((p: { asset_id: string; price: number }) => {
      if (!priceMap[p.asset_id]) priceMap[p.asset_id] = p.price;
    });

    const enriched = data.map((p: Portfolio & { portfolio_holdings?: PortfolioHolding[] }) => {
      let pValue = 0, pCost = 0;
      const holdings = (p.portfolio_holdings ?? []).map((h: PortfolioHolding) => {
        const cp = priceMap[h.asset_id] ?? h.avg_buy_price;
        pValue += h.quantity * cp;
        pCost += h.quantity * h.avg_buy_price;
        return { ...h, current_price: cp };
      });
      return { ...p, portfolio_holdings: holdings, total_value: pValue, total_cost: pCost };
    });

    setPortfolios(enriched as EnrichedPortfolio[]);
    setLoading(false);
  };

  useEffect(() => { loadPortfolios(); }, []);

  useEffect(() => {
    // Load assets for the dropdown
    fetch("/api/assets")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const flattened = json.data.flatMap((g: any) =>
            g.assets.map((a: any) => ({ id: a.id, name: a.name, symbol: a.symbol, type: g.label }))
          );
          setAvailableAssets(flattened);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-generate portfolio name from selected assets (unless manually edited)
  useEffect(() => {
    if (nameManuallyEdited) return;
    if (selectedAssets.length === 0) {
      setNewName("");
      return;
    }
    const names = selectedAssets
      .map((sym) => availableAssets.find((a) => a.symbol === sym)?.symbol ?? sym)
      .slice(0, 3);
    setNewName("Portofolio " + names.join(" + ") + (selectedAssets.length > 3 ? ` +${selectedAssets.length - 3}` : ""));
  }, [selectedAssets, availableAssets, nameManuallyEdited]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    await supabase.from("portfolios").insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });

    setNewName(""); setNewDesc(""); setShowCreate(false); setCreating(false);
    setSelectedAssets([]); setNameManuallyEdited(false); setAssetDropdownOpen(false);
    loadPortfolios();
  };

  const toggleAsset = (symbol: string) => {
    setSelectedAssets((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const handleCloseModal = () => {
    setShowCreate(false);
    setNewName(""); setNewDesc("");
    setSelectedAssets([]); setNameManuallyEdited(false); setAssetDropdownOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus portofolio ini? Semua holding akan ikut terhapus.")) return;
    setDeletingId(id);
    await supabase.from("portfolios").delete().eq("id", id);
    setDeletingId(null);
    loadPortfolios();
  };

  return (
    <div className="animate-fade-in-up w-full flex-1 flex flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
            Portofolio Saya
          </h1>
          <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>
            Kelola dan pantau semua portofolio investasi Anda
          </p>
        </div>
        <button
          id="btn-create-portfolio"
          className="btn btn-primary"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} /> Portofolio Baru
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div
            className="animate-fade-in-up"
            style={{
              width: "100%", maxWidth: 480,
              background: "hsl(var(--bg-surface))",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              borderRadius: 20, padding: "32px 28px",
            }}
          >
            <h2 style={{ fontWeight: 700, fontSize: "1.2rem", color: "hsl(var(--text-primary))", marginBottom: 24 }}>
              Buat Portofolio Baru
            </h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Asset selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 8 }}>
                  Pilih Aset
                </label>

                {/* Selected chips */}
                {selectedAssets.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {selectedAssets.map((sym) => {
                      const asset = availableAssets.find((a) => a.symbol === sym);
                      return (
                        <span
                          key={sym}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            background: "hsl(var(--primary) / 0.12)",
                            color: "hsl(var(--primary))",
                            borderRadius: 999, padding: "3px 10px 3px 10px",
                            fontSize: "0.78rem", fontWeight: 700,
                            border: "1px solid hsl(var(--primary) / 0.25)",
                          }}
                        >
                          {asset?.symbol ?? sym}
                          <button
                            type="button"
                            onClick={() => toggleAsset(sym)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "hsl(var(--primary))" }}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown trigger */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    id="pf-asset-dropdown"
                    className="input-base"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}
                    onClick={() => setAssetDropdownOpen((o) => !o)}
                  >
                    <span style={{ color: selectedAssets.length === 0 ? "hsl(var(--text-muted))" : "hsl(var(--text-primary))" }}>
                      {selectedAssets.length === 0 ? "Cari & pilih aset..." : `${selectedAssets.length} aset dipilih`}
                    </span>
                    <ChevronDown size={15} style={{ flexShrink: 0, transition: "transform 0.2s", transform: assetDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>

                  {assetDropdownOpen && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
                        background: "hsl(var(--bg-surface))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                        maxHeight: 240, overflowY: "auto",
                      }}
                    >
                      {availableAssets.length === 0 ? (
                        <div style={{ padding: "14px 16px", fontSize: "0.85rem", color: "hsl(var(--text-muted))", textAlign: "center" }}>
                          Memuat data aset...
                        </div>
                      ) : (
                        availableAssets.map((asset) => {
                          const selected = selectedAssets.includes(asset.symbol);
                          return (
                            <button
                              key={asset.symbol}
                              type="button"
                              onClick={() => { toggleAsset(asset.symbol); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                width: "100%", padding: "10px 16px", border: "none",
                                background: selected ? "hsl(var(--primary) / 0.08)" : "transparent",
                                cursor: "pointer", textAlign: "left",
                                borderBottom: "1px solid hsl(var(--border) / 0.5)",
                                transition: "background 0.15s",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: selected ? "hsl(var(--primary))" : "hsl(var(--text-primary))" }}>
                                  {asset.name}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 1 }}>
                                  {asset.symbol} · {asset.type}
                                </div>
                              </div>
                              {selected && (
                                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "hsl(var(--primary))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Portfolio Name */}
              <div>
                <label htmlFor="pf-name" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                  Nama Portofolio *
                </label>
                <input
                  id="pf-name"
                  type="text"
                  className="input-base"
                  placeholder="cth: Portofolio Emas 2025"
                  value={newName}
                  onChange={(e) => { setNameManuallyEdited(true); setNewName(e.target.value); }}
                  required
                />
                {!nameManuallyEdited && selectedAssets.length > 0 && (
                  <p style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginTop: 4 }}>Nama otomatis dari aset dipilih. Bisa diedit.</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="pf-desc" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: 6 }}>
                  Deskripsi (opsional)
                </label>
                <input
                  id="pf-desc"
                  type="text"
                  className="input-base"
                  placeholder="cth: Fokus investasi emas dan reksa dana"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCloseModal}>
                  Batal
                </button>
                <button id="btn-save-portfolio" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating || !newName.trim()}>
                  {creating ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          ))}
        </div>
      ) : portfolios.length === 0 ? (
        <div
          className="card"
          style={{ padding: 64, textAlign: "center", borderStyle: "dashed" }}
        >
          <Briefcase size={48} color="hsl(var(--text-muted))" style={{ margin: "0 auto 20px" }} />
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", color: "hsl(var(--text-primary))", marginBottom: 8 }}>
            Belum Ada Portofolio
          </h3>
          <p style={{ color: "hsl(var(--text-secondary))", marginBottom: 24, fontSize: "0.9rem" }}>
            Buat portofolio pertama Anda dan mulai tambahkan aset investasi.
          </p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Buat Portofolio Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {portfolios.map((p) => {
            const gain = p.total_value - p.total_cost;
            const gainPct = p.total_cost > 0 ? (gain / p.total_cost) * 100 : 0;
            const isProfit = gain >= 0;
            return (
              <div
                key={p.id}
                className="card flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ padding: "20px" }}
              >
                {/* Main Info Row (Logo, Title, Price) */}
                <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                  {/* Avatar/Logo */}
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.15))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "1.1rem", color: "hsl(var(--primary))", flexShrink: 0,
                    }}
                  >
                    {p.name[0]}
                  </div>

                  {/* Text Info (Title, Description, Asset count) */}
                  <div className="flex-1 min-w-0">
                    <div style={{ fontWeight: 700, color: "hsl(var(--text-primary))", fontSize: "0.95rem", marginBottom: 2 }}>
                      {p.name}
                    </div>
                    {p.description && (
                      <div style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.description}
                      </div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>
                      {p.portfolio_holdings.length} aset · dibuat {new Date(p.created_at).toLocaleDateString("id-ID")}
                    </div>
                  </div>

                  {/* Price and Profit/Loss */}
                  <div className="text-right flex-shrink-0 pl-2">
                    <div style={{ fontWeight: 800, color: "hsl(var(--text-primary))", fontSize: "1.05rem" }}>
                      {formatIDR(p.total_value)}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                      {isProfit ? <TrendingUp size={12} color="hsl(var(--primary))" /> : <TrendingDown size={12} color="hsl(var(--danger))" />}
                      <span className={isProfit ? "badge badge-success" : "badge badge-danger"} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                        {formatPct(gainPct)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex gap-2 justify-end w-full sm:w-auto sm:flex-shrink-0 border-t sm:border-t-0 border-slate-100/50 pt-3 sm:pt-0">
                  <Link href={`/portfolio/${p.id}`} className="btn btn-secondary btn-sm flex-1 sm:flex-initial" style={{ padding: "8px 16px" }}>
                    Detail <ArrowRight size={13} />
                  </Link>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: "8px 12px" }}
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    title="Hapus portofolio"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
