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
  frequency: "daily" | "monthly" | "quarterly" | "annually";
  additional_monthly: number; // additional contribution per month
  dynamic_rates?: number[];   // dynamic rates per year/period
}

export interface CompoundPeriod {
  period: number;
  label: string;             // e.g. "Tahun 1", "Bulan 6"
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
}

const FREQ_MAP = { daily: 365, monthly: 12, quarterly: 4, annually: 1 };

/**
 * Compound interest with optional monthly additional contributions.
 * Formula: A = P(1 + r/n)^(nt) + PMT * [((1+r/n)^(nt) - 1) / (r/n)]
 */
export function computeCompoundInterest(input: CompoundInput): CompoundOutput {
  const { principal, annual_rate, tenor_years, frequency, additional_monthly, dynamic_rates } = input;
  const n = FREQ_MAP[frequency];
  const additional_per_period = additional_monthly * (12 / n);

  const projection: CompoundPeriod[] = [];
  const labelUnit = "Tahun";

  let currentValue = principal;
  let totalContributed = principal;

  // Year 0 (initial)
  projection.push({
    period: 0,
    label: "Awal",
    value: Math.round(currentValue),
    interest_earned: 0,
    total_contributed: Math.round(totalContributed),
  });

  // Calculate year by year
  for (let year = 1; year <= tenor_years; year++) {
    // Determine the rate to use for this year.
    // If dynamic_rates is provided, use the rate for this year (1-based, index year-1),
    // otherwise fallback to the annual_rate.
    const year_rate = (dynamic_rates && dynamic_rates[year - 1] !== undefined)
      ? dynamic_rates[year - 1]
      : annual_rate;

    const rate_per_period = year_rate / n;

    // Compounding n periods within this year
    for (let p = 1; p <= n; p++) {
      currentValue = currentValue * (1 + rate_per_period) + additional_per_period;
      totalContributed += additional_per_period;
    }

    const interest_earned = currentValue - totalContributed;

    projection.push({
      period: year,
      label: `${labelUnit} ${year}`,
      value: Math.round(currentValue),
      interest_earned: Math.round(Math.max(0, interest_earned)),
      total_contributed: Math.round(totalContributed),
    });
  }

  // Effective rate is the average dynamic rate if dynamic, otherwise compounded static rate
  const effective_rate = dynamic_rates && dynamic_rates.length > 0
    ? (dynamic_rates.reduce((sum, r) => sum + r, 0) / dynamic_rates.length)
    : (Math.pow(1 + annual_rate / n, n) - 1);

  const final = projection[projection.length - 1];
  return {
    final_value: final.value,
    total_interest: final.interest_earned,
    total_contributed: final.total_contributed,
    effective_rate,
    projection,
  };
}
