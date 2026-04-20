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
    const min = 1.2;
    const max = 10;
    const v = min + randomFloat01() * (max - min);
    return Math.max(min, Math.min(max, Math.round(v * 100) / 100));
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
        background: rgba(255,255,255,0.04);
        border-radius: 16px;
        min-height: 260px;
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .crash-mult {
        font-size: clamp(44px, 7vw, 78px);
        font-weight: 1100;
        letter-spacing: -0.6px;
        color: #33d18f;
        text-shadow: 0 0 18px rgba(51, 209, 143, 0.22);
        transform: scale(1);
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

  function ensureModal() {
    injectStylesOnce();
    if (document.getElementById("crash-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "crash-overlay";
    overlay.className = "crash-overlay";
    overlay.innerHTML = `
      <div class="crash-modal" role="dialog" aria-modal="true" aria-label="Crash game">
        <div class="crash-head">
          <div class="crash-title">Crash</div>
          <button class="crash-close" id="crash-close" type="button" aria-label="Close">X</button>
        </div>
        <div class="crash-body">
          <div class="crash-toprow">
            <div class="crash-pill">Balance: <span id="crash-balance">1000</span></div>
            <div class="crash-pill">Status: <span id="crash-status">Waiting</span></div>
          </div>
          <div class="crash-grid">
            <div class="crash-stage">
              <div class="crash-mult" id="crash-mult">1.00x</div>
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
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      // Click outside closes.
      if (e.target === overlay) close();
    });
    document.getElementById("crash-close")?.addEventListener("click", close);
    document.getElementById("crash-start")?.addEventListener("click", onStart);
    document.getElementById("crash-cashout")?.addEventListener("click", onCashout);
    document.addEventListener("keydown", (e) => {
      if (state.open && e.key === "Escape") close();
    });
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

    const mult = state.phase === "waiting" ? 1 : state.multiplier;
    state.multiplier = Math.max(1, mult);

    const win = Math.floor(state.bet * state.multiplier);
    setBalance(getBalance() + win);
    endRound("cashed", `Cashed out at ${fmt2(state.multiplier)}x`);
  }

  function open() {
    ensureModal();
    loadPersisted();
    renderHistory();
    setBalance(getBalance());
    setStatus(state.status);
    setMultiplier(1, null);
    setNote("");
    const apiReady = window.casinoBalance && typeof window.casinoBalance.get === "function" && typeof window.casinoBalance.set === "function";
    if (!apiReady) setNote("Balance system is not ready yet. Please refresh.");
    setControls({ startDisabled: !apiReady, cashoutDisabled: true, betDisabled: !apiReady });

    const overlay = qs("crash-overlay");
    if (overlay) overlay.classList.add("crash-open");
    state.open = true;
  }

  function close() {
    const overlay = qs("crash-overlay");
    if (overlay) overlay.classList.remove("crash-open");
    state.open = false;
  }

  function init() {
    const btn = document.getElementById("tab_crash");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
