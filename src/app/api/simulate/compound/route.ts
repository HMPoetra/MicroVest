import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeCompoundInterest } from "@/lib/engines";

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
    const {
      principal,
      annual_rate,
      tenor_years,
      frequency,
      additional_monthly = 0,
      portfolio_id,
      use_dynamic = false,
      custom_holdings,
    } = body;

    // Validate basic inputs
    if (!principal || !tenor_years || !frequency) {
      return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
    }
    if (principal <= 0 || tenor_years <= 0) {
      return NextResponse.json(
        { error: "Principal dan tenor harus positif" },
        { status: 400 }
      );
    }
    if (tenor_years > 50) {
      return NextResponse.json({ error: "Tenor maksimal 50 tahun" }, { status: 400 });
    }

    let dynamic_rates: number[] | undefined = undefined;

    if (use_dynamic) {
      let holdings: { asset_id: string; weight: number }[] = [];

      if (portfolio_id === "custom") {
        if (!custom_holdings || !Array.isArray(custom_holdings) || custom_holdings.length === 0) {
          return NextResponse.json({ error: "Komposisi kustom portofolio kosong untuk return dinamis" }, { status: 400 });
        }
        holdings = custom_holdings.map((h: any) => ({
          asset_id: h.asset_id,
          weight: Number(h.weight),
        }));

        // Normalize
        const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);
        if (totalWeight <= 0) {
          return NextResponse.json({ error: "Total bobot harus positif" }, { status: 400 });
        }
        holdings = holdings.map(h => ({ ...h, weight: h.weight / totalWeight }));
      } else if (portfolio_id) {
        // Fetch from DB
        const { data: dbHoldings, error: holdingsErr } = await supabase
          .from("portfolio_holdings")
          .select("*, asset:assets(*)")
          .eq("portfolio_id", portfolio_id);

        if (holdingsErr) throw holdingsErr;
        if (!dbHoldings || dbHoldings.length === 0) {
          return NextResponse.json({ error: "Portofolio terpilih kosong atau tidak ditemukan" }, { status: 400 });
        }

        const assetIds = dbHoldings.map((h) => h.asset_id);
        const { data: latestPrices } = await supabase
          .from("price_history")
          .select("asset_id, price, recorded_at")
          .in("asset_id", assetIds)
          .order("recorded_at", { ascending: false });

        const latestPriceMap: Record<string, number> = {};
        latestPrices?.forEach((p) => {
          if (!latestPriceMap[p.asset_id]) latestPriceMap[p.asset_id] = Number(p.price);
        });

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

        holdings = dbHoldings.map((h) => ({
          asset_id: h.asset_id,
          weight: values[h.asset_id] / totalValue,
        }));
      } else {
        return NextResponse.json({ error: "Silakan pilih portofolio atau buat komposisi kustom untuk return dinamis" }, { status: 400 });
      }

      // Fetch historical prices to compute daily returns
      const assetIds = holdings.map((h) => h.asset_id);
      const { data: priceHistories, error: priceErr } = await supabase
        .from("price_history")
        .select("asset_id, price, recorded_at")
        .in("asset_id", assetIds)
        .order("recorded_at", { ascending: true });

      if (priceErr) throw priceErr;
      if (!priceHistories || priceHistories.length === 0) {
        return NextResponse.json({ error: "Data harga historis tidak ditemukan di database. Lakukan Sync Harga terlebih dahulu." }, { status: 400 });
      }

      // Align dates
      const dates = Array.from(new Set(priceHistories.map((p) => p.recorded_at))).sort();
      const priceMap: Record<string, Record<string, number>> = {};
      priceHistories.forEach((p) => {
        if (!priceMap[p.recorded_at]) priceMap[p.recorded_at] = {};
        priceMap[p.recorded_at][p.asset_id] = Number(p.price);
      });

      const lastPrices: Record<string, number> = {};
      const dailyReturns: number[] = [];

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const currentPrices = priceMap[date];

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

          if (validAssetsCount === holdings.length) {
            dailyReturns.push(weightedReturn);
          }
        }
      }

      if (dailyReturns.length < 10) {
        return NextResponse.json({ error: "Data historis tidak mencukupi untuk simulasi return dinamis (minimal 10 hari return)." }, { status: 400 });
      }

      // Bootstrap annual rates for the tenor
      const tradingDaysPerYear = 252;
      dynamic_rates = [];
      for (let y = 0; y < tenor_years; y++) {
        let yearLogReturn = 0;
        for (let d = 0; d < tradingDaysPerYear; d++) {
          const randomIndex = Math.floor(Math.random() * dailyReturns.length);
          yearLogReturn += dailyReturns[randomIndex];
        }
        const yearSimpleReturn = Math.exp(yearLogReturn) - 1;
        dynamic_rates.push(yearSimpleReturn);
      }
    } else {
      // Validate rate for static case
      if (annual_rate === undefined || annual_rate <= 0) {
        return NextResponse.json({ error: "Suku bunga tahunan statis harus positif" }, { status: 400 });
      }
    }

    const result = computeCompoundInterest({
      principal,
      annual_rate: annual_rate ? annual_rate : 0.08, // fallback or ignored if dynamic
      tenor_years,
      frequency,
      additional_monthly,
      dynamic_rates,
    });

    // Save simulation if linked to portfolio in DB
    if (portfolio_id && portfolio_id !== "custom") {
      await supabase.from("simulations").insert({
        portfolio_id,
        user_id: user.id,
        type: "compound_interest",
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
