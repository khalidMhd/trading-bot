(function () {
  function num(id) {
    const v = parseFloat(document.getElementById(id).value);
    return Number.isFinite(v) ? v : NaN;
  }

  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function show(id, html, ok) {
    const el = document.getElementById(id);
    el.hidden = false;
    el.className = 'tool-result ' + (ok ? 'tool-result-ok' : 'tool-result-bad');
    el.innerHTML = html;
  }

  // ---- Position size calculator ----
  const psBtn = document.getElementById('ps-calc');
  if (psBtn) {
    psBtn.addEventListener('click', function () {
      const balance = num('ps-balance');
      const risk = num('ps-risk');
      const entry = num('ps-entry');
      const stop = num('ps-stop');
      const contract = num('ps-contract');

      if ([balance, risk, entry, stop, contract].some(Number.isNaN) || contract <= 0) {
        return show('ps-result', 'Please fill every field with valid numbers.', false);
      }
      const stopDistance = Math.abs(entry - stop);
      if (stopDistance <= 0) {
        return show('ps-result', 'Entry and stop loss cannot be the same price.', false);
      }
      const riskAmount = balance * (risk / 100);
      const riskPerLot = stopDistance * contract;
      const lots = riskAmount / riskPerLot;

      show('ps-result',
        '<strong>Recommended position size: ' + lots.toFixed(2) + ' lots</strong>' +
        '<span>Risk amount: ' + money(riskAmount) + ' (' + risk + '% of ' + money(balance) + ')</span>' +
        '<span>Stop distance: $' + stopDistance.toFixed(2) + ' per ounce</span>' +
        '<span>If the stop is hit, you lose about ' + money(lots * riskPerLot) + '.</span>',
        true);
    });
  }

  // ---- Profit / loss calculator ----
  const plBtn = document.getElementById('pl-calc');
  if (plBtn) {
    plBtn.addEventListener('click', function () {
      const dir = document.getElementById('pl-dir').value;
      const lots = num('pl-lots');
      const entry = num('pl-entry');
      const exit = num('pl-exit');
      const contract = num('pl-contract');

      if ([lots, entry, exit, contract].some(Number.isNaN)) {
        return show('pl-result', 'Please fill every field with valid numbers.', false);
      }
      let move = exit - entry;
      if (dir === 'sell') move = -move;
      const pl = move * contract * lots;
      const ok = pl >= 0;
      const label = ok ? 'Profit' : 'Loss';

      show('pl-result',
        '<strong>' + label + ': ' + money(pl) + '</strong>' +
        '<span>Direction: ' + (dir === 'buy' ? 'Buy (Long)' : 'Sell (Short)') + '</span>' +
        '<span>Price move: ' + (exit - entry >= 0 ? '+' : '') + (exit - entry).toFixed(2) + ' per ounce</span>' +
        '<span>Position: ' + lots + ' lots × ' + contract + ' oz</span>',
        ok);
    });
  }

  // ---- Risk / reward calculator ----
  const rrBtn = document.getElementById('rr-calc');
  if (rrBtn) {
    rrBtn.addEventListener('click', function () {
      const dir = document.getElementById('rr-dir').value;
      const entry = num('rr-entry');
      const stop = num('rr-stop');
      const tp = num('rr-tp');

      if ([entry, stop, tp].some(Number.isNaN)) {
        return show('rr-result', 'Please fill every field with valid numbers.', false);
      }
      const riskDist = Math.abs(entry - stop);
      const rewardDist = Math.abs(tp - entry);
      if (riskDist <= 0) {
        return show('rr-result', 'Entry and stop loss cannot be the same price.', false);
      }

      // Sanity: check stop/tp are on correct sides
      let logicWarning = '';
      if (dir === 'buy' && (stop >= entry || tp <= entry)) {
        logicWarning = 'For a Buy, stop should be below entry and take profit above entry.';
      }
      if (dir === 'sell' && (stop <= entry || tp >= entry)) {
        logicWarning = 'For a Sell, stop should be above entry and take profit below entry.';
      }

      const ratio = rewardDist / riskDist;
      const good = ratio >= 1.5;
      let verdict;
      if (ratio >= 2) verdict = 'Excellent — reward is at least double your risk.';
      else if (ratio >= 1.5) verdict = 'Good — a solid risk-to-reward setup.';
      else if (ratio >= 1) verdict = 'Marginal — reward barely covers risk. Be selective.';
      else verdict = 'Poor — you are risking more than you stand to gain. Consider skipping.';

      show('rr-result',
        '<strong>Risk-to-reward: 1 : ' + ratio.toFixed(2) + '</strong>' +
        '<span>Risk: $' + riskDist.toFixed(2) + ' · Reward: $' + rewardDist.toFixed(2) + ' per ounce</span>' +
        '<span>' + verdict + '</span>' +
        (logicWarning ? '<span style="color:var(--sell)">⚠ ' + logicWarning + '</span>' : ''),
        good);
    });
  }

  // ---- Live market session clock (UTC-based) ----
  // Approximate session windows in UTC hours
  var SESSIONS = {
    sydney: { open: 21, close: 6 },   // 21:00–06:00 UTC (wraps midnight)
    tokyo: { open: 0, close: 9 },
    london: { open: 7, close: 16 },
    newyork: { open: 12, close: 21 },
  };

  function isOpen(s, utcHour) {
    if (s.open < s.close) return utcHour >= s.open && utcHour < s.close;
    return utcHour >= s.open || utcHour < s.close; // wraps midnight
  }

  function updateClock() {
    var clock = document.getElementById('session-clock');
    if (!clock) return;
    var now = new Date();
    var utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    var openCount = 0;
    var openNames = [];

    clock.querySelectorAll('.session-box').forEach(function (box) {
      var key = box.getAttribute('data-session');
      var open = isOpen(SESSIONS[key], utcHour);
      box.classList.toggle('session-open', open);
      box.classList.toggle('session-closed', !open);
      box.querySelector('.session-state').textContent = open ? 'OPEN' : 'Closed';
      if (open) { openCount++; openNames.push(box.querySelector('.session-name').textContent); }
    });

    var tip = document.getElementById('session-tip');
    if (tip) {
      var londonOpen = isOpen(SESSIONS.london, utcHour);
      var nyOpen = isOpen(SESSIONS.newyork, utcHour);
      if (londonOpen && nyOpen) {
        tip.innerHTML = '🔥 <strong>London–New York overlap is live</strong> — the highest-liquidity window for gold. Best time for M15 setups.';
      } else if (londonOpen) {
        tip.innerHTML = '📈 London session is active — watch for breakouts from the Asian range.';
      } else if (nyOpen) {
        tip.innerHTML = '🇺🇸 New York session is active — mind US data releases (CPI, NFP, FOMC).';
      } else if (openCount > 0) {
        tip.innerHTML = 'Quieter hours (' + openNames.join(', ') + '). Fewer high-probability signals — consider waiting for London.';
      } else {
        tip.textContent = 'Markets are between major sessions. Liquidity is low right now.';
      }
      tip.innerHTML += ' <a href="/news/best-times-trade-gold">Learn the best times to trade →</a>';
    }
  }

  updateClock();
  setInterval(updateClock, 30000);
})();
