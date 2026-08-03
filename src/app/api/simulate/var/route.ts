import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeVaR } from "@/lib/engines";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { portfolio_id, confidence, period_days, holding_period, custom_holdings, portfolio_value: custom_value } = body;

    // Validate params
    if (!portfolio_id || !confidence || !period_days || !holding_period) {
      return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
    }
    if (confidence !== 0.95 && confidence !== 0.99) {
      return NextResponse.json({ error: "Confidence harus 0.95 atau 0.99" }, { status: 400 });
    }

    let holdings: { asset_id: string; weight: number }[] = [];
    let portfolio_value = 0;

    if (portfolio_id === "custom") {
      if (!custom_holdings || !Array.isArray(custom_holdings) || custom_holdings.length === 0) {
        return NextResponse.json({ error: "Komposisi kustom portofolio kosong" }, { status: 400 });
      }
      if (!custom_value || custom_value <= 0) {
        return NextResponse.json({ error: "Nilai awal investasi kustom harus positif" }, { status: 400 });
      }
      
      holdings = custom_holdings.map((h: any) => ({
        asset_id: h.asset_id,
        weight: Number(h.weight),
      }));

      // Normalize weights to sum to 1
      const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);
      if (totalWeight <= 0) {
        return NextResponse.json({ error: "Total bobot harus positif" }, { status: 400 });
      }
      holdings = holdings.map(h => ({
        ...h,
        weight: h.weight / totalWeight,
      }));

      portfolio_value = custom_value;
    } else {
      // Get portfolio holdings from DB
      const { data: dbHoldings, error: holdingsErr } = await supabase
        .from("portfolio_holdings")
        .select("*, asset:assets(*)")
        .eq("portfolio_id", portfolio_id);

      if (holdingsErr) throw holdingsErr;
      if (!dbHoldings || dbHoldings.length === 0) {
        return NextResponse.json({ error: "Portofolio kosong atau tidak ditemukan" }, { status: 400 });
      }

      // Get current prices for portfolio value calculation
      const assetIds = dbHoldings.map((h) => h.asset_id);
      const { data: latestPrices } = await supabase
        .from("price_history")
        .select("asset_id, price, recorded_at")
        .in("asset_id", assetIds)
        .order("recorded_at", { ascending: false });

      // Build price map (latest price per asset)
      const latestPriceMap: Record<string, number> = {};
      latestPrices?.forEach((p) => {
        if (!latestPriceMap[p.asset_id]) latestPriceMap[p.asset_id] = Number(p.price);
      });

      // Calculate portfolio value and individual values to determine weights
      let totalValue = 0;
      const values: Record<string, number> = {};
      
      dbHoldings.forEach((h) => {
        const price = latestPriceMap[h.asset_id] ?? Number(h.avg_buy_price);
        const val = Number(h.quantity) * price;
        values[h.asset_id] = val;
        totalValue += val;
      });

      if (totalValue <= 0) {
        return NextResponse.json({ error: "Nilai portofolio tidak valid" }, { status: 400 });
      }

      portfolio_value = totalValue;

      // Map to assets and weights
      holdings = dbHoldings.map((h) => ({
        asset_id: h.asset_id,
        weight: values[h.asset_id] / totalValue,
      }));
    }

    // Get historical prices for ALL assets in portfolio
    const assetIds = holdings.map((h) => h.asset_id);
    
    const { data: priceHistories, error: priceErr } = await supabase
      .from("price_history")
      .select("asset_id, price, recorded_at")
      .in("asset_id", assetIds)
      .order("recorded_at", { ascending: true });

    if (priceErr) throw priceErr;
    if (!priceHistories || priceHistories.length === 0) {
      return NextResponse.json({ error: "Data harga historis tidak ditemukan di database" }, { status: 400 });
    }

    // Group price history by date: date -> asset_id -> price
    const dates = Array.from(new Set(priceHistories.map((p) => p.recorded_at))).sort();
    const priceMap: Record<string, Record<string, number>> = {};
    priceHistories.forEach((p) => {
      if (!priceMap[p.recorded_at]) priceMap[p.recorded_at] = {};
      priceMap[p.recorded_at][p.asset_id] = Number(p.price);
    });

    const lastPrices: Record<string, number> = {};
    const dailyReturns: number[] = [];

    // Align and compute weighted returns
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const currentPrices = priceMap[date];

      // Update last seen prices for forward-filling
      assetIds.forEach((id) => {
        if (currentPrices[id] !== undefined) {
          lastPrices[id] = currentPrices[id];
        }
      });

      if (i > 0) {
        const prevDate = dates[i - 1];
        const prevPrices = priceMap[prevDate];

        let weightedReturn = 0;
        let validAssetsCount = 0;

        holdings.forEach((h) => {
          const assetId = h.asset_id;
          const weight = h.weight;

          const pCurrent = currentPrices[assetId] ?? lastPrices[assetId];
          const pPrev = prevPrices[assetId] ?? lastPrices[assetId];

          if (pCurrent !== undefined && pPrev !== undefined && pPrev > 0) {
            const assetReturn = Math.log(pCurrent / pPrev);
            weightedReturn += weight * assetReturn;
            validAssetsCount++;
          }
        });

        // Only include dates where we could compute returns for all assets in portfolio
        if (validAssetsCount === holdings.length) {
          dailyReturns.push(weightedReturn);
        }
      }
    }

    // Ensure we have enough data points
    const slicedReturns = dailyReturns.slice(-period_days);
    if (slicedReturns.length < 10) {
      return NextResponse.json(
        { error: `Data historis tidak mencukupi (diperoleh ${slicedReturns.length} hari, minimal 10 hari). Silakan lakukan Sync Harga terlebih dahulu.` },
        { status: 400 }
      );
    }

    // Call VaR engine using the returns directly
    const result = computeVaR({
      returns: slicedReturns,
      confidence,
      holding_period,
      portfolio_value,
    });

    // Save simulation result if it's a real database portfolio
    if (portfolio_id !== "custom") {
      await supabase.from("simulations").insert({
        portfolio_id,
        user_id: user.id,
        type: "var",
        params: body,
        result,
      });
    }

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
