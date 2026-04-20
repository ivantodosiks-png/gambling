// Crash mini-game (modal) - vanilla JS, isolated styles (crash- prefix).
(function () {
  const LS_HIST = "crash_history_v1";

  const state = {
    open: false,
    bet: 0,
    status: "Waiting", // Waiting | Running | Crashed | Cashed out
    multiplier: 1,
    crashPoint: null,
    phase: "idle", // idle | waiting | running | ended
    startedAt: 0,
    waitTimer: 0,
    tickTimer: 0,
    history: [],
    chartLen: 0,
  };

  function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  function fmt2(x) {
    const n = Number(x) || 0;
    return n.toFixed(2);
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(LS_HIST);
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) state.history = list.slice(0, 5).map((x) => clamp(x, 1.2, 10));
    } catch {}
  }

  function persist() {
    try {
      localStorage.setItem(LS_HIST, JSON.stringify(state.history.slice(0, 5)));
    } catch {}
  }

  function randomFloat01() {
    const c = (typeof crypto !== "undefined" && crypto.getRandomValues) ? crypto : null;
    if (!c) return Math.random();
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 0xffffffff;
  }

  function genCrashPoint() {
    // Heavily weighted towards low multipliers (so it can crash very early),
    // with rare high multipliers up to max.
    const min = 1.05;
    const max = 10;
    const alpha = 3.2; // higher => more low multipliers

    const u = randomFloat01(); // [0,1)
    const x = min * Math.pow(1 - u, -1 / alpha); // Pareto-like
    const capped = Math.min(max, Math.max(min, x));
    return Math.round(capped * 100) / 100;
  }

  function injectStylesOnce() {
    if (document.getElementById("crash-styles")) return;
    const s = document.createElement("style");
    s.id = "crash-styles";
    s.textContent = `
      .crash-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        place-items: center;
        padding: 18px;
        background: rgba(0,0,0,0.62);
        backdrop-filter: blur(6px);
      }
      .crash-overlay.crash-open { display: grid; }
      .crash-modal {
        width: min(820px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.14);
        background:
          radial-gradient(1100px 680px at 15% 0%, rgba(51, 209, 143, 0.14), transparent 55%),
          radial-gradient(900px 540px at 90% 20%, rgba(125, 211, 252, 0.12), transparent 55%),
          rgba(11, 16, 32, 0.96);
        color: #e9edf7;
        box-shadow: 0 28px 90px rgba(0,0,0,0.62);
        overflow: hidden;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      .crash-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.10);
      }
      .crash-title { font-weight: 1000; letter-spacing: 0.2px; }
      .crash-close {
        cursor: pointer;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: #e9edf7;
        font-weight: 1000;
      }
      .crash-body { padding: 16px; display: grid; gap: 14px; }
      .crash-toprow { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
      .crash-pill {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        padding: 8px 10px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 800;
      }
      .crash-grid { display: grid; grid-template-columns: 1fr 320px; gap: 14px; }
      @media (max-width: 820px) { .crash-grid { grid-template-columns: 1fr; } }
      .crash-stage {
        border: 1px solid rgba(255,255,255,0.10);
        background:
          linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 44px 44px,
          linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 44px 44px,
          rgba(255,255,255,0.04);
        border-radius: 16px;
        min-height: 260px;
        display: grid;
        place-items: center;
        padding: 16px;
        position: relative;
        overflow: hidden;
      }
      .crash-stage::after{
        content:"";
        position:absolute;
        inset:-40px;
        background: radial-gradient(700px 260px at 30% 20%, rgba(51,209,143,0.16), transparent 60%);
        opacity: 0.9;
        pointer-events:none;
      }
      .crash-stage.crash-stage-running::after{
        animation: crashGlow 1.4s ease-in-out infinite;
      }
      @keyframes crashGlow{ 0%{opacity:0.55} 50%{opacity:0.95} 100%{opacity:0.55} }

      .crash-chart {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.95;
        color: rgba(51,209,143,0.95);
      }
      .crash-chart svg { width: 100%; height: 100%; display:block; }
      .crash-chart .crash-path {
        stroke: rgba(51,209,143,0.95);
        stroke-width: 4;
        fill: none;
        filter: drop-shadow(0 0 14px rgba(51,209,143,0.25));
      }
      .crash-chart .crash-dot {
        fill: rgba(51,209,143,0.95);
        filter: drop-shadow(0 0 12px rgba(51,209,143,0.20));
      }
      .crash-stage.crash-stage-crashed .crash-path { stroke: rgba(255,107,107,0.95); filter: drop-shadow(0 0 14px rgba(255,107,107,0.22)); }
      .crash-stage.crash-stage-crashed .crash-dot { fill: rgba(255,107,107,0.95); }
      .crash-stage.crash-stage-crashed .crash-chart { color: rgba(255,107,107,0.95); }
      .crash-stage.crash-stage-cashed .crash-path { stroke: rgba(125,211,252,0.95); filter: drop-shadow(0 0 14px rgba(125,211,252,0.22)); }
      .crash-stage.crash-stage-cashed .crash-dot { fill: rgba(125,211,252,0.95); }
      .crash-stage.crash-stage-cashed .crash-chart { color: rgba(125,211,252,0.95); }

      .crash-hud {
        position:absolute;
        left: 14px;
        right: 14px;
        bottom: 12px;
        display:flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 10px;
        pointer-events:none;
        z-index: 2;
      }
      .crash-hud-card{
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.18);
        border-radius: 14px;
        padding: 10px 12px;
        backdrop-filter: blur(10px);
      }
      .crash-hud .crash-hud-label{ font-size: 12px; color: rgba(233,237,247,0.72); font-weight: 900; }
      .crash-hud .crash-hud-value{ margin-top: 4px; font-size: 16px; font-weight: 1100; letter-spacing: -0.2px; }
      .crash-hud .crash-hud-sub{ margin-top: 2px; font-size: 12px; color: rgba(233,237,247,0.72); font-weight: 800; }
      .crash-mult {
        font-size: clamp(44px, 7vw, 78px);
        font-weight: 1100;
        letter-spacing: -0.6px;
        color: #33d18f;
        text-shadow: 0 0 18px rgba(51, 209, 143, 0.22);
        transform: scale(1);
        position: relative;
        z-index: 2;
      }
      .crash-mult.crash-running { animation: crashPulse 0.6s ease-in-out infinite; }
      .crash-mult.crash-crashed { color: #ff6b6b; text-shadow: 0 0 18px rgba(255, 107, 107, 0.20); animation: none; }
      .crash-mult.crash-cashed { color: #7dd3fc; text-shadow: 0 0 18px rgba(125, 211, 252, 0.20); animation: none; }
      @keyframes crashPulse { 0% { transform: scale(1); } 50% { transform: scale(1.03); } 100% { transform: scale(1); } }
      .crash-side {
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        border-radius: 16px;
        padding: 14px;
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .crash-row { display: grid; gap: 6px; }
      .crash-label { font-size: 12px; color: rgba(233,237,247,0.72); font-weight: 800; }
      .crash-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.04);
        color: #e9edf7;
        outline: none;
        font-weight: 800;
      }
      .crash-input:focus { border-color: rgba(125, 211, 252, 0.55); box-shadow: 0 0 0 3px rgba(125, 211, 252, 0.14); }
      .crash-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .crash-btn {
        cursor: pointer;
        border: 0;
        padding: 12px 12px;
        border-radius: 12px;
        font-weight: 1000;
        background: #33d18f;
        color: #07110c;
      }
      .crash-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      .crash-btn.crash-secondary {
        background: rgba(255,255,255,0.06);
        color: #e9edf7;
        border: 1px solid rgba(255,255,255,0.14);
      }
      .crash-status {
        font-size: 13px;
        color: rgba(233,237,247,0.78);
        font-weight: 900;
        min-height: 18px;
      }
      .crash-hist {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .crash-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        font-size: 12px;
        font-weight: 1000;
        letter-spacing: 0.2px;
      }
    `;
    document.head.appendChild(s);
  }

  function ensureView() {
    injectStylesOnce();
    const host = document.getElementById("crashMount");
    if (!host) return false;
    if (host.getAttribute("data-crash-ready") === "1") return true;

    host.setAttribute("data-crash-ready", "1");
    host.innerHTML = `
      <div class="crash-body" style="padding: 0;">
        <div class="crash-toprow">
          <div class="crash-title">Crash</div>
          <div class="crash-pill">Balance: <span id="crash-balance">0</span></div>
          <div class="crash-pill">Status: <span id="crash-status">Waiting</span></div>
        </div>
        <div class="crash-grid" style="margin-top: 12px;">
          <div class="crash-stage" id="crash-stage">
            <div class="crash-chart" aria-hidden="true">
              <svg viewBox="0 0 520 300" preserveAspectRatio="none">
                <defs>
                  <marker id="crash-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path>
                  </marker>
                </defs>
                <path id="crash-path" class="crash-path" d="M 26 248 C 120 212 188 172 260 132 C 330 92 400 62 494 40" marker-end="url(#crash-arrow)"></path>
                <circle id="crash-dot" class="crash-dot" cx="26" cy="248" r="6"></circle>
              </svg>
            </div>
            <div class="crash-mult" id="crash-mult">1.00x</div>
            <div class="crash-hud" aria-hidden="true">
              <div class="crash-hud-card">
                <div class="crash-hud-label">Potential cashout</div>
                <div class="crash-hud-value" id="crash-payout">—</div>
                <div class="crash-hud-sub" id="crash-payout-sub">—</div>
              </div>
              <div class="crash-hud-card" style="text-align:right;">
                <div class="crash-hud-label">Bet</div>
                <div class="crash-hud-value" id="crash-bet-view">0</div>
                <div class="crash-hud-sub">Coins</div>
              </div>
            </div>
          </div>
          <div class="crash-side">
            <div class="crash-row">
              <div class="crash-label">Bet</div>
              <input class="crash-input" id="crash-bet" type="number" min="1" step="1" value="50" />
            </div>
            <div class="crash-actions">
              <button class="crash-btn" id="crash-start" type="button">Start Round</button>
              <button class="crash-btn crash-secondary" id="crash-cashout" type="button" disabled>Cashout</button>
            </div>
            <div class="crash-status" id="crash-note"></div>
            <div class="crash-row" style="margin-top:4px;">
              <div class="crash-label">History (last 5)</div>
              <div class="crash-hist" id="crash-hist"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("crash-start")?.addEventListener("click", onStart);
    document.getElementById("crash-cashout")?.addEventListener("click", onCashout);

    // Prevent mouse wheel from changing number input.
    const betInput = document.getElementById("crash-bet");
    betInput?.addEventListener(
      "wheel",
      (e) => {
        if (document.activeElement === betInput) e.preventDefault();
      },
      { passive: false },
    );

    // When switching to Crash tab, refresh UI from global balance.
    document.getElementById("tab_crashView")?.addEventListener("click", () => {
      setBalance(getBalance());
      updatePayoutUI();
    });

    return true;
  }

  function qs(id) {
    return document.getElementById(id);
  }

  function setStatus(next) {
    state.status = next;
    const el = qs("crash-status");
    if (el) el.textContent = next;
  }

  function setNote(text) {
    const el = qs("crash-note");
    if (el) el.textContent = text || "";
  }

  function setBalance(next) {
    const api = window.casinoBalance;
    if (api && typeof api.set === "function") api.set(next);
    const el = qs("crash-balance");
    if (el) el.textContent = String(getBalance());
  }

  function getBalance() {
    const api = window.casinoBalance;
    if (api && typeof api.get === "function") return Math.max(0, Math.floor(Number(api.get()) || 0));
    const dom = Number(qs("balanceValue")?.textContent || 0);
    return Math.max(0, Math.floor(dom || 0));
  }

  function setMultiplier(mult, mode) {
    state.multiplier = Number(mult) || 1;
    const el = qs("crash-mult");
    if (!el) return;
    el.textContent = `${fmt2(state.multiplier)}x`;
    el.classList.remove("crash-running", "crash-crashed", "crash-cashed");
    if (mode === "running") el.classList.add("crash-running");
    if (mode === "crashed") el.classList.add("crash-crashed");
    if (mode === "cashed") el.classList.add("crash-cashed");

    const stage = qs("crash-stage");
    if (stage) {
      stage.classList.remove("crash-stage-running", "crash-stage-crashed", "crash-stage-cashed");
      if (mode === "running") stage.classList.add("crash-stage-running");
      if (mode === "crashed") stage.classList.add("crash-stage-crashed");
      if (mode === "cashed") stage.classList.add("crash-stage-cashed");
    }

    updatePayoutUI();
    updateChartUI();
  }

  function updatePayoutUI() {
    const payoutEl = qs("crash-payout");
    const payoutSubEl = qs("crash-payout-sub");
    const betViewEl = qs("crash-bet-view");
    if (betViewEl) betViewEl.textContent = String(Math.floor(state.bet || 0));

    const bet = Math.floor(state.bet || 0);
    if (!bet || state.phase === "idle") {
      if (payoutEl) payoutEl.textContent = "—";
      if (payoutSubEl) payoutSubEl.textContent = "—";
      return;
    }

    const mult = state.phase === "waiting" ? 1 : (Number(state.multiplier) || 1);
    const win = Math.floor(bet * Math.max(1, mult));
    if (payoutEl) payoutEl.textContent = String(win);
    if (payoutSubEl) payoutSubEl.textContent = `${win} @ ${fmt2(Math.max(1, mult))}x`;
  }

  function ensureChartMetrics() {
    if (state.chartLen) return;
    const path = qs("crash-path");
    if (!path || typeof path.getTotalLength !== "function") return;
    state.chartLen = Math.max(1, Math.floor(path.getTotalLength()));
    path.style.strokeDasharray = String(state.chartLen);
    path.style.strokeDashoffset = String(state.chartLen);
  }

  function updateChartUI() {
    ensureChartMetrics();
    if (!state.chartLen) return;

    const path = qs("crash-path");
    const dot = qs("crash-dot");
    if (!path || !dot) return;

    const m = Math.max(1, Number(state.multiplier) || 1);

    // progress does NOT use the crash point (so the user can't "see" when it will crash).
    let progress = 0;
    if (state.phase === "waiting") progress = 0.06;
    else if (state.phase === "running") progress = Math.log(m) / Math.log(10);
    else if (state.phase === "ended") progress = Math.log(Math.max(1, state.multiplier)) / Math.log(10);

    progress = clamp(progress, 0, 1);
    const len = state.chartLen * progress;
    path.style.strokeDashoffset = String(state.chartLen - len);

    try {
      const p = path.getPointAtLength(Math.max(0, Math.min(state.chartLen, len)));
      dot.setAttribute("cx", String(p.x));
      dot.setAttribute("cy", String(p.y));
    } catch {
      // ignore
    }
  }

  function renderHistory() {
    const host = qs("crash-hist");
    if (!host) return;
    host.innerHTML = "";
    for (const v of state.history.slice(0, 5)) {
      const chip = document.createElement("div");
      chip.className = "crash-chip";
      chip.textContent = `${fmt2(v)}x`;
      host.appendChild(chip);
    }
  }

  function setControls({ startDisabled, cashoutDisabled, betDisabled }) {
    const startBtn = qs("crash-start");
    const cashBtn = qs("crash-cashout");
    const betInp = qs("crash-bet");
    if (startBtn) startBtn.disabled = !!startDisabled;
    if (cashBtn) cashBtn.disabled = !!cashoutDisabled;
    if (betInp) betInp.disabled = !!betDisabled;
  }

  function stopTimers() {
    clearTimeout(state.waitTimer);
    state.waitTimer = 0;
    clearInterval(state.tickTimer);
    state.tickTimer = 0;
  }

  function endRound(kind, note) {
    stopTimers();
    state.phase = "ended";

    if (kind === "crashed") {
      setStatus("Crashed");
      setMultiplier(state.crashPoint ?? state.multiplier, "crashed");
      setNote(note || "CRASH");
    } else if (kind === "cashed") {
      setStatus("Cashed out");
      setMultiplier(state.multiplier, "cashed");
      setNote(note || "");
    } else {
      setStatus("Waiting");
      setMultiplier(1, null);
      setNote("");
    }

    setControls({ startDisabled: false, cashoutDisabled: true, betDisabled: false });

    if (typeof state.crashPoint === "number") {
      state.history = [state.crashPoint, ...state.history].slice(0, 5);
      renderHistory();
      persist();
    }
  }

  function onStart() {
    if (state.phase === "waiting" || state.phase === "running") return;
    if (!ensureView()) return;

    const bet = Math.floor(Number(qs("crash-bet")?.value || 0));
    if (!Number.isFinite(bet) || bet <= 0) return setNote("Enter a valid bet amount");
    if (bet > getBalance()) return setNote("Insufficient balance");

    state.bet = bet;
    state.crashPoint = genCrashPoint();
    state.multiplier = 1;
    state.phase = "waiting";
    setStatus("Waiting");
    setMultiplier(1, null);
    setNote("Round starting...");

    setBalance(getBalance() - bet);
    setControls({ startDisabled: true, cashoutDisabled: false, betDisabled: true });

    state.waitTimer = setTimeout(() => {
      state.phase = "running";
      setStatus("Running");
      setNote("");
      state.startedAt = Date.now();

      const growthK = 0.09; // exponential growth factor per second
      state.tickTimer = setInterval(() => {
        const elapsedSec = (Date.now() - state.startedAt) / 1000;
        const mult = Math.exp(elapsedSec * growthK);
        state.multiplier = Math.max(1, mult);
        setMultiplier(state.multiplier, "running");

        if (state.multiplier >= state.crashPoint) {
          // Crash: lose bet (already deducted).
          state.multiplier = state.crashPoint;
          endRound("crashed", "CRASH");
        }
      }, 100);
    }, 1000);
  }

  function onCashout() {
    if (state.phase !== "waiting" && state.phase !== "running") return;
    if (!ensureView()) return;

    const mult = state.phase === "waiting" ? 1 : state.multiplier;
    state.multiplier = Math.max(1, mult);

    const win = Math.floor(state.bet * state.multiplier);
    setBalance(getBalance() + win);
    endRound("cashed", `Cashed out at ${fmt2(state.multiplier)}x`);
  }

  function init() {
    if (!ensureView()) return;
    loadPersisted();
    renderHistory();

    state.bet = 0;
    state.crashPoint = null;
    state.phase = "idle";
    state.status = "Waiting";

    setBalance(getBalance());
    setStatus("Waiting");
    setMultiplier(1, null);
    setNote("");
    const apiReady = window.casinoBalance && typeof window.casinoBalance.get === "function" && typeof window.casinoBalance.set === "function";
    if (!apiReady) setNote("Balance system is not ready yet. Please refresh.");
    setControls({ startDisabled: !apiReady, cashoutDisabled: true, betDisabled: !apiReady });
    updatePayoutUI();
    updateChartUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
