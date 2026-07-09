require('dotenv').config();
const { runBacktest } = require('../services/backtest');

(async () => {
  try {
    console.log('Running backtest on MT5 historical XAUUSD data...\n');
    const result = await runBacktest(2000);
    console.log('=== Backtest Results ===');
    console.log(`Symbol:       ${result.symbol}`);
    console.log(`Period:       ${result.period}`);
    console.log(`Signals:      ${result.totalSignals}`);
    console.log(`Wins:         ${result.wins}`);
    console.log(`Losses:       ${result.losses}`);
    console.log(`Win Rate:     ${result.winRate}%`);
    console.log(`Total PnL:    ${result.totalPnl} pts`);
    console.log(`Avg PnL:      ${result.avgPnl} pts/trade`);
    console.log(`Profit Factor:${result.profitFactor}`);
    console.log('\nLast 5 trades:');
    result.recentTrades.slice(0, 5).forEach((t) => {
      console.log(`  ${t.signal} @ ${t.entry} → ${t.outcome.toUpperCase()} (${t.pnl > 0 ? '+' : ''}${t.pnl})`);
    });
  } catch (err) {
    console.error('Backtest failed:', err.message);
    console.error('For MT5: open terminal and log in. Otherwise Yahoo history is used.');
    process.exit(1);
  }
})();
