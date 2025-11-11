// project/api/tradingConfig.ts
import { Redis } from "@upstash/redis";

const REDIS_KEY_CFG = "trading:config";

// 값 없으면 null 반환
function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

export type TradingConfig = {
  ws_stale_sec: number | null;
  ws_global_stale_sec: number | null;
  leverage: number | null;
  entry_percent: number | null;
  max_effective_leverage: number | null;
  indicator_min_thr: number | null;
  indicator_max_thr: number | null;
  target_cross: number | null;
  default_exit_ma_threshold: number | null; // 부호는 저장값 그대로 유지
  closes_num: number | null;                // 저장 안되어 있으면 null
};

export async function loadTradingConfig(redis: Redis): Promise<TradingConfig> {
  const raw = (await (redis as any).hgetall(REDIS_KEY_CFG)) as
    | Record<string, string | number>
    | null;

  return {
    ws_stale_sec: toNumOrNull(raw?.ws_stale_sec),
    ws_global_stale_sec: toNumOrNull(raw?.ws_global_stale_sec),

    leverage: toNumOrNull(raw?.leverage),
    entry_percent: toNumOrNull(raw?.entry_percent),
    max_effective_leverage: toNumOrNull(raw?.max_effective_leverage),

    indicator_min_thr: toNumOrNull(raw?.indicator_min_thr),
    indicator_max_thr: toNumOrNull(raw?.indicator_max_thr),

    target_cross: toNumOrNull(raw?.target_cross),
    default_exit_ma_threshold: toNumOrNull(raw?.default_exit_ma_threshold),

    closes_num: toNumOrNull(raw?.closes_num),
  };
}
