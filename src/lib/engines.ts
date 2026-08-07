// VaR (Value at Risk) — Historical Simulation Engine
// Reference: Jorion (2007), fully implemented in TypeScript for Next.js API Routes

export interface VaRInput {
  prices?: number[];         // chronological price array (optional if returns is provided)
  returns?: number[];        // daily returns array directly (optional)
  confidence: number;       // 0.95 or 0.99
  holding_period: number;   // days (1, 5, 10)
  portfolio_value: number;  // current IDR value
}

export interface VaROutput {
  var_value: number;        // IDR at risk
  var_percentage: number;   // fraction of portfolio
  confidence: number;
  holding_period: number;
  portfolio_value: number;
  returns: number[];        // sorted daily log returns
  threshold: number;        // return at VaR cutoff
  num_observations: number;
  mean_return: number;
  std_return: number;
}

/**
 * Compute historical simulation VaR.
 * Uses log returns: r_t = ln(P_t / P_{t-1})
 */
export function computeVaR(input: VaRInput): VaROutput {
  const { prices, returns, confidence, holding_period, portfolio_value } = input;

  // 1. Get or compute daily log returns
  let dailyReturns: number[] = [];
  if (returns && returns.length > 0) {
    dailyReturns = [...returns];
  } else {
    if (!prices || prices.length < 2) {
      throw new Error("Minimal 2 data harga atau data return diperlukan.");
    }
    for (let i = 1; i < prices.length; i++) {
      dailyReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }

  // 2. Sort ascending (worst losses at the front)
  const sorted = [...dailyReturns].sort((a, b) => a - b);

  // 3. Find cutoff index at (1 - confidence) percentile
  const cutoffIdx = Math.floor((1 - confidence) * sorted.length);
  const threshold = sorted[cutoffIdx] ?? sorted[0];

  // 4. Scale to holding period using square-root-of-time rule
  const scaledThreshold = threshold * Math.sqrt(holding_period);

  // 5. VaR in IDR (positive value = loss amount)
  const var_value = Math.abs(scaledThreshold) * portfolio_value;

  // 6. Statistics
  const mean_return =
    dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((a, b) => a + Math.pow(b - mean_return, 2), 0) /
    (dailyReturns.length - 1);
  const std_return = Math.sqrt(variance);

  return {
    var_value,
    var_percentage: var_value / portfolio_value,
    confidence,
    holding_period,
    portfolio_value,
    returns: sorted,
    threshold,
    num_observations: dailyReturns.length,
    mean_return,
    std_return,
  };
}

// ─── Compound Interest Engine ────────────────────────────────

export interface CompoundInput {
  principal: number;
  annual_rate: number;        // decimal, e.g. 0.08 for 8%
  tenor_years: number;
  frequency: "daily" | "monthly" | "quarterly" | "annually" | "custom" | string;
  custom_frequency?: number;
  additional_monthly: number; // additional contribution per month
  dynamic_rates?: number[];   // dynamic rates per year/period
}

export interface CompoundPeriod {
  period: number;
  label: string;             // e.g. "Tahun 1 (2027)", "Bulan 6"
  sub_label?: string;        // e.g. "2027" or "Bulan ke-6"
  value: number;             // total portfolio value
  interest_earned: number;   // cumulative interest
  total_contributed: number; // cumulative contributions
}

export interface CompoundOutput {
  final_value: number;
  total_interest: number;
  total_contributed: number;
  effective_rate: number;
  projection: CompoundPeriod[];
  periodic_projection?: CompoundPeriod[];
}

const FREQ_MAP: Record<string, number> = { daily: 365, monthly: 12, quarterly: 4, annually: 1 };

/**
 * Compound interest with optional monthly additional contributions.
 * Formula: A = P(1 + r/n)^(nt) + PMT * [((1+r/n)^(nt) - 1) / (r/n)]
 */
export function computeCompoundInterest(input: CompoundInput): CompoundOutput {
  const { principal, annual_rate, tenor_years, frequency, custom_frequency, additional_monthly = 0, dynamic_rates } = input;
  
  let n = FREQ_MAP[frequency];
  if (!n || n <= 0) {
    if (frequency === "custom" && custom_frequency && custom_frequency > 0) {
      n = custom_frequency;
    } else {
      n = 12; // default to monthly
    }
  }

  const additional_per_period = (Number(additional_monthly) || 0) * (12 / n);

  const projection: CompoundPeriod[] = [];
  const periodic_projection: CompoundPeriod[] = [];
  const currentYear = new Date().getFullYear();

  let currentValue = Math.max(0, Number(principal) || 0);
  let totalContributed = Math.max(0, Number(principal) || 0);

  // Year 0 (initial)
  const initialPoint: CompoundPeriod = {
    period: 0,
    label: `Awal (${currentYear})`,
    sub_label: "Modal Awal",
    value: Math.round(currentValue),
    interest_earned: 0,
    total_contributed: Math.round(totalContributed),
  };
  projection.push(initialPoint);
  periodic_projection.push({
    period: 0,
    label: "Awal",
    sub_label: "Modal Awal",
    value: Math.round(currentValue),
    interest_earned: 0,
    total_contributed: Math.round(totalContributed),
  });

  let periodCounter = 0;
  const maxPeriodicPoints = 240; // cap for performance in very long tenors

  // Calculate year by year
  for (let year = 1; year <= tenor_years; year++) {
    const year_rate = (dynamic_rates && dynamic_rates[year - 1] !== undefined)
      ? dynamic_rates[year - 1]
      : (Number(annual_rate) || 0);

    const rate_per_period = year_rate / n;

    // Compounding n periods within this year
    for (let p = 1; p <= n; p++) {
      periodCounter++;
      currentValue = currentValue * (1 + rate_per_period) + additional_per_period;
      totalContributed += additional_per_period;

      if (frequency !== "annually" && periodCounter <= maxPeriodicPoints) {
        let periodLabel = `Periode ${periodCounter}`;
        if (frequency === "monthly") {
          periodLabel = `Bulan ${periodCounter}`;
        } else if (frequency === "quarterly") {
          periodLabel = `Triwulan ${periodCounter}`;
        } else if (frequency === "daily") {
          periodLabel = `Hari ${periodCounter}`;
        }

        periodic_projection.push({
          period: periodCounter,
          label: periodLabel,
          sub_label: `Tahun ${year} (${currentYear + year})`,
          value: Math.round(currentValue),
          interest_earned: Math.round(Math.max(0, currentValue - totalContributed)),
          total_contributed: Math.round(totalContributed),
        });
      }
    }

    const interest_earned = currentValue - totalContributed;

    projection.push({
      period: year,
      label: `Tahun ${year} (${currentYear + year})`,
      sub_label: `Tahun ke-${year}`,
      value: Math.round(currentValue),
      interest_earned: Math.round(Math.max(0, interest_earned)),
      total_contributed: Math.round(totalContributed),
    });
  }

  // Effective rate is the average dynamic rate if dynamic, otherwise compounded static rate
  const effective_rate = dynamic_rates && dynamic_rates.length > 0
    ? (dynamic_rates.reduce((sum, r) => sum + r, 0) / dynamic_rates.length)
    : (n > 0 ? Math.pow(1 + (Number(annual_rate) || 0) / n, n) - 1 : (Number(annual_rate) || 0));

  const final = projection[projection.length - 1] || {
    value: currentValue,
    interest_earned: 0,
    total_contributed: totalContributed,
  };

  return {
    final_value: final.value,
    total_interest: final.interest_earned,
    total_contributed: final.total_contributed,
    effective_rate,
    projection,
    periodic_projection: frequency !== "annually" ? periodic_projection : undefined,
  };
}
