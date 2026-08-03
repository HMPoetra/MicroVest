import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Box-Muller transform for normal distribution
function randomNormal() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface AssetParams {
  basePrice: number;
  drift: number;   // expected daily return
  stdDev: number;  // daily volatility
}

const ASSET_SPEC: Record<string, AssetParams> = {
  // Emas & Komoditas
  "ANTAM_1GR": { basePrice: 1350000, drift: 0.0003, stdDev: 0.008 },
  "ANTAM_5GR": { basePrice: 1336500, drift: 0.0003, stdDev: 0.008 },
  "UBS_1GR": { basePrice: 1329750, drift: 0.0003, stdDev: 0.008 },
  "GOLD_OZ": { basePrice: 2350, drift: 0.0003, stdDev: 0.008 },
  "SILVER_OZ": { basePrice: 28, drift: 0.00025, stdDev: 0.015 },

  // Reksa Dana
  "RDPT_MANULIFE": { basePrice: 2800, drift: 0.00045, stdDev: 0.012 },
  "RDPU_BNI": { basePrice: 1250, drift: 0.00018, stdDev: 0.0002 },
  "RDPC_SCHRODER": { basePrice: 1850, drift: 0.00032, stdDev: 0.006 },
  "RDPS_SUCOR": { basePrice: 2200, drift: 0.00048, stdDev: 0.013 },
  "RDPU_SUCOR": { basePrice: 1500, drift: 0.00015, stdDev: 0.0002 },

  // Obligasi
  "SBR012": { basePrice: 1000000, drift: 0.00022, stdDev: 0.0005 },
  "ORI023": { basePrice: 1005000, drift: 0.00024, stdDev: 0.0015 },
  "SR018": { basePrice: 1000000, drift: 0.00021, stdDev: 0.0005 },
  "FR0097": { basePrice: 1000000, drift: 0.00025, stdDev: 0.0010 },

  // Kripto
  "BTC_USD": { basePrice: 60000, drift: 0.0008, stdDev: 0.025 },
  "ETH_USD": { basePrice: 3200, drift: 0.0007, stdDev: 0.030 },
  "SOL_USD": { basePrice: 140, drift: 0.0012, stdDev: 0.045 },
  "BNB_USD": { basePrice: 580, drift: 0.0009, stdDev: 0.035 },
  "ADA_USD": { basePrice: 0.45, drift: 0.0005, stdDev: 0.040 },
  "XRP_USD": { basePrice: 0.50, drift: 0.0004, stdDev: 0.038 },
  "DOGE_USD": { basePrice: 0.12, drift: 0.0015, stdDev: 0.060 },

  // Saham
  "BBCA": { basePrice: 10000, drift: 0.0004, stdDev: 0.012 },
  "BBRI": { basePrice: 4800, drift: 0.00035, stdDev: 0.015 },
  "TLKM": { basePrice: 3200, drift: 0.0002, stdDev: 0.014 },
  "ASII": { basePrice: 4500, drift: 0.0002, stdDev: 0.016 },
  "AAPL": { basePrice: 210, drift: 0.0005, stdDev: 0.013 },
  "MSFT": { basePrice: 420, drift: 0.00055, stdDev: 0.012 },
  "GOOGL": { basePrice: 175, drift: 0.00048, stdDev: 0.014 },
  "TSLA": { basePrice: 180, drift: 0.0007, stdDev: 0.028 },
};

const YAHOO_TICKERS: Record<string, string> = {
  "GOLD_OZ": "GC=F",
  "SILVER_OZ": "SI=F",
  "RDPT_MANULIFE": "BBCA.JK",
  "RDPC_SCHRODER": "^JKSE",
  "RDPS_SUCOR": "TLKM.JK",
  "RDPU_SUCOR": "BBNI.JK",
  "BTC_USD": "BTC-USD",
  "ETH_USD": "ETH-USD",
  "SOL_USD": "SOL-USD",
  "BNB_USD": "BNB-USD",
  "ADA_USD": "ADA-USD",
  "XRP_USD": "XRP-USD",
  "DOGE_USD": "DOGE-USD",
  "BBCA": "BBCA.JK",
  "BBRI": "BBRI.JK",
  "TLKM": "TLKM.JK",
  "ASII": "ASII.JK",
  "AAPL": "AAPL",
  "MSFT": "MSFT",
  "GOOGL": "GOOGL",
  "TSLA": "TSLA",
};

async function fetchYahooFinancePrices(ticker: string): Promise<{ date: string; price: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        signal: AbortSignal.timeout(8000)
      }
    );
    if (!res.ok) throw new Error(`Yahoo HTTP error: ${res.status}`);
    const json = await res.json();
    const chart = json.chart?.result?.[0];
    if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]?.close) {
      throw new Error(`Invalid Yahoo response for ${ticker}`);
    }

    const timestamps: number[] = chart.timestamp;
    const closes: (number | null)[] = chart.indicators.quote[0].close;

    const data: { date: string; price: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price !== null && price !== undefined && price > 0) {
        const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
        data.push({ date, price });
      }
    }
    return data;
  } catch (e) {
    console.warn(`Yahoo Finance failed for ticker ${ticker}:`, e);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const goApiKey = process.env.GOAPI_API_KEY;

    // 1. Fetch all assets
    const { data: assets, error: assetsErr } = await supabase
      .from("assets")
      .select("id, symbol, name, type");

    if (assetsErr || !assets || assets.length === 0) {
      return NextResponse.json({ error: "No assets found in database" }, { status: 404 });
    }

    // Try to get latest gold price from GoAPI if API key is set
    let goApiAntamPrice = 0;
    if (goApiKey) {
      try {
        const res = await fetch(`https://api.goapi.id/v1/gold/antam/latest?api_key=${goApiKey}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.status === "success" && json.data?.price) {
            goApiAntamPrice = Number(json.data.price);
          }
        }
      } catch (e) {
        console.warn("GoAPI gold fetch failed:", e);
      }
    }

    // Scrape real-time gold price from emasantam.id as fallback for gold
    let scrapedAntamPrice = goApiAntamPrice;
    if (scrapedAntamPrice === 0) {
      try {
        const htmlRes = await fetch("https://emasantam.id/harga-emas-antam-harian/", {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          const match = html.match(/var chart_data\s*=\s*(\[[\s\S]*?\]);/);
          if (match) {
            const rawData = JSON.parse(match[1]);
            if (rawData && rawData.length > 0) {
              scrapedAntamPrice = rawData[rawData.length - 1][1];
            }
          }
        }
      } catch (e) {
        console.log("emasantam.id scraping failed, using generator fallback for gold", e);
      }
    }

    const allInserts: any[] = [];
    const syncStatus: Record<string, string> = {};

    for (const asset of assets) {
      const spec = ASSET_SPEC[asset.symbol] || { basePrice: 1000, drift: 0.0002, stdDev: 0.005 };
      const yahooTicker = YAHOO_TICKERS[asset.symbol];

      // Check current price history count
      const { count, error: countErr } = await supabase
        .from("price_history")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", asset.id);

      if (countErr) {
        console.error(`Error counting prices for ${asset.symbol}:`, countErr);
        continue;
      }

      // If price history is less than 200, we need to seed the historical data
      if (!count || count < 200) {
        let historicalData: { date: string; price: number }[] = [];

        // If it's a mutual fund, try Yahoo Finance first
        if (yahooTicker) {
          console.log(`Fetching Yahoo Finance historical data for ${asset.symbol} (${yahooTicker})...`);
          historicalData = await fetchYahooFinancePrices(yahooTicker);
        }

        if (historicalData.length > 0) {
          syncStatus[asset.symbol] = `seeded_from_yahoo_finance (${historicalData.length} records)`;
          historicalData.forEach((d) => {
            allInserts.push({
              asset_id: asset.id,
              price: Number(d.price.toFixed(4)),
              recorded_at: d.date,
              source: "yahoo_finance",
            });
          });
        } else {
          // Generate historical data using Box-Muller random walk fallback
          syncStatus[asset.symbol] = "generated_365_days_history";
          
          let startPrice = spec.basePrice;
          if (scrapedAntamPrice > 0) {
            const goldPricePerGram = scrapedAntamPrice / 2;
            if (asset.symbol === "ANTAM_1GR") {
              startPrice = goldPricePerGram;
            } else if (asset.symbol === "ANTAM_5GR") {
              startPrice = goldPricePerGram * 5 * 0.99;
            } else if (asset.symbol === "UBS_1GR") {
              startPrice = goldPricePerGram * 0.985;
            }
          }

          let currentPrice = startPrice;
          for (let i = 0; i < 365; i++) {
            const recordedDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            
            allInserts.push({
              asset_id: asset.id,
              price: Number(currentPrice.toFixed(4)),
              recorded_at: recordedDate,
              source: asset.symbol.startsWith("ANTAM") || asset.symbol.startsWith("UBS") ? (scrapedAntamPrice > 0 ? "emasantam.id" : "simulated_api") : "simulated_api",
            });

            const dailyReturn = spec.drift + spec.stdDev * randomNormal();
            currentPrice = currentPrice / Math.exp(dailyReturn);
          }
        }
      } else {
        // Just sync today's price (Normal daily sync mode)
        syncStatus[asset.symbol] = "synced_today";

        let todayPrice = spec.basePrice;

        // For mutual funds, try fetching from Yahoo Finance first to get real-time price
        let yahooSuccess = false;
        if (yahooTicker) {
          const freshData = await fetchYahooFinancePrices(yahooTicker);
          if (freshData.length > 0) {
            todayPrice = freshData[freshData.length - 1].price;
            yahooSuccess = true;
          }
        }

        if (!yahooSuccess) {
          const { data: latestPriceRow } = await supabase
            .from("price_history")
            .select("price")
            .eq("asset_id", asset.id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .single();

          if (latestPriceRow) {
            const dailyReturn = spec.drift + spec.stdDev * randomNormal();
            todayPrice = latestPriceRow.price * Math.exp(dailyReturn);
          }
        }

        // Apply scraped or GoAPI price for gold if available
        if (scrapedAntamPrice > 0) {
          const goldPricePerGram = scrapedAntamPrice / 2;
          if (asset.symbol === "ANTAM_1GR") {
            todayPrice = goldPricePerGram;
          } else if (asset.symbol === "ANTAM_5GR") {
            todayPrice = goldPricePerGram * 5 * 0.99;
          } else if (asset.symbol === "UBS_1GR") {
            todayPrice = goldPricePerGram * 0.985;
          }
        }

        allInserts.push({
          asset_id: asset.id,
          price: Number(todayPrice.toFixed(4)),
          recorded_at: today,
          source: yahooTicker && yahooSuccess ? "yahoo_finance" : (asset.symbol.startsWith("ANTAM") || asset.symbol.startsWith("UBS") ? (scrapedAntamPrice > 0 ? "emasantam.id" : "simulated_api") : "simulated_api"),
        });
      }
    }

    // Upsert all gathered prices in chunks
    const chunkSize = 100;
    for (let i = 0; i < allInserts.length; i += chunkSize) {
      const chunk = allInserts.slice(i, i + chunkSize);
      const { error: upsertErr } = await supabase
        .from("price_history")
        .upsert(chunk, { onConflict: "asset_id,recorded_at" });

      if (upsertErr) {
        throw upsertErr;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sync prices completed successfully for all assets",
      syncStatus,
      totalRecordsSynced: allInserts.length,
      date: today,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
