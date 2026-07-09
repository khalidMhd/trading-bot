#!/usr/bin/env python3
"""Fetch historical XAUUSD M15 candles from MT5 for backtesting."""
import json
import sys

import MetaTrader5 as mt5

SYMBOL = sys.argv[1] if len(sys.argv) > 1 else "XAUUSD"
COUNT = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
MT5_PATH = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None


def resolve_symbol(requested):
    if mt5.symbol_info(requested):
        return requested
    for sym in [requested, "XAUUSD", "XAUUSDm", "GOLD"]:
        info = mt5.symbol_info(sym)
        if info is not None:
            if not info.visible:
                mt5.symbol_select(sym, True)
            return sym
    return None


def main():
    init_kwargs = {}
    if MT5_PATH:
        init_kwargs["path"] = MT5_PATH

    if not mt5.initialize(**init_kwargs):
        print(json.dumps({"error": f"MT5 initialize failed: {mt5.last_error()}"}))
        sys.exit(1)

    try:
        symbol = resolve_symbol(SYMBOL)
        if not symbol:
            print(json.dumps({"error": f"Symbol {SYMBOL} not found"}))
            sys.exit(1)

        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M15, 0, COUNT)
        rates_h1 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H1, 0, 500)
        rates_m5 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M5, 0, min(COUNT * 3, 5000))

        if rates is None or len(rates) == 0:
            print(json.dumps({"error": "No historical data"}))
            sys.exit(1)

        def to_candles(raw):
            if raw is None:
                return []
            return [
                {
                    "time": int(r["time"]),
                    "open": float(r["open"]),
                    "high": float(r["high"]),
                    "low": float(r["low"]),
                    "close": float(r["close"]),
                    "volume": int(r["tick_volume"]),
                }
                for r in raw
            ]

        print(
            json.dumps(
                {
                    "symbol": symbol,
                    "candles": to_candles(rates),
                    "h1_candles": to_candles(rates_h1),
                    "m5_candles": to_candles(rates_m5),
                }
            )
        )
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
