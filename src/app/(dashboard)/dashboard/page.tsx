import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatPct, ASSET_TYPE_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown, Plus, ArrowRight, Wallet, BarChart2 } from "lucide-react";
import type { Metadata } from "next";
import type { Portfolio, PortfolioHolding } from "@/types";


export const metadata: Metadata = { title: "Dashboard" };

async function getPortfolioStats(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // Get all portfolios with their holdings
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("*, portfolio_holdings(*, asset:assets(*))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!portfolios || portfolios.length === 0) return { portfolios: [], totalValue: 0, totalCost: 0 };

  // Get latest prices
  const allAssetIds = portfolios.flatMap((p: Portfolio & { portfolio_holdings?: PortfolioHolding[] }) =>
    (p.portfolio_holdings ?? []).map((h: PortfolioHolding) => h.asset_id)
  );
  const uniqueAssetIds = [...new Set(allAssetIds)];

  const { data: latestPrices } = await supabase
    .from("price_history")
    .select("asset_id, price, recorded_at")
    .in("asset_id", uniqueAssetIds)
    .order("recorded_at", { ascending: false });

  const priceMap: Record<string, number> = {};
  latestPrices?.forEach((p: { asset_id: string; price: number }) => {
    if (!priceMap[p.asset_id]) priceMap[p.asset_id] = p.price;
  });

  let totalValue = 0;
  let totalCost = 0;

  const enrichedPortfolios = portfolios.map((p: Portfolio & { portfolio_holdings?: PortfolioHolding[] }) => {
    let pValue = 0;
    let pCost = 0;
    const holdings = (p.portfolio_holdings ?? []).map((h: PortfolioHolding) => {
      const currentPrice = priceMap[h.asset_id] ?? h.avg_buy_price;
      const value = h.quantity * currentPrice;
      const cost = h.quantity * h.avg_buy_price;
      pValue += value;
      pCost += cost;
      return { ...h, current_price: currentPrice, current_value: value };
    });
    totalValue += pValue;
    totalCost += pCost;
    return { ...p, portfolio_holdings: holdings, total_value: pValue, total_cost: pCost };
  });

  return { portfolios: enrichedPortfolios, totalValue, totalCost };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { portfolios, totalValue, totalCost } = await getPortfolioStats(supabase, user.id);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const isProfit = totalGainLoss >= 0;

  // Latest simulations
  const { data: recentSims } = await supabase
    .from("simulations")
    .select("*, portfolio:portfolios(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam";

  return (
    <div className="animate-fade-in-up w-full flex-1">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.7rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
          {greeting}, {profile?.full_name?.split(" ")[0] ?? "Investor"} 👋
        </h1>
        <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.95rem" }}>
          {new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date())}
        </p>
      </div>

      {/* Stats grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
      >
        {/* Total Portfolio Value */}
        <div className="stat-card glow-emerald">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Portofolio
            </span>
            <Wallet size={18} color="hsl(var(--primary))" />
          </div>
          <div className="gradient-text" style={{ fontSize: "1.7rem", fontWeight: 800, lineHeight: 1 }}>
            {formatIDR(totalValue)}
          </div>
          <div style={{ marginTop: 8, fontSize: "0.82rem", color: "hsl(var(--text-secondary))" }}>
            Modal: {formatIDR(totalCost)}
          </div>
        </div>

        {/* Gain / Loss */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Keuntungan / Kerugian
            </span>
            {isProfit ? <TrendingUp size={18} color="hsl(var(--primary))" /> : <TrendingDown size={18} color="hsl(var(--danger))" />}
          </div>
          <div
            style={{
              fontSize: "1.7rem",
              fontWeight: 800,
              lineHeight: 1,
              color: isProfit ? "hsl(var(--primary))" : "hsl(var(--danger))",
            }}
          >
            {totalGainLoss >= 0 ? "+" : ""}{formatIDR(totalGainLoss)}
          </div>
          <div style={{ marginTop: 8 }}>
            <span
              className={isProfit ? "badge badge-success" : "badge badge-danger"}
              style={{ fontSize: "0.78rem" }}
            >
              {formatPct(totalGainLossPct)}
            </span>
          </div>
        </div>

        {/* Number of portfolios */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Portofolio
            </span>
            <BarChart2 size={18} color="hsl(var(--accent))" />
          </div>
          <div style={{ fontSize: "1.7rem", fontWeight: 800, lineHeight: 1, color: "hsl(var(--accent))" }}>
            {portfolios.length}
          </div>
          <div style={{ marginTop: 8, fontSize: "0.82rem", color: "hsl(var(--text-secondary))" }}>
            Portofolio aktif
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Portfolio list */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: "1.1rem", color: "hsl(var(--text-primary))" }}>
              Portofolio Saya
            </h2>
            <Link href="/portfolio" className="btn btn-ghost btn-sm" style={{ color: "hsl(var(--primary))" }}>
              Lihat Semua <ArrowRight size={14} />
            </Link>
          </div>

          {portfolios.length === 0 ? (
            <div
              className="card"
              style={{
                padding: 48,
                textAlign: "center",
                borderStyle: "dashed",
              }}
            >
              <Wallet size={40} color="hsl(var(--text-muted))" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "hsl(var(--text-secondary))", marginBottom: 20, fontSize: "0.95rem" }}>
                Belum ada portofolio. Mulai buat portofolio pertama Anda!
              </p>
              <Link href="/portfolio" className="btn btn-primary">
                <Plus size={16} />
                Buat Portofolio
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {portfolios.slice(0, 4).map((p: Portfolio & {
                total_value?: number;
                total_cost?: number;
                portfolio_holdings?: PortfolioHolding[];
              }) => {
                const pGain = (p.total_value ?? 0) - (p.total_cost ?? 0);
                const pGainPct = (p.total_cost ?? 0) > 0 ? (pGain / (p.total_cost ?? 1)) * 100 : 0;
                const pIsProfit = pGain >= 0;
                return (
                  <Link
                    key={p.id}
                    href={`/portfolio/${p.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="card"
                      style={{
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.15))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "1rem",
                          color: "hsl(var(--primary))",
                          flexShrink: 0,
                        }}
                      >
                        {p.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "hsl(var(--text-primary))", fontSize: "0.95rem", marginBottom: 2 }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))" }}>
                          {(p.portfolio_holdings ?? []).length} aset
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, color: "hsl(var(--text-primary))", fontSize: "0.95rem" }}>
                          {formatIDR(p.total_value ?? 0)}
                        </div>
                        <span className={pIsProfit ? "badge badge-success" : "badge badge-danger"} style={{ fontSize: "0.72rem" }}>
                          {formatPct(pGainPct)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: Quick Actions + Recent Simulations */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quick actions */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(var(--text-primary))", marginBottom: 12 }}>
              Aksi Cepat
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/portfolio" className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start" }}>
                <Plus size={15} /> Buat Portofolio Baru
              </Link>
              <Link href="/simulasi" className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start" }}>
                <BarChart2 size={15} /> Cek Risiko Kerugian
              </Link>
              <Link href="/kalkulator" className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start" }}>
                <TrendingUp size={15} /> Kalkulator Keuntungan
              </Link>
            </div>
          </div>

          {/* Recent simulations */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(var(--text-primary))" }}>
                Simulasi Terbaru
              </h3>
              <Link href="/simulasi" style={{ fontSize: "0.75rem", color: "hsl(var(--primary))", textDecoration: "none" }}>
                Lihat Semua
              </Link>
            </div>
            {!recentSims || recentSims.length === 0 ? (
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.82rem" }}>
                Belum ada simulasi yang dijalankan.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentSims.map((sim: {
                  id: string;
                  type: string;
                  created_at: string;
                  result: { var_value?: number; final_value?: number };
                  portfolio?: { name: string };
                }) => (
                  <div
                    key={sim.id}
                    style={{
                      padding: "10px 12px",
                      background: "hsl(var(--bg-base))",
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className={sim.type === "var" ? "badge badge-danger" : "badge badge-info"} style={{ fontSize: "0.7rem" }}>
                        {sim.type === "var" ? "VaR" : "Compound"}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))" }}>
                        {new Date(sim.created_at).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: "0.82rem", color: "hsl(var(--text-primary))", fontWeight: 600 }}>
                      {sim.type === "var"
                        ? `VaR: ${formatIDR((sim.result as { var_value?: number }).var_value ?? 0)}`
                        : `Nilai Akhir: ${formatIDR((sim.result as { final_value?: number }).final_value ?? 0)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
