import { createClient } from "@/lib/supabase/server";
import { formatIDR, ASSET_TYPE_CONFIG } from "@/lib/utils";
import PriceChart from "@/components/charts/PriceChart";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import type { PriceHistory } from "@/types";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  return { title: `Aset ${resolvedParams.symbol}` };
}

export default async function AssetDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("symbol", resolvedParams.symbol)
    .single();

  if (!asset) {
    return (
      <div style={{ maxWidth: 800, padding: "40px 0" }}>
        <p style={{ color: "hsl(215,20%,55%)" }}>Aset tidak ditemukan.</p>
        <Link href="/aset" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Kembali
        </Link>
      </div>
    );
  }

  // Satu query: 365 baris TERBARU (DESC). Row pertama = harga paling baru.
  const { data: pricesDesc } = await supabase
    .from("price_history")
    .select("price, recorded_at")
    .eq("asset_id", asset.id)
    .order("recorded_at", { ascending: false })
    .limit(365);

  const pricesRaw = pricesDesc ?? [];

  // Balik untuk chart (kiri=lama, kanan=baru)
  const pricesAsc = [...pricesRaw].reverse();

  // Chart data — ujung kanan pasti = pricesRaw[0] (harga terbaru)
  const chartData = pricesAsc.map((p: { price: number; recorded_at: string }) => ({
    date: p.recorded_at,
    price: p.price,
  }));

  // Harga terkini = baris pertama dari DESC query (dijamin sinkron dengan chartData[-1])
  const latestPrice = pricesRaw[0]?.price ?? 0;
  const prevPrice   = pricesRaw[1]?.price ?? 0;
  const priceChange = latestPrice - prevPrice;
  const priceChangePct = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;
  const isUp = priceChange >= 0;

  const firstPrice = pricesAsc[0]?.price ?? 0;
  const minPrice = pricesAsc.length > 0 ? Math.min(...pricesAsc.map((p) => p.price)) : 0;
  const maxPrice = pricesAsc.length > 0 ? Math.max(...pricesAsc.map((p) => p.price)) : 0;


  const typeConfig = ASSET_TYPE_CONFIG[asset.type];

  return (
    <div className="animate-fade-in-up w-full flex-1">
      <Link href="/aset" className="btn btn-ghost btn-sm" style={{ marginBottom: 20, color: "hsl(215,20%,55%)" }}>
        <ArrowLeft size={14} /> Semua Aset
      </Link>

      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 mb-7">
        <div
          style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: `${typeConfig?.color}20`,
            border: `1px solid ${typeConfig?.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: "1.3rem", color: typeConfig?.color,
          }}
        >
          {asset.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontWeight: 800, fontSize: "1.4rem", color: "hsl(var(--text-primary))" }}>{asset.name}</h1>
            <span className={`badge ${typeConfig?.badgeClass}`}>{typeConfig?.label}</span>
          </div>
          <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.85rem" }}>
            {asset.symbol} · {asset.description ?? "Tidak ada deskripsi"}
          </p>
        </div>
        <div className="mt-2 sm:mt-0 sm:text-right w-full sm:w-auto">
          <div style={{ fontWeight: 800, fontSize: "1.6rem", color: "hsl(var(--text-primary))" }}>
            {formatIDR(latestPrice)}
          </div>
          <div className="flex items-center gap-1 sm:justify-end mt-1">
            {isUp ? <TrendingUp size={14} color="#34d399" /> : <TrendingDown size={14} color="#f87171" />}
            <span className={isUp ? "badge badge-success" : "badge badge-danger"}>
              {isUp ? "+" : ""}{priceChangePct.toFixed(2)}% ({pricesAsc.length} hari)
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Harga Terendah", value: formatIDR(minPrice) },
          { label: "Harga Tertinggi", value: formatIDR(maxPrice) },
          { label: "Data Tersedia", value: `${pricesAsc.length} hari` },
        ].map((s) => (
          <div key={s.label} className="stat-card bg-white">
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--text-primary))" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Price chart */}
      <PriceChart data={chartData} color={typeConfig?.color ?? "#10b981"} />
    </div>
  );
}
