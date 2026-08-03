// Shared TypeScript types for MicroVest

export type AssetType = "emas" | "reksadana" | "obligasi" | "kripto" | "saham";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  unit: string;
  description?: string;
  created_at: string;
}

export interface PriceHistory {
  id: number;
  asset_id: string;
  price: number;
  recorded_at: string;
  source?: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  id: string;
  portfolio_id: string;
  asset_id: string;
  quantity: number;
  avg_buy_price: number;
  buy_date: string;
  notes?: string;
  created_at: string;
  // Joined fields
  asset?: Asset;
  current_price?: number;
  current_value?: number;
  gain_loss?: number;
  gain_loss_pct?: number;
}

export interface PortfolioWithStats extends Portfolio {
  holdings?: PortfolioHolding[];
  total_value?: number;
  total_cost?: number;
  total_gain_loss?: number;
  total_gain_loss_pct?: number;
  allocation?: AllocationItem[];
}

export interface AllocationItem {
  type: AssetType;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

// ─── Simulation Types ───────────────────────────────────────

export interface VaRParams {
  portfolio_id: string;
  confidence: number;       // 0.95 or 0.99
  period_days: number;      // lookback period, e.g. 252
  holding_period: number;   // 1, 5, 10 (days)
}

export interface VaRResult {
  var_value: number;          // IDR at risk
  var_percentage: number;     // as % of portfolio
  confidence: number;
  holding_period: number;
  portfolio_value: number;
  returns: number[];          // daily returns array for histogram
  threshold: number;          // return value at the confidence percentile
  num_observations: number;
  mean_return: number;
  std_return: number;
}

export interface CompoundParams {
  principal: number;
  annual_rate: number;       // e.g. 0.08 for 8%
  tenor_years: number;
  frequency: "daily" | "monthly" | "quarterly" | "annually";
  additional_monthly?: number;
}

export interface CompoundProjection {
  period: number;
  label: string;
  value: number;
  interest_earned: number;
  total_contributed: number;
}

export interface CompoundResult {
  final_value: number;
  total_interest: number;
  total_contributed: number;
  effective_rate: number;
  projection: CompoundProjection[];
}

export interface Simulation {
  id: string;
  portfolio_id: string;
  user_id: string;
  type: "var" | "compound_interest";
  params: VaRParams | CompoundParams;
  result: VaRResult | CompoundResult;
  created_at: string;
}

// ─── API Response wrappers ──────────────────────────────────
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ─── Form types ─────────────────────────────────────────────
export interface AddHoldingForm {
  asset_id: string;
  quantity: string;
  avg_buy_price: string;
  buy_date: string;
  notes?: string;
}

// ─── Data Asset Types ───────────────────────────────────────
export interface AssetWithPrice extends Asset {
  harga_terkini: number;
  tanggal_terkini: string;
  harga_sebelumnya: number | null;
  persentase_perubahan: number | null;
}

export interface AssetGroup {
  type: AssetType;
  label: string;
  count: number;
  assets: AssetWithPrice[];
}
