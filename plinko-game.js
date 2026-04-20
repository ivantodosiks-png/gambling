// Plinko add-on (Vanilla JS + Canvas). Self-contained: injects navbar button + modal + physics.
// Does not touch existing layouts/styles outside injected elements.
(function () {
  const CSS = `
  .plinko-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .plinko-overlay.plinko-open{display:flex}
  .plinko-modal{width:min(1320px,96vw);height:min(860px,92vh);background:radial-gradient(1200px 500px at 25% 15%, rgba(168,85,255,.18), rgba(0,0,0,0) 60%),linear-gradient(180deg,#05010b,#030008);border:1px solid rgba(168,85,255,.28);box-shadow:0 30px 120px rgba(0,0,0,.65),0 0 0 1px rgba(0,234,255,.10) inset,0 0 40px rgba(168,85,255,.15);border-radius:18px;overflow:hidden;display:grid;grid-template-columns:1.35fr .65fr}
  .plinko-top{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(168,85,255,.18);background:rgba(0,0,0,.28)}
  .plinko-title{font:700 14px/1.1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.92)}
  .plinko-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(168,85,255,.22);box-shadow:0 0 0 1px rgba(0,234,255,.10) inset}
  .plinko-pill span{font:600 13px/1 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.9)}
  .plinko-pill b{font:800 13px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#00ff88;text-shadow:0 0 18px rgba(0,255,136,.25)}
  .plinko-close{width:40px;height:40px;border-radius:12px;border:1px solid rgba(168,85,255,.22);background:rgba(255,255,255,.06);color:rgba(255,255,255,.9);font:800 16px/1 system-ui;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
  .plinko-close:hover{transform:scale(1.03);border-color:rgba(0,234,255,.35);box-shadow:0 0 22px rgba(168,85,255,.18)}
  .plinko-left{padding:14px 14px 16px 14px;display:flex;flex-direction:column;gap:12px}
  .plinko-boardWrap{flex:1;min-height:0;border-radius:16px;background:linear-gradient(180deg,rgba(0,234,255,.05),rgba(168,85,255,.05));border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(0,0,0,.65) inset,0 18px 50px rgba(0,0,0,.45);position:relative;overflow:hidden}
  .plinko-boardWrap:before{content:"";position:absolute;inset:-2px;background:radial-gradient(900px 420px at 50% 12%, rgba(0,234,255,.10), rgba(0,0,0,0) 60%);pointer-events:none}
  .plinko-canvas{width:100%;height:100%;display:block}
  .plinko-resultToast{position:absolute;left:16px;top:16px;z-index:2;display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.40);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;opacity:0;transform:translateY(-6px);transition:opacity .18s ease,transform .18s ease}
  .plinko-resultToast.plinko-show{opacity:1;transform:translateY(0)}
  .plinko-resultToast .plinko-big{font:900 18px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.02em;color:rgba(255,255,255,.95)}
  .plinko-resultToast .plinko-sub{font:600 12px/1.2 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.70)}
  .plinko-right{padding:14px 14px 16px 0;display:flex;flex-direction:column;gap:12px}
  .plinko-panel{height:100%;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(0,0,0,.65) inset,0 18px 50px rgba(0,0,0,.45);padding:14px;display:flex;flex-direction:column;gap:12px}
  .plinko-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .plinko-label{font:700 12px/1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.72)}
  .plinko-status{font:800 12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.85);padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.30);border:1px solid rgba(168,85,255,.18)}
  .plinko-status.plinko-running{color:#00eaff;border-color:rgba(0,234,255,.30);box-shadow:0 0 18px rgba(0,234,255,.12)}
  .plinko-status.plinko-done{color:#00ff88;border-color:rgba(0,255,136,.28);box-shadow:0 0 18px rgba(0,255,136,.10)}
  .plinko-status.plinko-lost{color:#ff3b3b;border-color:rgba(255,59,59,.28);box-shadow:0 0 18px rgba(255,59,59,.10)}
  .plinko-input{width:100%;height:44px;border-radius:14px;padding:0 14px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.10);outline:none;color:rgba(255,255,255,.92);font:800 14px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
  .plinko-input:focus{border-color:rgba(0,234,255,.35);box-shadow:0 0 0 3px rgba(0,234,255,.12)}
  .plinko-btnRow{display:flex;gap:10px}
  .plinko-btn{flex:1;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);font:900 14px/1 system-ui,Segoe UI,Roboto,Arial;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease,opacity .12s ease}
  .plinko-btn:hover{transform:translateY(-1px);border-color:rgba(0,234,255,.28);box-shadow:0 0 20px rgba(168,85,255,.12)}
  .plinko-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
  .plinko-btn.plinko-primary{background:linear-gradient(180deg,rgba(168,85,255,.95),rgba(124,58,237,.85));border-color:rgba(168,85,255,.60);color:#090012;box-shadow:0 10px 26px rgba(168,85,255,.22)}
  .plinko-btn.plinko-primary:hover{box-shadow:0 10px 30px rgba(168,85,255,.28),0 0 24px rgba(0,234,255,.12)}
  .plinko-small{font:650 12px/1.35 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.70)}
  .plinko-history{display:flex;flex-wrap:wrap;gap:8px}
  .plinko-chip{padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.10);font:900 12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.90)}
  .plinko-chip b{color:#00ff88}
  .plinko-chip i{font-style:normal;color:rgba(255,255,255,.68)}
  @media (max-width: 980px){
    .plinko-modal{grid-template-columns:1fr;height:min(930px,92vh)}
    .plinko-right{padding:0 14px 14px 14px}
    .plinko-panel{min-height:280px}
  }`;

  function injectStyleOnce() {
    if (document.getElementById("plinko-style")) return;
    const style = document.createElement("style");
    style.id = "plinko-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function fmt(n) {
    const x = Number(n) || 0;
    return x.toLocaleString("en-US");
  }

  function getUserIdText() {
    const el = document.getElementById("userIdValue");
    const t = (el?.textContent || "").trim();
    return t && t.length >= 10 ? t : "";
  }

  function getBalanceApi() {
    if (window.casinoBalance && typeof window.casinoBalance.get === "function" && typeof window.casinoBalance.set === "function") {
      return window.casinoBalance;
    }
    const uid = getUserIdText() || "unknown";
    const key = `casino_balance_v1:${uid}`;
    return {
      get: () => {
        try {
          const n = Number(localStorage.getItem(key));
          return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5000;
        } catch {
          return 5000;
        }
      },
      set: (next) => {
        const n = Math.max(0, Math.floor(Number(next) || 0));
        try {
          localStorage.setItem(key, String(n));
        } catch {}
      },
    };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function makeMultipliers(slotsCount) {
    // Center-heavy, edges low. Classic casino-style labels.
    // For 11 slots: 0.2 0.5 1 2 3 5 20 5 3 2 1
    const base = [0.2, 0.5, 1, 2, 3, 5, 20, 5, 3, 2, 1, 0.5, 0.2];
    if (slotsCount === 11) return [0.2, 0.5, 1, 2, 3, 5, 20, 5, 3, 2, 1];
    if (slotsCount === 9) return [0.2, 0.5, 1, 2, 10, 2, 1, 0.5, 0.2];
    // Fallback: take center slice of base.
    const start = Math.max(0, Math.floor((base.length - slotsCount) / 2));
    return base.slice(start, start + slotsCount);
  }

  function createNavbarButton(openFn) {
    const tabs = document.querySelector(".tabs");
    if (!tabs) return;
    if (document.getElementById("tab_plinkoModal")) return;

    const btn = document.createElement("button");
    btn.id = "tab_plinkoModal";
    btn.className = "tab";
    btn.type = "button";
    btn.textContent = "Plinko";
    btn.addEventListener("click", () => openFn());
    tabs.appendChild(btn);
  }

  function createModal() {
    injectStyleOnce();

    const overlay = document.createElement("div");
    overlay.className = "plinko-overlay";
    overlay.id = "plinko-overlay";
    overlay.innerHTML = `
      <div class="plinko-modal" role="dialog" aria-modal="true" aria-label="Plinko">
        <div class="plinko-top">
          <div class="plinko-title">Plinko</div>
          <div class="plinko-pill"><span>Balance</span><b id="plinkoBalance">0</b></div>
          <button class="plinko-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="plinko-left">
          <div class="plinko-boardWrap">
            <div id="plinkoToast" class="plinko-resultToast">
              <div class="plinko-big" id="plinkoToastBig">Ready</div>
              <div class="plinko-sub" id="plinkoToastSub">Drop a ball to play.</div>
            </div>
            <canvas id="plinkoCanvas" class="plinko-canvas"></canvas>
          </div>
        </div>
        <div class="plinko-right">
          <div class="plinko-panel">
            <div class="plinko-row">
              <div class="plinko-label">Status</div>
              <div id="plinkoStatus" class="plinko-status">Waiting</div>
            </div>
            <div>
              <div class="plinko-label" style="margin-bottom:8px">Bet</div>
              <input id="plinkoBet" class="plinko-input" type="number" inputmode="numeric" min="1" step="1" value="50" />
              <div class="plinko-small" id="plinkoHint" style="margin-top:8px"></div>
            </div>
            <div class="plinko-btnRow">
              <button id="plinkoDropBtn" class="plinko-btn plinko-primary" type="button">Drop Ball</button>
              <button id="plinkoCloseBtn" class="plinko-btn" type="button">Close</button>
            </div>
            <div>
              <div class="plinko-label" style="margin-bottom:8px">Last 5 results</div>
              <div id="plinkoHistory" class="plinko-history"></div>
            </div>
            <div class="plinko-small">
              Physics: gravity + peg collisions + randomness + damping.
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function plinkoApp() {
    const balanceApi = getBalanceApi();
    const uid = getUserIdText() || "unknown";
    const HISTORY_KEY = `plinko_history_v1:${uid}`;

    let overlay = null;
    let prevOverflow = "";
    let running = false;
    let raf = 0;
    let lastT = 0;
    let dpr = 1;

    let pegs = [];
    let slotsCount = 11;
    let multipliers = makeMultipliers(slotsCount);
    let highlightSlot = -1;
    let ball = null; // {x,y,vx,vy,r}
    let settled = false;
    let currentBet = 0;

    const history = loadHistory();

    function loadHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const arr = JSON.parse(raw || "[]");
        if (Array.isArray(arr)) return arr.slice(0, 5);
        return [];
      } catch {
        return [];
      }
    }

    function saveHistory() {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
      } catch {}
    }

    function setStatus(text, kind) {
      const el = document.getElementById("plinkoStatus");
      if (!el) return;
      el.textContent = text;
      el.classList.remove("plinko-running", "plinko-done", "plinko-lost");
      if (kind) el.classList.add(kind);
    }

    function showToast(big, sub, show) {
      const toast = document.getElementById("plinkoToast");
      const b = document.getElementById("plinkoToastBig");
      const s = document.getElementById("plinkoToastSub");
      if (b) b.textContent = big || "";
      if (s) s.textContent = sub || "";
      if (toast) toast.classList.toggle("plinko-show", Boolean(show));
    }

    function renderHistory() {
      const host = document.getElementById("plinkoHistory");
      if (!host) return;
      host.innerHTML = "";
      const items = history.slice(0, 5);
      if (!items.length) {
        const chip = document.createElement("div");
        chip.className = "plinko-chip";
        chip.innerHTML = `<i>No results yet</i>`;
        host.appendChild(chip);
        return;
      }
      for (const it of items) {
        const chip = document.createElement("div");
        chip.className = "plinko-chip";
        chip.innerHTML = `<b>x${Number(it.m).toFixed(2)}</b> <i>${it.win >= 0 ? "+" : ""}${fmt(it.win)}</i>`;
        host.appendChild(chip);
      }
    }

    function setBalanceUI() {
      const el = document.getElementById("plinkoBalance");
      if (el) el.textContent = fmt(balanceApi.get());
    }

    function preventWheelOnNumberInput(inp) {
      inp.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
        },
        { passive: false }
      );
    }

    function open() {
      if (!overlay) overlay = createModal();
      if (!overlay._bound) {
        const closeBtn = overlay.querySelector(".plinko-close");
        const closeBtn2 = overlay.querySelector("#plinkoCloseBtn");
        closeBtn.addEventListener("click", () => close());
        closeBtn2.addEventListener("click", () => close());
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) close();
        });
        overlay._bound = true;
      }

      // Disable scrolling while modal is open and block touch scrolling.
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      overlay.addEventListener(
        "wheel",
        (e) => e.preventDefault(),
        { passive: false }
      );
      overlay.addEventListener(
        "touchmove",
        (e) => e.preventDefault(),
        { passive: false }
      );

      overlay.classList.add("plinko-open");
      setBalanceUI();
      renderHistory();
      showToast("Ready", "Drop a ball to play.", true);
      setStatus("Waiting", "");

      const betInp = document.getElementById("plinkoBet");
      const dropBtn = document.getElementById("plinkoDropBtn");
      if (betInp) preventWheelOnNumberInput(betInp);

      dropBtn.onclick = () => dropBall();

      setupCanvas();
      resetRoundVisual();
      startLoop();
      window.addEventListener("resize", onResize);
    }

    function close() {
      if (!overlay) return;
      stopLoop();
      window.removeEventListener("resize", onResize);
      overlay.classList.remove("plinko-open");
      document.body.style.overflow = prevOverflow;
    }

    function onResize() {
      if (!overlay?.classList.contains("plinko-open")) return;
      setupCanvas();
    }

    function setupCanvas() {
      const canvas = document.getElementById("plinkoCanvas");
      if (!canvas) return;
      const wrap = canvas.parentElement;
      const rect = wrap.getBoundingClientRect();
      dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(240, Math.floor(rect.height * dpr));
      buildBoard();
      draw();
    }

    function buildBoard() {
      const canvas = document.getElementById("plinkoCanvas");
      if (!canvas) return;
      const w = canvas.width;
      const h = canvas.height;

      // Geometry
      slotsCount = w < 680 * dpr ? 9 : 11;
      multipliers = makeMultipliers(slotsCount);

      const side = Math.floor(52 * dpr);
      const top = Math.floor(66 * dpr);
      const bottom = Math.floor(104 * dpr);

      const gapX = (w - side * 2) / (slotsCount - 1);
      const gapY = gapX * 0.78;
      const rows = clamp(Math.floor((h - top - bottom) / gapY), 8, 13);

      const pegR = Math.max(3.5 * dpr, Math.min(7.5 * dpr, gapX * 0.10));

      pegs = [];
      for (let r = 0; r < rows; r++) {
        const odd = r % 2 === 1;
        const count = odd ? slotsCount - 2 : slotsCount - 1;
        const offset = odd ? gapX / 2 : 0;
        const y = top + r * gapY;
        for (let i = 0; i < count; i++) {
          const x = side + offset + i * gapX;
          pegs.push({ x, y, r: pegR });
        }
      }

      // Keep ball within walls based on board size.
      const ballR = Math.max(7 * dpr, Math.min(12 * dpr, gapX * 0.14));
      if (ball) ball.r = ballR;
    }

    function resetRoundVisual() {
      running = false;
      settled = false;
      ball = null;
      currentBet = 0;
      highlightSlot = -1;
      const dropBtn = document.getElementById("plinkoDropBtn");
      const betInp = document.getElementById("plinkoBet");
      if (dropBtn) dropBtn.disabled = false;
      if (betInp) betInp.disabled = false;
      setStatus("Waiting", "");
      const hint = document.getElementById("plinkoHint");
      if (hint) hint.textContent = "";
    }

    function dropBall() {
      if (running) return;
      const betInp = document.getElementById("plinkoBet");
      const dropBtn = document.getElementById("plinkoDropBtn");
      const hint = document.getElementById("plinkoHint");

      const bet = Math.max(1, Math.floor(Number(betInp?.value) || 0));
      if (!Number.isFinite(bet) || bet <= 0) {
        if (hint) hint.textContent = "Enter a valid bet.";
        return;
      }

      const bal = balanceApi.get();
      if (bet > bal) {
        if (hint) hint.textContent = "Insufficient balance.";
        return;
      }

      // Take bet immediately.
      balanceApi.set(bal - bet);
      setBalanceUI();

      currentBet = bet;
      running = true;
      settled = false;
      highlightSlot = -1;

      if (dropBtn) dropBtn.disabled = true;
      if (betInp) betInp.disabled = true;

      setStatus("Running", "plinko-running");
      showToast("Ball dropped", `Bet: ${fmt(bet)}`, true);
      if (hint) hint.textContent = "";

      spawnBall();
    }

    function spawnBall() {
      const canvas = document.getElementById("plinkoCanvas");
      if (!canvas) return;
      const w = canvas.width;
      const h = canvas.height;

      const side = Math.floor(52 * dpr);
      const top = Math.floor(48 * dpr);

      const gapX = (w - side * 2) / (slotsCount - 1);
      const r = Math.max(7 * dpr, Math.min(12 * dpr, gapX * 0.14));

      const x = w / 2 + (Math.random() - 0.5) * gapX * 0.18;
      const y = top;
      const vx = (Math.random() - 0.5) * 80 * dpr;
      const vy = 0;
      ball = { x, y, vx, vy, r };
    }

    function finishInSlot(slotIdx) {
      if (settled) return;
      settled = true;
      running = false;
      highlightSlot = slotIdx;

      const m = multipliers[slotIdx] ?? 0;
      const win = Math.floor(currentBet * m);
      const profit = win - currentBet;

      balanceApi.set(balanceApi.get() + win);
      setBalanceUI();

      history.unshift({ m: Number(m), win: profit });
      while (history.length > 5) history.pop();
      saveHistory();
      renderHistory();

      const hint = document.getElementById("plinkoHint");
      if (hint) hint.textContent = profit >= 0 ? `Win: +${fmt(profit)} (x${Number(m).toFixed(2)})` : `Loss: ${fmt(profit)} (x${Number(m).toFixed(2)})`;

      showToast(`x${Number(m).toFixed(2)}`, profit >= 0 ? `WIN +${fmt(profit)}` : `LOST ${fmt(profit)}`, true);
      setStatus(profit >= 0 ? "Finished" : "Finished", profit >= 0 ? "plinko-done" : "plinko-lost");

      const dropBtn = document.getElementById("plinkoDropBtn");
      const betInp = document.getElementById("plinkoBet");
      if (dropBtn) dropBtn.disabled = false;
      if (betInp) betInp.disabled = false;
    }

    function startLoop() {
      stopLoop();
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
      // Keep balance synced if other games change it while modal is open.
      overlay._balTimer = setInterval(() => setBalanceUI(), 500);
    }

    function stopLoop() {
      cancelAnimationFrame(raf);
      raf = 0;
      lastT = 0;
      if (overlay?._balTimer) {
        clearInterval(overlay._balTimer);
        overlay._balTimer = 0;
      }
    }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.032, Math.max(0.001, (t - lastT) / 1000));
      lastT = t;
      step(dt);
      draw();
    }

    function step(dt) {
      if (!ball || !running) return;
      const canvas = document.getElementById("plinkoCanvas");
      if (!canvas) return;
      const w = canvas.width;
      const h = canvas.height;

      const side = Math.floor(52 * dpr);
      const top = Math.floor(66 * dpr);
      const bottom = Math.floor(104 * dpr);
      const slotTop = h - bottom;
      const slotW = w / slotsCount;

      // Forces
      const g = 2200 * dpr; // px/s^2
      ball.vy += g * dt;

      // Integrate
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Wall collisions
      const left = side - slotW * 0.08;
      const right = w - side + slotW * 0.08;
      if (ball.x - ball.r < left) {
        ball.x = left + ball.r;
        ball.vx = Math.abs(ball.vx) * 0.78 + (Math.random() * 30 * dpr);
      }
      if (ball.x + ball.r > right) {
        ball.x = right - ball.r;
        ball.vx = -Math.abs(ball.vx) * 0.78 - (Math.random() * 30 * dpr);
      }

      // Peg collisions
      const restitution = 0.74;
      const tangFriction = 0.14;
      for (let i = 0; i < pegs.length; i++) {
        const p = pegs[i];
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const rr = ball.r + p.r;
        const d2 = dx * dx + dy * dy;
        if (d2 <= rr * rr) {
          const d = Math.sqrt(Math.max(0.0001, d2));
          const nx = dx / d;
          const ny = dy / d;
          const pen = rr - d;
          ball.x += nx * pen;
          ball.y += ny * pen;

          const vdot = ball.vx * nx + ball.vy * ny;
          if (vdot < 0) {
            ball.vx -= (1 + restitution) * vdot * nx;
            ball.vy -= (1 + restitution) * vdot * ny;
          }

          // Tangential damping
          const vdot2 = ball.vx * nx + ball.vy * ny;
          const tx = ball.vx - vdot2 * nx;
          const ty = ball.vy - vdot2 * ny;
          ball.vx -= tx * tangFriction;
          ball.vy -= ty * tangFriction;

          // Slight randomness per bounce (chaos, not predictable)
          ball.vx += (Math.random() - 0.5) * 120 * dpr;
          ball.vy += (Math.random() - 0.5) * 40 * dpr;
        }
      }

      // Global damping
      ball.vx *= 0.996;
      ball.vy *= 0.998;

      // Landing in slot
      if (ball.y + ball.r >= slotTop) {
        // Let it settle a tiny bit into the slot area, then decide.
        const slotIdx = clamp(Math.floor(ball.x / slotW), 0, slotsCount - 1);
        finishInSlot(slotIdx);
      }

      // Safety: if out of bounds
      if (ball.y - ball.r > h + 200 * dpr) {
        const slotIdx = clamp(Math.floor(ball.x / slotW), 0, slotsCount - 1);
        finishInSlot(slotIdx);
      }
    }

    function draw() {
      const canvas = document.getElementById("plinkoCanvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      const side = Math.floor(52 * dpr);
      const bottom = Math.floor(104 * dpr);
      const slotTop = h - bottom;
      const slotW = w / slotsCount;

      // Background grid-ish
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, w, h);

      // Subtle grid lines
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1 * dpr;
      const step = Math.max(42 * dpr, Math.floor(slotW));
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      // Slot area
      ctx.save();
      for (let i = 0; i < slotsCount; i++) {
        const x0 = i * slotW;
        const isHi = i === highlightSlot;
        const glowA = isHi ? 0.26 : 0.08;
        ctx.fillStyle = isHi ? `rgba(0,255,136,${glowA})` : `rgba(168,85,255,${glowA})`;
        ctx.fillRect(x0, slotTop, slotW, h - slotTop);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, slotTop);
        ctx.lineTo(x0 + 0.5, h);
        ctx.stroke();
      }
      // Border top
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, slotTop + 0.5);
      ctx.lineTo(w, slotTop + 0.5);
      ctx.stroke();
      ctx.restore();

      // Multiplier labels
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(12 * dpr, slotW * 0.18)}px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace`;
      for (let i = 0; i < multipliers.length; i++) {
        const m = multipliers[i];
        const cx = i * slotW + slotW / 2;
        const cy = slotTop + (h - slotTop) * 0.55;
        const hi = i === highlightSlot;
        ctx.fillStyle = hi ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.70)";
        ctx.shadowColor = hi ? "rgba(0,255,136,0.45)" : "rgba(168,85,255,0.30)";
        ctx.shadowBlur = hi ? 22 * dpr : 14 * dpr;
        ctx.fillText(`x${Number(m).toFixed(m >= 10 ? 0 : 1)}`, cx, cy);
      }
      ctx.restore();

      // Pegs
      ctx.save();
      for (const p of pegs) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,234,255,0.95)";
        ctx.shadowColor = "rgba(0,234,255,0.55)";
        ctx.shadowBlur = 12 * dpr;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }
      ctx.restore();

      // Side glass border
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(side - 16 * dpr, 18 * dpr, w - (side - 16 * dpr) * 2, slotTop - 18 * dpr);
      ctx.restore();

      // Ball
      if (ball) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.98)";
        ctx.shadowColor = "rgba(255,255,255,0.40)";
        ctx.shadowBlur = 22 * dpr;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(0,234,255,0.25)";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
        ctx.restore();
      }
    }

    return { open };
  }

  function init() {
    const app = plinkoApp();
    createNavbarButton(() => app.open());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
