import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Box-Muller transform for normal distribution
function randomNormal() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface AssetParams {
  basePriceIDR: number; // harga fallback dalam RUPIAH (IDR)
  drift: number;
  stdDev: number;
}

// ─── KURS FALLBACK — tidak lagi diperlukan (semua aset tersisa berdenominasi IDR)
// Tetap disimpan untuk future-proofing jika ada aset USD ditambahkan kembali
const FALLBACK_USD_TO_IDR = 16_300;

// ─── Harga dasar realistis dalam IDR (digunakan jika semua sumber gagal) ─────
const ASSET_SPEC: Record<string, AssetParams> = {
  // Emas & Komoditas (IDR/gram atau IDR/satuan)
  "ANTAM_1GR": { basePriceIDR: 2_650_000,  drift: 0.0003,  stdDev: 0.008  },
  "ANTAM_5GR": { basePriceIDR: 13_100_000, drift: 0.0003,  stdDev: 0.008  },
  "UBS_1GR":   { basePriceIDR: 2_610_000,  drift: 0.0003,  stdDev: 0.008  },

  // Reksa Dana — NAB per unit dalam IDR (simulasi GBM)
  "RDPT_MANULIFE": { basePriceIDR: 2_850,  drift: 0.00040, stdDev: 0.006  },
  "RDPU_BNI":      { basePriceIDR: 1_280,  drift: 0.00016, stdDev: 0.0001 },

  // Obligasi — harga pasar per unit IDR (par Rp 1.000.000)
  "SBR012": { basePriceIDR: 1_022_000, drift: 0.00020, stdDev: 0.0004 },
  "ORI023": { basePriceIDR: 1_018_000, drift: 0.00022, stdDev: 0.0010 },
  "SR018":  { basePriceIDR: 1_015_000, drift: 0.00019, stdDev: 0.0004 },
  "FR0097": { basePriceIDR: 1_035_000, drift: 0.00023, stdDev: 0.0008 },
};

// ─── Yahoo Finance tickers — Emas sudah di-scrape langsung, Reksa Dana & Obligasi pakai simulasi
// Tidak ada lagi kripto/saham, jadi YAHOO_TICKERS kosong untuk saat ini
const YAHOO_TICKERS: Record<string, string> = {};

// ─── Ambil kurs USD/IDR live dari Yahoo Finance ───────────────────────────────
async function fetchUSDtoIDR(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/USDIDR=X?range=1d&interval=1d",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) throw new Error(`Yahoo FX HTTP ${res.status}`);
    const json = await res.json();
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    const rate = closes?.find((v: number | null) => v !== null && v > 0);
    if (rate && rate > 10_000 && rate < 30_000) {
      console.log(`Kurs USD/IDR live: ${rate}`);
      return rate;
    }
    throw new Error("Invalid FX rate");
  } catch (e) {
    console.warn(`Gagal fetch kurs USD/IDR: ${e}. Pakai fallback ${FALLBACK_USD_TO_IDR}`);
    return FALLBACK_USD_TO_IDR;
  }
}

// ─── Fetch historical prices dari Yahoo Finance ───────────────────────────────
async function fetchYahooFinancePrices(ticker: string): Promise<{ date: string; price: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const chart = json.chart?.result?.[0];
    if (!chart?.timestamp || !chart.indicators?.quote?.[0]?.close) {
      throw new Error(`Invalid Yahoo response for ${ticker}`);
    }
    const timestamps: number[] = chart.timestamp;
    const closes: (number | null)[] = chart.indicators.quote[0].close;
    const data: { date: string; price: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price !== null && price !== undefined && price > 0) {
        data.push({ date: new Date(timestamps[i] * 1000).toISOString().split("T")[0], price });
      }
    }
    return data;
  } catch (e) {
    console.warn(`Yahoo Finance failed for ${ticker}:`, e);
    return [];
  }
}

// ─── Seed 365 hari historis dengan simulasi GBM mundur dari harga terkini ─────
function generateHistoricalPrices(
  assetId: string,
  startPriceIDR: number,
  spec: AssetParams,
  now: Date,
  source: string
): object[] {
  const inserts = [];
  let currentPrice = startPriceIDR;
  for (let i = 0; i < 365; i++) {
    const recordedDate = new Date(now.getTime() - i * 86_400_000).toISOString().split("T")[0];
    inserts.push({ asset_id: assetId, price: Number(currentPrice.toFixed(4)), recorded_at: recordedDate, source });
    const dailyReturn = spec.drift + spec.stdDev * randomNormal();
    currentPrice = currentPrice / Math.exp(dailyReturn);
    if (currentPrice <= 0) currentPrice = startPriceIDR;
  }
  return inserts;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceReseed = searchParams.get("force") === "true";

    // Auth: terima CRON_SECRET header ATAU user yang sudah login via Supabase
    const authHeader = request.headers.get("authorization");
    const hasCronSecret =
      !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!hasCronSecret && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const goApiKey = process.env.GOAPI_API_KEY;

    // 1. Fetch semua aset
    const { data: assets, error: assetsErr } = await supabase
      .from("assets")
      .select("id, symbol, name, type");

    if (assetsErr || !assets || assets.length === 0) {
      return NextResponse.json({ error: "No assets found in database" }, { status: 404 });
    }

    // 2. Fetch kurs USD/IDR live
    const usdToIDR = await fetchUSDtoIDR();

    // 3. Tentukan aset mana yang perlu direset (hapus & seed ulang)
    const assetsToReset = new Set<string>();

    if (forceReseed) {
      assets.forEach((a) => assetsToReset.add(a.id));
    } else {
      // Auto-detect: cek apakah ada data USD yang disimpan tanpa konversi kurs
      // Contoh: SILVER_OZ stored ~60 (USD value) → harusnya ~960.000 (IDR value)
      for (const asset of assets) {
        const spec = ASSET_SPEC[asset.symbol];
        if (!spec) continue;

        const { data: latest } = await supabase
          .from("price_history")
          .select("price")
          .eq("asset_id", asset.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .single();

        if (!latest) continue;
        const latestPrice = Number(latest.price);

        // Jika harga tersimpan jauh di bawah 10% dari basePriceIDR → data salah
        if (latestPrice > 0 && latestPrice < spec.basePriceIDR * 0.1) {
          console.log(
            `Auto-reset ${asset.symbol}: stored=${latestPrice} << basePriceIDR=${spec.basePriceIDR} (kemungkinan USD tanpa konversi)`
          );
          assetsToReset.add(asset.id);
        }
      }
    }

    // 4. Hapus price_history untuk aset yang direset
    if (assetsToReset.size > 0) {
      const idsToReset = Array.from(assetsToReset);
      const { error: deleteErr } = await supabase
        .from("price_history")
        .delete()
        .in("asset_id", idsToReset);
      if (deleteErr) throw deleteErr;
      console.log(`Reset price_history: ${idsToReset.length} aset`);
    }

    // 5. Fetch harga emas real
    let goldPricePerGram = 0; // dalam IDR/gram

    if (goApiKey) {
      try {
        const res = await fetch(
          `https://api.goapi.id/v1/gold/antam/latest?api_key=${goApiKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.status === "success" && json.data?.price) {
            goldPricePerGram = Number(json.data.price);
            console.log(`GoAPI emas: Rp ${goldPricePerGram}/gram`);
          }
        }
      } catch (e) {
        console.warn("GoAPI failed:", e);
      }
    }

    if (goldPricePerGram === 0) {
      try {
        const htmlRes = await fetch("https://emasantam.id/harga-emas-antam-harian/", {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          const match = html.match(/var chart_data\s*=\s*(\[[\s\S]*?\]);/);
          if (match) {
            const rawData = JSON.parse(match[1]);
            if (rawData?.length > 0) {
              goldPricePerGram = Number(rawData[rawData.length - 1][1]);
              console.log(`emasantam.id: Rp ${goldPricePerGram}/gram`);
            }
          }
        }
      } catch (e) {
        console.warn("emasantam.id failed:", e);
      }
    }

    // 6. Loop semua aset
    const allInserts: object[] = [];
    const syncStatus: Record<string, string> = {};

    for (const asset of assets) {
      const spec = ASSET_SPEC[asset.symbol] ?? { basePriceIDR: 1_000, drift: 0.0002, stdDev: 0.005 };
      const yahooTicker = YAHOO_TICKERS[asset.symbol];
      const isUSD = USD_DENOMINATED.has(asset.symbol);

      const needsSeed = assetsToReset.has(asset.id);
      const { count } = await supabase
        .from("price_history")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", asset.id);
      const isInsufficient = !count || count < 200;

      if (needsSeed || isInsufficient) {
        // ── MODE SEEDING: isi 365 hari historis ──────────────────────────
        let historicalData: { date: string; price: number }[] = [];

        if (yahooTicker) {
          console.log(`Seeding ${asset.symbol} (${yahooTicker})...`);
          historicalData = await fetchYahooFinancePrices(yahooTicker);
        }

        if (historicalData.length > 0) {
          syncStatus[asset.symbol] = `seeded_yahoo (${historicalData.length} records, usdToIDR=${isUSD ? usdToIDR : "N/A"})`;
          historicalData.forEach((d) => {
            // Konversi ke IDR untuk aset USD
            const priceIDR = isUSD ? d.price * usdToIDR : d.price;
            allInserts.push({
              asset_id: asset.id,
              price: Number(priceIDR.toFixed(4)),
              recorded_at: d.date,
              source: "yahoo_finance",
            });
          });
        } else {
          // Simulasi GBM mundur dari basePriceIDR
          let startPriceIDR = spec.basePriceIDR;

          if (goldPricePerGram > 0) {
            if (asset.symbol === "ANTAM_1GR") startPriceIDR = goldPricePerGram;
            else if (asset.symbol === "ANTAM_5GR") startPriceIDR = goldPricePerGram * 5 * 0.99;
            else if (asset.symbol === "UBS_1GR") startPriceIDR = goldPricePerGram * 0.985;
          }

          const source = goldPricePerGram > 0 && asset.type === "emas"
            ? "emasantam.id_simulated"
            : "simulated_gbm";

          syncStatus[asset.symbol] = `seeded_simulation (startIDR=${startPriceIDR.toFixed(0)})`;
          allInserts.push(...generateHistoricalPrices(asset.id, startPriceIDR, spec, now, source));
        }
      } else {
        // ── MODE UPDATE HARIAN: tambah harga hari ini ─────────────────────
        let todayPriceIDR = spec.basePriceIDR;
        let source = "simulated_gbm";
        let yahooSuccess = false;

        if (yahooTicker) {
          const freshData = await fetchYahooFinancePrices(yahooTicker);
          if (freshData.length > 0) {
            const rawPrice = freshData[freshData.length - 1].price;
            // Konversi ke IDR jika perlu
            todayPriceIDR = isUSD ? rawPrice * usdToIDR : rawPrice;
            source = "yahoo_finance";
            yahooSuccess = true;
          }
        }

        if (!yahooSuccess) {
          // Evolusi dari harga terakhir di DB
          const { data: latestRow } = await supabase
            .from("price_history")
            .select("price")
            .eq("asset_id", asset.id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .single();

          if (latestRow) {
            const dailyReturn = spec.drift + spec.stdDev * randomNormal();
            todayPriceIDR = Number(latestRow.price) * Math.exp(dailyReturn);
          }
        }

        // Override harga emas Antam dengan data real
        if (goldPricePerGram > 0) {
          if (asset.symbol === "ANTAM_1GR") {
            todayPriceIDR = goldPricePerGram;
            source = goApiKey ? "goapi.id" : "emasantam.id";
          } else if (asset.symbol === "ANTAM_5GR") {
            todayPriceIDR = goldPricePerGram * 5 * 0.99;
            source = goApiKey ? "goapi.id" : "emasantam.id";
          } else if (asset.symbol === "UBS_1GR") {
            todayPriceIDR = goldPricePerGram * 0.985;
            source = goApiKey ? "goapi.id" : "emasantam.id";
          }
        }

        syncStatus[asset.symbol] = `updated (Rp ${todayPriceIDR.toFixed(0)}, src=${source})`;
        allInserts.push({
          asset_id: asset.id,
          price: Number(todayPriceIDR.toFixed(4)),
          recorded_at: today,
          source,
        });
      }
    }

    // 7. Upsert ke database dalam batch
    const chunkSize = 100;
    for (let i = 0; i < allInserts.length; i += chunkSize) {
      const chunk = allInserts.slice(i, i + chunkSize);
      const { error: upsertErr } = await supabase
        .from("price_history")
        .upsert(chunk, { onConflict: "asset_id,recorded_at" });
      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({
      success: true,
      usdToIDR,
      goldPricePerGram: goldPricePerGram || null,
      assetsReset: assetsToReset.size,
      forced: forceReseed,
      totalRecordsSynced: allInserts.length,
      date: today,
      syncStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Sync error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
