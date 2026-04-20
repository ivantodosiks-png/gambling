// Plinko (in-page tab). Vanilla JS + Canvas physics. Self-contained styles with `plinko-` prefix.
(function () {
  const CSS = `
  .plinko-root{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;align-items:stretch}
  .plinko-card{border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(0,0,0,.65) inset,0 18px 50px rgba(0,0,0,.45);overflow:hidden}
  .plinko-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.22)}
  .plinko-title{font:1000 18px/1 "Space Grotesk",system-ui,Segoe UI,Roboto,Arial;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.92)}
  .plinko-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .plinko-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);box-shadow:0 0 0 1px rgba(0,234,255,.08) inset}
  .plinko-pill span{font:800 12px/1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.10em;text-transform:uppercase;color:rgba(255,255,255,.70)}
  .plinko-pill b{font:1000 13px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#00ff88;text-shadow:0 0 18px rgba(0,255,136,.20)}
  .plinko-board{position:relative;height:min(620px,62vh);background:linear-gradient(180deg,rgba(20,34,56,.55),rgba(10,14,24,.55));}
  .plinko-board:before{content:"";position:absolute;inset:-2px;background:radial-gradient(900px 520px at 50% 10%, rgba(0,234,255,.10), rgba(0,0,0,0) 62%);pointer-events:none}
  .plinko-canvas{width:100%;height:100%;display:block}
  .plinko-toast{position:absolute;left:14px;top:14px;z-index:3;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.40);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;flex-direction:column;gap:6px;min-width:200px}
  .plinko-toast .big{font:1000 16px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.95)}
  .plinko-toast .sub{font:700 12px/1.2 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.70)}
  .plinko-panel{padding:12px 14px;display:flex;flex-direction:column;gap:12px}
  .plinko-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .plinko-label{font:900 12px/1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.70)}
  .plinko-status{font:1000 12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.88)}
  .plinko-status.run{color:#00eaff;border-color:rgba(0,234,255,.28);box-shadow:0 0 18px rgba(0,234,255,.10)}
  .plinko-status.win{color:#00ff88;border-color:rgba(0,255,136,.24);box-shadow:0 0 18px rgba(0,255,136,.10)}
  .plinko-status.lose{color:#ff3b3b;border-color:rgba(255,59,59,.24);box-shadow:0 0 18px rgba(255,59,59,.10)}
  .plinko-input{width:100%;height:44px;border-radius:14px;padding:0 14px;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.10);outline:none;color:rgba(255,255,255,.92);font:1000 14px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
  .plinko-input:focus{border-color:rgba(0,234,255,.35);box-shadow:0 0 0 3px rgba(0,234,255,.12)}
  .plinko-btnRow{display:flex;gap:10px}
  .plinko-btn{flex:1;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);font:1000 14px/1 system-ui,Segoe UI,Roboto,Arial;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease,opacity .12s ease}
  .plinko-btn:hover{transform:translateY(-1px);border-color:rgba(0,234,255,.25);box-shadow:0 0 22px rgba(168,85,255,.12)}
  .plinko-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
  .plinko-btn.primary{background:linear-gradient(180deg,rgba(168,85,255,.95),rgba(124,58,237,.85));border-color:rgba(168,85,255,.55);color:#090012;box-shadow:0 12px 30px rgba(168,85,255,.18)}
  .plinko-btn.primary:hover{box-shadow:0 12px 34px rgba(168,85,255,.24),0 0 24px rgba(0,234,255,.10)}
  .plinko-hint{font:700 12px/1.35 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.70);min-height:18px}
  .plinko-history{display:flex;flex-wrap:wrap;gap:8px}
  .plinko-chip{padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.10);font:1000 12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.90)}
  .plinko-chip b{color:#00ff88}
  .plinko-chip i{font-style:normal;color:rgba(255,255,255,.68)}
  @media (max-width: 980px){
    .plinko-root{grid-template-columns:1fr}
    .plinko-board{height:min(540px,54vh)}
  }`;

  function injectStyleOnce() {
    if (document.getElementById("plinko-style")) return;
    const s = document.createElement("style");
    s.id = "plinko-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fmt(n) {
    const x = Number(n) || 0;
    return x.toLocaleString("en-US");
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
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

  function multipliersLikeScreenshot(slotCount) {
    // Screenshot style: huge on edges, tiny in center (Stake-like).
    const base17 = [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000];
    const base15 = [130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130];
    const base13 = [26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26];
    const base11 = [9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9];
    if (slotCount === 17) return base17;
    if (slotCount === 15) return base15;
    if (slotCount === 13) return base13;
    if (slotCount === 11) return base11;
    // Fallback: center-crop base17.
    const start = Math.max(0, Math.floor((base17.length - slotCount) / 2));
    return base17.slice(start, start + slotCount);
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

  function createUI(mount) {
    mount.innerHTML = `
      <div class="plinko-root">
        <div class="plinko-card">
          <div class="plinko-top">
            <div class="plinko-title">Plinko</div>
            <div class="plinko-meta">
              <div class="plinko-pill"><span>Balance</span><b id="plinkoBalance">0</b></div>
            </div>
          </div>
          <div class="plinko-board" id="plinkoBoard">
            <div class="plinko-toast">
              <div class="big" id="plinkoToastBig">Ready</div>
              <div class="sub" id="plinkoToastSub">Drop a ball.</div>
            </div>
            <canvas id="plinkoCanvas" class="plinko-canvas"></canvas>
          </div>
        </div>
        <div class="plinko-card">
          <div class="plinko-top">
            <div class="plinko-title" style="font-size:14px;">Controls</div>
            <div id="plinkoStatus" class="plinko-status">Waiting</div>
          </div>
          <div class="plinko-panel">
            <div>
              <div class="plinko-label" style="margin-bottom:8px;">Bet</div>
              <input id="plinkoBet" class="plinko-input" type="number" inputmode="numeric" min="1" step="1" value="50" />
              <div class="plinko-hint" id="plinkoHint"></div>
            </div>
            <div class="plinko-btnRow">
              <button id="plinkoDropBtn" class="plinko-btn primary" type="button">Drop Ball</button>
              <button id="plinkoClearBtn" class="plinko-btn" type="button">Clear</button>
            </div>
            <div>
              <div class="plinko-label" style="margin-bottom:8px;">Last 5</div>
              <div id="plinkoHistory" class="plinko-history"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function plinko() {
    const mount = document.getElementById("plinkoMount");
    if (!mount) return null;

    injectStyleOnce();
    createUI(mount);

    const balanceApi = getBalanceApi();
    const uid = getUserIdText() || "unknown";
    const HISTORY_KEY = `plinko_history_v2:${uid}`;

    const canvas = document.getElementById("plinkoCanvas");
    const ctx = canvas.getContext("2d");
    const boardEl = document.getElementById("plinkoBoard");
    const balanceEl = document.getElementById("plinkoBalance");
    const statusEl = document.getElementById("plinkoStatus");
    const hintEl = document.getElementById("plinkoHint");
    const betEl = document.getElementById("plinkoBet");
    const dropBtn = document.getElementById("plinkoDropBtn");
    const clearBtn = document.getElementById("plinkoClearBtn");
    const toastBig = document.getElementById("plinkoToastBig");
    const toastSub = document.getElementById("plinkoToastSub");
    const histEl = document.getElementById("plinkoHistory");

    preventWheelOnNumberInput(betEl);

    let dpr = 1;
    let slotsCount = 17;
    let multipliers = multipliersLikeScreenshot(slotsCount);
    let pegs = [];
    let slotRects = [];
    let highlight = -1;

    let running = false;
    let settled = false;
    let currentBet = 0;
    let ball = null; // {x,y,vx,vy,r}
    let raf = 0;
    let lastT = 0;

    const history = loadHistory();

    function setBalanceUI() {
      if (balanceEl) balanceEl.textContent = fmt(balanceApi.get());
    }

    function setStatus(text, kind) {
      statusEl.textContent = text;
      statusEl.classList.remove("run", "win", "lose");
      if (kind) statusEl.classList.add(kind);
    }

    function toast(big, sub) {
      if (toastBig) toastBig.textContent = big || "";
      if (toastSub) toastSub.textContent = sub || "";
    }

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

    function renderHistory() {
      histEl.innerHTML = "";
      if (!history.length) {
        const chip = document.createElement("div");
        chip.className = "plinko-chip";
        chip.innerHTML = `<i>No results yet</i>`;
        histEl.appendChild(chip);
        return;
      }
      for (const it of history.slice(0, 5)) {
        const chip = document.createElement("div");
        chip.className = "plinko-chip";
        chip.innerHTML = `<b>x${Number(it.m).toFixed(it.m >= 10 ? 0 : 1)}</b> <i>${it.p >= 0 ? "+" : ""}${fmt(it.p)}</i>`;
        histEl.appendChild(chip);
      }
    }

    function setHint(text) {
      hintEl.textContent = text || "";
    }

    function setup() {
      const rect = boardEl.getBoundingClientRect();
      dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(260, Math.floor(rect.height * dpr));

      // Slots count based on width (keep screenshot-like when possible).
      const w = canvas.width;
      if (w >= 740 * dpr) slotsCount = 17;
      else if (w >= 620 * dpr) slotsCount = 15;
      else if (w >= 520 * dpr) slotsCount = 13;
      else slotsCount = 11;
      multipliers = multipliersLikeScreenshot(slotsCount);

      buildGeometry();
      draw();
    }

    function buildGeometry() {
      const w = canvas.width;
      const h = canvas.height;

      const padX = Math.floor(22 * dpr);
      const padTop = Math.floor(26 * dpr);
      const padBottom = Math.floor(46 * dpr);
      const slotH = Math.max(28 * dpr, Math.floor(h * 0.11));
      const slotTop = h - padBottom;

      const usableW = w - padX * 2;
      const slotW = usableW / slotsCount;

      slotRects = [];
      for (let i = 0; i < slotsCount; i++) {
        slotRects.push({
          x: padX + i * slotW,
          y: slotTop,
          w: slotW,
          h: slotH,
        });
      }

      // Triangle pegs: rows = slotsCount-1, each row has r+1 pegs.
      const rows = slotsCount - 1;
      const pegAreaTop = padTop + Math.floor(34 * dpr);
      const pegAreaBottom = slotTop - Math.floor(14 * dpr);
      const pegAreaH = Math.max(140 * dpr, pegAreaBottom - pegAreaTop);
      const gapY = pegAreaH / (rows + 1);
      const pegR = Math.max(2.6 * dpr, Math.min(4.4 * dpr, slotW * 0.10));

      pegs = [];
      for (let r = 0; r < rows; r++) {
        const count = r + 1;
        const rowW = (count - 1) * slotW;
        const startX = w / 2 - rowW / 2;
        const y = pegAreaTop + (r + 1) * gapY;
        for (let i = 0; i < count; i++) {
          pegs.push({ x: startX + i * slotW, y, r: pegR });
        }
      }

      // Ball radius relative to slot width.
      const ballR = Math.max(6 * dpr, Math.min(10 * dpr, slotW * 0.16));
      if (ball) ball.r = ballR;
    }

    function reset() {
      running = false;
      settled = false;
      currentBet = 0;
      ball = null;
      highlight = -1;
      setStatus("Waiting", "");
      setHint("");
      toast("Ready", "Drop a ball.");
      dropBtn.disabled = false;
      betEl.disabled = false;
      draw();
    }

    function spawnBall() {
      const w = canvas.width;
      const padTop = Math.floor(26 * dpr);
      const slotW = (canvas.width - Math.floor(22 * dpr) * 2) / slotsCount;
      const r = Math.max(6 * dpr, Math.min(10 * dpr, slotW * 0.16));
      const x = w / 2 + (Math.random() - 0.5) * slotW * 0.25;
      const y = padTop + 10 * dpr;
      const vx = (Math.random() - 0.5) * 60 * dpr;
      const vy = 0;
      ball = { x, y, vx, vy, r };
    }

    function drop() {
      if (running) return;
      const bet = Math.max(1, Math.floor(Number(betEl.value) || 0));
      if (!Number.isFinite(bet) || bet <= 0) return setHint("Enter a valid bet.");

      const bal = balanceApi.get();
      if (bet > bal) return setHint("Insufficient balance.");

      // Take bet.
      balanceApi.set(bal - bet);
      setBalanceUI();

      currentBet = bet;
      running = true;
      settled = false;
      highlight = -1;
      setStatus("Running", "run");
      setHint("");
      toast("Running", `Bet: ${fmt(bet)}`);

      dropBtn.disabled = true;
      betEl.disabled = true;

      spawnBall();
    }

    function finish(slotIdx) {
      if (settled) return;
      settled = true;
      running = false;
      highlight = slotIdx;

      const m = Number(multipliers[slotIdx] ?? 0);
      const win = Math.floor(currentBet * m);
      const profit = win - currentBet;

      balanceApi.set(balanceApi.get() + win);
      setBalanceUI();

      history.unshift({ m, p: profit });
      while (history.length > 5) history.pop();
      saveHistory();
      renderHistory();

      setStatus("Finished", profit >= 0 ? "win" : "lose");
      setHint(profit >= 0 ? `Win: +${fmt(profit)} (x${m.toFixed(m >= 10 ? 0 : 1)})` : `Loss: ${fmt(profit)} (x${m.toFixed(m >= 10 ? 0 : 1)})`);
      toast(`x${m.toFixed(m >= 10 ? 0 : 1)}`, profit >= 0 ? `WIN +${fmt(profit)}` : `LOST ${fmt(profit)}`);

      dropBtn.disabled = false;
      betEl.disabled = false;
    }

    function step(dt) {
      if (!running || !ball) return;

      const w = canvas.width;
      const h = canvas.height;
      const padX = Math.floor(22 * dpr);
      const slotTop = canvas.height - Math.floor(46 * dpr);

      const g = 2000 * dpr; // px/s^2
      ball.vy += g * dt;

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Walls (keep inside triangle-ish width; use soft side walls).
      if (ball.x - ball.r < padX) {
        ball.x = padX + ball.r;
        ball.vx = Math.abs(ball.vx) * 0.78 + Math.random() * 24 * dpr;
      }
      if (ball.x + ball.r > w - padX) {
        ball.x = w - padX - ball.r;
        ball.vx = -Math.abs(ball.vx) * 0.78 - Math.random() * 24 * dpr;
      }

      // Peg collisions
      const restitution = 0.76;
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

          // Chaos: tiny random push each bounce
          ball.vx += (Math.random() - 0.5) * 110 * dpr;
          ball.vy += (Math.random() - 0.5) * 28 * dpr;
        }
      }

      // Damping
      ball.vx *= 0.996;
      ball.vy *= 0.998;

      // Land in slot
      if (ball.y + ball.r >= slotTop) {
        const slotW = (w - padX * 2) / slotsCount;
        const idx = clamp(Math.floor((ball.x - padX) / slotW), 0, slotsCount - 1);
        finish(idx);
      }
      // Safety
      if (ball.y - ball.r > h + 200 * dpr) {
        const slotW = (w - padX * 2) / slotsCount;
        const idx = clamp(Math.floor((ball.x - padX) / slotW), 0, slotsCount - 1);
        finish(idx);
      }
    }

    function slotColor(m) {
      // Match screenshot vibe: high = magenta/red, mid = orange, low = yellow.
      if (m >= 100) return { fill: "rgba(255, 0, 80, 0.92)", glow: "rgba(255, 0, 80, 0.35)" };
      if (m >= 10) return { fill: "rgba(255, 90, 40, 0.92)", glow: "rgba(255, 90, 40, 0.30)" };
      if (m >= 4) return { fill: "rgba(255, 150, 30, 0.92)", glow: "rgba(255, 150, 30, 0.24)" };
      if (m >= 2) return { fill: "rgba(255, 200, 30, 0.92)", glow: "rgba(255, 200, 30, 0.20)" };
      return { fill: "rgba(255, 230, 60, 0.92)", glow: "rgba(255, 230, 60, 0.18)" };
    }

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.save();
      ctx.fillStyle = "rgba(10,14,24,0.0)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Pegs: white dots
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.shadowColor = "rgba(255,255,255,0.22)";
      ctx.shadowBlur = 10 * dpr;
      for (const p of pegs) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Ball: red glowing
      if (ball) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 40, 70, 0.98)";
        ctx.shadowColor = "rgba(255, 40, 70, 0.55)";
        ctx.shadowBlur = 26 * dpr;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
        ctx.restore();
      }

      // Slots + labels
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelSize = Math.max(10 * dpr, Math.min(16 * dpr, slotRects[0]?.w * 0.22));
      ctx.font = `${Math.floor(labelSize)}px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace`;
      for (let i = 0; i < slotRects.length; i++) {
        const r = slotRects[i];
        const m = Number(multipliers[i] ?? 0);
        const col = slotColor(m);
        const hi = i === highlight;

        // Box
        ctx.shadowColor = hi ? "rgba(0,255,136,0.35)" : col.glow;
        ctx.shadowBlur = (hi ? 26 : 18) * dpr;
        ctx.fillStyle = hi ? "rgba(0,255,136,0.92)" : col.fill;
        const rr = 8 * dpr;
        roundRect(ctx, r.x + 2 * dpr, r.y + 2 * dpr, r.w - 4 * dpr, r.h - 4 * dpr, rr);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        // Text
        ctx.fillStyle = "rgba(0,0,0,0.88)";
        ctx.fillText(`x${m >= 10 ? m.toFixed(0) : m.toFixed(1)}`, r.x + r.w / 2, r.y + r.h / 2);
      }
      ctx.restore();
    }

    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.032, Math.max(0.001, (t - lastT) / 1000));
      lastT = t;
      step(dt);
      draw();
    }

    function start() {
      cancelAnimationFrame(raf);
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    dropBtn.addEventListener("click", drop);
    clearBtn.addEventListener("click", reset);
    window.addEventListener("resize", () => setup());

    setBalanceUI();
    renderHistory();
    reset();
    setup();
    start();

    // Public hooks for site.js tab switch.
    return {
      onShow: () => {
        setBalanceUI();
        setup();
        draw();
      },
      destroy: () => stop(),
    };
  }

  function init() {
    const game = plinko();
    if (game) window.plinkoGame = game;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

