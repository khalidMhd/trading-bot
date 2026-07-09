#!/usr/bin/env python3
"""Fetch XAUUSD M15 candles directly from MetaTrader 5 terminal."""
import json
import sys

import MetaTrader5 as mt5

SYMBOL = sys.argv[1] if len(sys.argv) > 1 else "XAUUSD"
COUNT = int(sys.argv[2]) if len(sys.argv) > 2 else 100
MT5_PATH = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None


def resolve_symbol(requested):
    if mt5.symbol_info(requested):
        return requested

    candidates = [
        requested,
        "XAUUSD",
        "XAUUSDm",
        "XAUUSD.",
        "GOLD",
        "Gold",
        "XAUUSD.r",
    ]
    for sym in candidates:
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
    err = mt5.last_error()
    print(
      json.dumps(
        {
          "error": f"MT5 initialize failed: {err}. Open MetaTrader 5 and log in first.",
        }
      )
    )
    sys.exit(1)

  try:
    symbol = resolve_symbol(SYMBOL)
    if not symbol:
      print(json.dumps({"error": f"Symbol {SYMBOL} not found in MT5 Market Watch"}))
      sys.exit(1)

    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M15, 0, COUNT)
    rates_m5 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M5, 0, 60)
    rates_h1 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H1, 0, 100)
    if rates is None or len(rates) == 0:
      err = mt5.last_error()
      print(json.dumps({"error": f"No candle data for {symbol}: {err}"}))
      sys.exit(1)

    def to_candles(raw):
      items = []
      if raw is None:
        return items
      for r in raw:
        items.append(
          {
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": int(r["tick_volume"]),
          }
        )
      return items

    candles = to_candles(rates)
    m5_candles = to_candles(rates_m5)
    h1_candles = to_candles(rates_h1)

    tick = mt5.symbol_info_tick(symbol)

    if tick is not None and candles:
      last = candles[-1]
      last["close"] = float(tick.bid)
      last["high"] = max(last["high"], last["close"])
      last["low"] = min(last["low"], last["close"])

    if tick is not None and m5_candles:
      last_m5 = m5_candles[-1]
      last_m5["close"] = float(tick.bid)
      last_m5["high"] = max(last_m5["high"], last_m5["close"])
      last_m5["low"] = min(last_m5["low"], last_m5["close"])

    account = mt5.account_info()
    print(
      json.dumps(
        {
          "symbol": symbol,
          "broker": account.company if account else "MT5",
          "bid": float(tick.bid) if tick else candles[-1]["close"],
          "ask": float(tick.ask) if tick else None,
          "candles": candles,
          "m5_candles": m5_candles,
          "h1_candles": h1_candles,
        }
      )
    )
  finally:
    mt5.shutdown()


if __name__ == "__main__":
  main()
