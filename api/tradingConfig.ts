// project/api/tradingConfig.ts
import { Redis } from "@upstash/redis";

const DEFAULT_NAMESPACE = "bybit";

const makeCfgKey = (name?: string) =>
  `trading:${name || DEFAULT_NAMESPACE}:config`;

// 값 없으면 null 반환
function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function parseJsonSafe<T = any>(v: unknown): T | null {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
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
  symbols: string[];                        // TradeConfig.name별 심볼 리스트 (없으면 빈 배열)
  name: string | null;                      // 백엔드에서 저장한 config.name (ex: "bybit")
};

/**
 * name(네임스페이스)에 해당하는 트레이딩 설정 로드.
 * - Python TradeConfig.to_redis 에서 json.dumps 로 저장했으니,
 *   숫자는 "30.0", bool은 "true", 배열은 '["BTCUSDT", ...]' 꼴로 들어있음.
 */
export async function loadTradingConfig(
  redis: Redis,
  name?: string
): Promise<TradingConfig> {
  const key = makeCfgKey(name);
  const raw = (await (redis as any).hgetall(key)) as
    | Record<string, string | number>
    | null;

  const r = raw || {};

  // name 필드 (json.dumps 로 저장되어 있을 수 있음: "\"bybit\"")
  let cfgName: string | null = null;
  if (r.name != null) {
    const parsed = parseJsonSafe<any>(r.name);
    if (typeof parsed === "string") cfgName = parsed;
    else if (typeof r.name === "string") cfgName = r.name;
  }

  // symbols 필드 (예: '["BTCUSDT","ETHUSDT"]' 또는 "BTCUSDT,ETHUSDT")
  let symbols: string[] = [];
  if (r.symbols != null) {
    const parsed = parseJsonSafe<any>(r.symbols);
    if (Array.isArray(parsed)) {
      symbols = parsed.map((s) => String(s)).filter((s) => s.length > 0);
    } else if (typeof r.symbols === "string" && r.symbols.trim()) {
      symbols = r.symbols
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }

  return {
    ws_stale_sec: toNumOrNull(r.ws_stale_sec),
    ws_global_stale_sec: toNumOrNull(r.ws_global_stale_sec),

    leverage: toNumOrNull(r.leverage),
    entry_percent: toNumOrNull(r.entry_percent),
    max_effective_leverage: toNumOrNull(r.max_effective_leverage),

    indicator_min_thr: toNumOrNull(r.indicator_min_thr),
    indicator_max_thr: toNumOrNull(r.indicator_max_thr),

    target_cross: toNumOrNull(r.target_cross),
    default_exit_ma_threshold: toNumOrNull(r.default_exit_ma_threshold),

    closes_num: toNumOrNull(r.candles_num ?? r.closes_num),

    symbols,
    name: cfgName,
  };
}
