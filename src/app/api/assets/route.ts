import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AssetWithPrice, AssetGroup, AssetType } from "@/types";

export const dynamic = "force-dynamic";

const typeOrder: Record<AssetType, number> = {
  emas: 1,
  reksadana: 2,
  obligasi: 3,
  kripto: 4,
  saham: 5,
};

const typeLabel: Record<AssetType, string> = {
  emas: "Emas",
  reksadana: "Reksa Dana",
  obligasi: "Obligasi",
  kripto: "Kripto",
  saham: "Saham",
};

export async function GET() {
  try {
    const supabase = await createClient();

    // Call the RPC function we created in the migration
    const { data, error } = await supabase.rpc("get_asset_prices");

    if (error) {
      console.error("RPC get_asset_prices error:", error);
      return NextResponse.json({ error: "Gagal mengambil data aset" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ data: [] });
    }

    // For each asset, fetch the last 2 distinct price records to compute real % change
    const assetIds = Array.from(new Set<string>(data.map((row: any) => String(row.id))));

    // Fetch last 2 prices for all assets in one query
    const { data: priceRows, error: priceErr } = await supabase
      .from("price_history")
      .select("asset_id, price, recorded_at")
      .in("asset_id", assetIds)
      .order("recorded_at", { ascending: false });

    // Build a map: assetId -> [latestPrice, prevPrice]
    const priceMap: Record<string, number[]> = {};
    if (!priceErr && priceRows) {
      for (const row of priceRows) {
        if (!priceMap[row.asset_id]) {
          priceMap[row.asset_id] = [];
        }
        if (priceMap[row.asset_id].length < 2) {
          priceMap[row.asset_id].push(Number(row.price));
        }
      }
    }

    // Map and calculate percentage using real last-2 prices
    const processedAssets: AssetWithPrice[] = data.map((row: any) => {
      const prices = priceMap[row.id] ?? [];
      const hargaTerkini = prices[0] ?? Number(row.harga_terkini);
      const hargaSebelumnya = prices[1] ?? null;

      let persentase_perubahan = null;
      if (hargaSebelumnya !== null && hargaSebelumnya > 0 && hargaTerkini !== hargaSebelumnya) {
        persentase_perubahan = ((hargaTerkini - hargaSebelumnya) / hargaSebelumnya) * 100;
      }

      return {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        type: row.type as AssetType,
        unit: row.unit,
        description: "",
        created_at: "",
        harga_terkini: hargaTerkini,
        tanggal_terkini: row.tanggal_terkini,
        harga_sebelumnya: hargaSebelumnya,
        persentase_perubahan,
      };
    });

    // Group by type
    const grouped: Record<string, AssetGroup> = {};

    for (const asset of processedAssets) {
      if (!grouped[asset.type]) {
        grouped[asset.type] = {
          type: asset.type,
          label: typeLabel[asset.type] || asset.type,
          count: 0,
          assets: [],
        };
      }
      grouped[asset.type].assets.push(asset);
      grouped[asset.type].count += 1;
    }

    // Convert to array and sort by our defined order
    const result: AssetGroup[] = Object.values(grouped).sort((a, b) => {
      const orderA = typeOrder[a.type] || 99;
      const orderB = typeOrder[b.type] || 99;
      return orderA - orderB;
    });

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("GET /api/assets error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal server" }, { status: 500 });
  }
}
