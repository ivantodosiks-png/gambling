// Plinko (in-page tab). Vanilla JS + Canvas physics. Self-contained styles with `plinko-` prefix.
(function () {
  const CSS = `
  .plinko-root{height:100%;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:14px;align-items:stretch}
  .plinko-card{border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(0,0,0,.65) inset,0 22px 70px rgba(0,0,0,.48);overflow:hidden}
  .plinko-stage{position:relative;height:100%;display:flex;flex-direction:column;min-height:0}
  .plinko-stage::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(1200px 620px at 20% 10%, rgba(0,234,255,.10), transparent 60%),radial-gradient(900px 520px at 80% 35%, rgba(168,85,255,.10), transparent 55%);opacity:.9}
  .plinko-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.24);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  .plinko-title{font:1000 14px/1 "Space Grotesk",system-ui,Segoe UI,Roboto,Arial;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.92)}
  .plinko-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .plinko-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);box-shadow:0 0 0 1px rgba(0,234,255,.08) inset}
  .plinko-pill span{font:900 11px/1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.70)}
  .plinko-pill b{font:1000 13px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#00ff88;text-shadow:0 0 20px rgba(0,255,136,.22)}
  .plinko-board{position:relative;flex:1 1 auto;min-height:0;background:linear-gradient(180deg,rgba(10,34,22,.66),rgba(7,16,22,.42));}
  .plinko-board:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(900px 520px at 50% 10%, rgba(0,234,255,.10), rgba(0,0,0,0) 62%),radial-gradient(900px 560px at 50% 100%, rgba(34,197,94,.12), rgba(0,0,0,0) 60%);opacity:.95}
  .plinko-board:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.06;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")}
  .plinko-canvas{width:100%;height:100%;display:block}
  .plinko-controls{min-height:0;display:flex;flex-direction:column}
  .plinko-controls .plinko-panel{overflow:auto;min-height:0}
  .plinko-panel{padding:12px 14px;display:flex;flex-direction:column;gap:12px}
  .plinko-toastText{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .plinko-toastText .big{font:1000 16px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.95)}
  .plinko-toastText .sub{font:700 12px/1.2 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.70)}
  .plinko-label{font:900 11px/1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.70)}
  .plinko-status{font:1000 12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.88)}
  .plinko-status.run{color:#00eaff;border-color:rgba(0,234,255,.28);box-shadow:0 0 18px rgba(0,234,255,.10)}
  .plinko-status.win{color:#00ff88;border-color:rgba(0,255,136,.24);box-shadow:0 0 18px rgba(0,255,136,.10)}
  .plinko-status.lose{color:#ff3b3b;border-color:rgba(255,59,59,.24);box-shadow:0 0 18px rgba(255,59,59,.10)}
  .plinko-input{width:100%;height:44px;border-radius:14px;padding:0 14px;background:rgba(0,0,0,.30);border:1px solid rgba(255,255,255,.10);outline:none;color:rgba(255,255,255,.92);font:1000 14px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
  .plinko-input:focus{border-color:rgba(0,234,255,.35);box-shadow:0 0 0 3px rgba(0,234,255,.12)}
  .plinko-btnRow{display:flex;gap:10px}
  .plinko-btn{flex:1;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);font:1000 14px/1 system-ui,Segoe UI,Roboto,Arial;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease,opacity .12s ease}
  .plinko-btn:hover{transform:translateY(-1px);border-color:rgba(0,234,255,.25);box-shadow:0 0 22px rgba(168,85,255,.12)}
  .plinko-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
  .plinko-btn.primary{background:linear-gradient(180deg,rgba(168,85,255,.95),rgba(124,58,237,.85));border-color:rgba(168,85,255,.55);color:#090012;box-shadow:0 12px 30px rgba(168,85,255,.18)}
  .plinko-btn.primary:hover{box-shadow:0 12px 34px rgba(168,85,255,.24),0 0 24px rgba(0,234,255,.10)}
  .plinko-hint{font:700 12px/1.35 system-ui,Segoe UI,Roboto,Arial;color:rgba(255,255,255,.70);min-height:18px}
  .plinko-seedRow{display:flex;gap:10px;align-items:center}
  .plinko-seedRow .plinko-input{flex:1 1 auto}
  .plinko-smallBtn{height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);font:900 11px/1 system-ui,Segoe UI,Roboto,Arial;letter-spacing:.10em;text-transform:uppercase;cursor:pointer;white-space:nowrap;padding:0 12px}
  .plinko-smallBtn:hover{border-color:rgba(0,234,255,.25);box-shadow:0 0 18px rgba(0,234,255,.10)}
  .plinko-history{display:flex;flex-wrap:wrap;gap:8px}
  .plinko-chip{padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.10);font:1000 12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.90)}
  .plinko-chip b{color:#00ff88}
  .plinko-chip i{font-style:normal;color:rgba(255,255,255,.68)}
  @media (max-width: 980px){
    .plinko-root{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}
    .plinko-controls{max-height:44vh}
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

  function hash32(str) {
    // FNV-1a 32-bit
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRngFromSeed(seedStr) {
    // Mulberry32 (fast, decent for games; deterministic)
    let a = hash32(String(seedStr || "")) || 0x12345678;
    return function rng() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeedText() {
    // Non-crypto seed; just a convenient default.
    const a = Math.floor(Math.random() * 1e9);
    const b = Math.floor(Math.random() * 1e9);
    return `seed_${a.toString(36)}_${b.toString(36)}`;
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
        <div class="plinko-card plinko-stage">
          <div class="plinko-board" id="plinkoBoard">
            <canvas id="plinkoCanvas" class="plinko-canvas"></canvas>
          </div>
        </div>
        <div class="plinko-card plinko-controls">
          <div class="plinko-top">
            <div class="plinko-title" style="font-size:14px;">Plinko</div>
            <div class="plinko-meta">
              <div class="plinko-pill"><span>Balance</span><b id="plinkoBalance">0</b></div>
              <div id="plinkoStatus" class="plinko-status">Waiting</div>
            </div>
          </div>
          <div class="plinko-panel">
            <div class="plinko-toastText" aria-live="polite">
              <div class="big" id="plinkoToastBig">Ready</div>
              <div class="sub" id="plinkoToastSub">Drop a ball.</div>
            </div>
            <div>
              <div class="plinko-label" style="margin-bottom:8px;">Bet</div>
              <input id="plinkoBet" class="plinko-input" type="number" inputmode="numeric" min="1" step="1" value="50" />
              <div class="plinko-hint" id="plinkoHint"></div>
            </div>
            <div>
              <div class="plinko-label" style="margin-bottom:8px;">Seed</div>
              <div class="plinko-seedRow">
                <input id="plinkoSeed" class="plinko-input" type="text" spellcheck="false" autocomplete="off" />
                <button id="plinkoNewSeedBtn" class="plinko-smallBtn" type="button">New</button>
              </div>
              <div class="plinko-hint" id="plinkoNonceHint"></div>
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
    const seedEl = document.getElementById("plinkoSeed");
    const newSeedBtn = document.getElementById("plinkoNewSeedBtn");
    const nonceHintEl = document.getElementById("plinkoNonceHint");
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
    let pegsByRow = [];
    let geom = null; // {padX,slotTop,slotBottom,slotW,rows,pegAreaTop,gapY}
    let slotRects = [];
    let triangle = null; // { apex:{x,y}, bottomY, left:{...}, right:{...} }
    let highlight = -1;

    let balls = []; // [{x,y,vx,vy,r,bet,inSlot,slotIdx,spawnAt,enterAt,settle,targetSlot,nonce,seedUsed}]
    let raf = 0;
    let lastT = 0;

    let seedValue = "";
    const uidSeed = getUserIdText() || "unknown";
    const SEED_KEY = `plinko_seed_v1:${uidSeed}`;
    const NONCE_KEY = `plinko_nonce_v1:${uidSeed}`;
    let nonce = loadNonce();

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

    function loadNonce() {
      try {
        const n = Number(localStorage.getItem(NONCE_KEY));
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
      } catch {
        return 0;
      }
    }

    function saveNonce() {
      try {
        localStorage.setItem(NONCE_KEY, String(nonce));
      } catch {}
    }

    function getSeed() {
      return seedValue || "default";
    }

    function setSeed(next) {
      seedValue = String(next || "");
      if (seedEl) seedEl.value = seedValue;
      try {
        localStorage.setItem(SEED_KEY, seedValue);
      } catch {}
      renderNonceHint();
    }

    function loadSeed() {
      try {
        const s = (localStorage.getItem(SEED_KEY) || "").trim();
        return s || randomSeedText();
      } catch {
        return randomSeedText();
      }
    }

    function renderNonceHint() {
      if (!nonceHintEl) return;
      nonceHintEl.textContent = `Nonce: ${nonce}`;
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

      const padX = Math.floor(14 * dpr);
      const padTop = Math.floor(26 * dpr);
      const padBottom = Math.floor(46 * dpr);
      const slotH = Math.max(28 * dpr, Math.floor(h * 0.11));
      const slotTop = h - padBottom;
      const slotBottom = slotTop + slotH;

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
      // Wider vertical coverage: make pegs fill most of the canvas height.
      const pegAreaTop = padTop + Math.floor(12 * dpr);
      const pegAreaBottom = slotTop - Math.floor(10 * dpr);
      const pegAreaH = Math.max(140 * dpr, pegAreaBottom - pegAreaTop);
      const gapY = pegAreaH / (rows + 1);
      const pegR = Math.max(2.6 * dpr, Math.min(4.4 * dpr, slotW * 0.10));

      pegs = [];
      pegsByRow = Array.from({ length: rows }, () => []);
      for (let r = 0; r < rows; r++) {
        const count = r + 1;
        const rowW = (count - 1) * slotW;
        const startX = w / 2 - rowW / 2;
        const y = pegAreaTop + (r + 1) * gapY;
        for (let i = 0; i < count; i++) {
          const peg = { x: startX + i * slotW, y, r: pegR, row: r };
          pegs.push(peg);
          pegsByRow[r].push(peg);
        }
      }

      geom = { padX, slotTop, slotBottom, slotW, slotH, rows, pegAreaTop, gapY, pegR };

      // Ball radius relative to slot width.
      const ballR = Math.max(5.5 * dpr, Math.min(10.5 * dpr, Math.max(pegR * 2.2, slotW * 0.14)));
      for (const b of balls) b.r = ballR;

      // Build "pyramid" side walls so the ball cannot escape the triangle peg field.
      // This also reduces bias towards extreme slots caused by sliding on outer walls.
      if (pegs.length) {
        let minPegX = Infinity;
        let maxPegX = -Infinity;
        for (const p of pegs) {
          if (p.x < minPegX) minPegX = p.x;
          if (p.x > maxPegX) maxPegX = p.x;
        }

        const wallMargin = Math.max(slotW * 0.60, ballR * 1.65);
        // Stake-like triangle: apex near the first row of pegs, sides go to bottom corners.
        const apexX = w / 2;
        const apexY = Math.max(padTop + 4 * dpr, pegAreaTop - gapY * 0.85);
        const bottomY = Math.max(apexY + 60 * dpr, slotTop - Math.floor(8 * dpr));
        const leftBottomX = clamp(minPegX - wallMargin, padX + ballR, w - padX - ballR);
        const rightBottomX = clamp(maxPegX + wallMargin, padX + ballR, w - padX - ballR);

        function makeWall(x1, y1, x2, y2, side) {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const invLen = 1 / Math.max(0.0001, Math.hypot(dx, dy));
          // Normal points "inward" (clockwise from the segment direction).
          const nx = dy * invLen;
          const ny = -dx * invLen;
          return { x1, y1, x2, y2, nx, ny, side };
        }

        triangle = {
          apex: { x: apexX, y: apexY },
          bottomY,
          slotTop,
          slotBottom,
          padX,
          slotW,
          left: makeWall(apexX, apexY, leftBottomX, bottomY, "left"),
          right: makeWall(apexX, apexY, rightBottomX, bottomY, "right"),
        };
      } else {
        triangle = null;
      }
    }

    function reset() {
      balls = [];
      highlight = -1;
      setStatus("Waiting", "");
      setHint("");
      toast("Ready", "Drop a ball.");
      dropBtn.disabled = false;
      setBalanceUI();
      draw();
    }

    function computeTargetSlot(seed, nonceValue) {
      // Binomial/Galton board: n = rows, p=0.5. Center is most likely.
      const n = Math.max(1, slotsCount - 1);
      const rng = makeRngFromSeed(`${seed}::${nonceValue}::${slotsCount}`);
      let rights = 0;
      for (let i = 0; i < n; i++) if (rng() < 0.5) rights++;
      const center = Math.floor(slotsCount / 2);
      const offset = rights - Math.floor(n / 2);
      return clamp(center + offset, 0, slotsCount - 1);
    }

    function wallXAtY(wall, y) {
      if (!wall) return 0;
      const denom = wall.y2 - wall.y1;
      if (Math.abs(denom) < 0.0001) return wall.x1;
      const t = clamp((y - wall.y1) / denom, 0, 1);
      return wall.x1 + (wall.x2 - wall.x1) * t;
    }

    function triangleRangeAtY(y, margin) {
      if (!triangle) return null;
      const leftX = wallXAtY(triangle.left, y);
      const rightX = wallXAtY(triangle.right, y);
      const m = Math.max(0, Number(margin) || 0);
      const minX = Math.min(leftX, rightX) + m;
      const maxX = Math.max(leftX, rightX) - m;
      if (!(maxX > minX)) return null;
      return { minX, maxX };
    }

    function spawnBall(seed, nonceValue) {
      const w = canvas.width;
      const padTop = Math.floor(26 * dpr);
      const slotW = (canvas.width - Math.floor(14 * dpr) * 2) / slotsCount;
      const r = Math.max(6 * dpr, Math.min(10 * dpr, slotW * 0.16));
      // Stake-like: drop near the center with a small variance.
      const rng = makeRngFromSeed(`${seed}::spawn::${nonceValue}`);
      const y = triangle ? (triangle.apex.y + Math.max(8 * dpr, r * 0.65)) : (padTop + 10 * dpr);
      const range = triangleRangeAtY(y, r * 1.05);
      const x0 = w / 2 + (rng() - 0.5) * slotW * 0.55;
      const x = range ? clamp(x0, range.minX, range.maxX) : x0;
      const vx = (rng() - 0.5) * 34 * dpr;
      const vy = 0;
      const targetSlot = computeTargetSlot(seed, nonceValue);
      return { x, y, vx, vy, r, bet: 0, inSlot: false, slotIdx: 0, spawnAt: performance.now(), enterAt: 0, settle: 0, targetSlot, nonce: nonceValue, seedUsed: seed };
    }

    function drop() {
      // Allow multiple balls.
      const bet = Math.max(1, Math.floor(Number(betEl.value) || 0));
      if (!Number.isFinite(bet) || bet <= 0) return setHint("Enter a valid bet.");

      const bal = balanceApi.get();
      if (bet > bal) return setHint("Insufficient balance.");
      if (balls.length >= 10) return setHint("Too many balls. Wait for a few to finish.");

      // Take bet.
      balanceApi.set(bal - bet);
      setBalanceUI();

      highlight = -1;
      setStatus(`Running (${balls.length + 1})`, "run");
      setHint("");
      toast("Running", `Bet: ${fmt(bet)}`);

      const seed = getSeed();
      const b = spawnBall(seed, nonce);
      b.bet = bet;
      balls.push(b);
      nonce += 1;
      saveNonce();
      renderNonceHint();
    }

    function finishBall(b, slotIdx) {
      highlight = slotIdx;

      const m = Number(multipliers[slotIdx] ?? 0);
      const win = Math.floor((b.bet || 0) * m);
      const profit = win - (b.bet || 0);

      balanceApi.set(balanceApi.get() + win);
      setBalanceUI();

      history.unshift({ m, p: profit });
      while (history.length > 5) history.pop();
      saveHistory();
      renderHistory();

      setStatus("Finished", profit >= 0 ? "win" : "lose");
      const mTxt = m.toFixed(m >= 10 ? 0 : 1);
      setHint(
        profit >= 0
          ? `Win: +${fmt(profit)} (x${mTxt}) • Slot ${slotIdx + 1}/${slotsCount}`
          : `Loss: ${fmt(profit)} (x${mTxt}) • Slot ${slotIdx + 1}/${slotsCount}`
      );
      toast(`x${mTxt}`, `Seed: ${String(b.seedUsed || "").slice(0, 14)}… • Nonce: ${b.nonce}`);
      if (!balls.length) setStatus("Waiting", "");
    }

    function collideSideWalls(ball) {
      if (!triangle || ball.inSlot) return;
      // Only apply while within the pyramid vertical range (plus a small slack).
      if (ball.y < triangle.apex.y - 90 * dpr || ball.y > triangle.bottomY + 10 * dpr) return;

        function resolveWall(wall) {
          const xOn = wallXAtY(wall, ball.y);
          const outside = wall.side === "left" ? ball.x - ball.r < xOn : ball.x + ball.r > xOn;
          if (!outside) return;

        // Push inside using the wall normal (triangle walls are "hard" boundaries).
        const dx = ball.x - wall.x1;
        const dy = ball.y - wall.y1;
        const dist = dx * wall.nx + dy * wall.ny; // positive inside
        const pen = ball.r - dist;
        if (pen > 0) {
          ball.x += wall.nx * pen;
          ball.y += wall.ny * pen;
        } else {
          ball.x = wall.side === "left" ? xOn + ball.r : xOn - ball.r;
        }

        const restitution = 0.72;
        const vdot = ball.vx * wall.nx + ball.vy * wall.ny;
        if (vdot < 0) {
          ball.vx -= (1 + restitution) * vdot * wall.nx;
          ball.vy -= (1 + restitution) * vdot * wall.ny;
        }

          // Small tangential friction + micro-chaos to avoid "wall riding".
          ball.vx *= 0.99;
          ball.vy *= 0.997;
          const rrng = makeRngFromSeed(`${ball.seedUsed}::wall::${ball.nonce}::${wall.side}::${Math.floor(ball.y)}`);
          ball.vx += (rrng() - 0.5) * 4.8 * dpr;
        }

      resolveWall(triangle.left);
      resolveWall(triangle.right);
    }

    function step(dt) {
      if (!balls.length) return;

      const w = canvas.width;
      const h = canvas.height;
      const padX = Math.floor(14 * dpr);
      const slotTop = canvas.height - Math.floor(46 * dpr);
      const slotBottom = slotTop + Math.max(28 * dpr, Math.floor(h * 0.11));
      const g = 1350 * dpr; // px/s^2 (slower)
      const slotW = (w - padX * 2) / slotsCount;

      // Substeps improve collision stability and reduce tunneling on slower frames.
      const subSteps = clamp(Math.ceil(dt / 0.010), 1, 4);
      const sdt = dt / subSteps;

      for (let si = 0; si < subSteps; si++) {
        for (let bi = balls.length - 1; bi >= 0; bi--) {
          const ball = balls[bi];
          ball.vy += (ball.inSlot ? g * 0.55 : g) * sdt;

          ball.x += ball.vx * sdt;
          ball.y += ball.vy * sdt;

          // Outer walls (absolute board bounds)
          if (ball.x - ball.r < padX) {
            ball.x = padX + ball.r;
            ball.vx = Math.abs(ball.vx) * 0.72;
          }
          if (ball.x + ball.r > w - padX) {
            ball.x = w - padX - ball.r;
            ball.vx = -Math.abs(ball.vx) * 0.72;
          }

          // Pyramid side walls keep the ball inside the peg field.
          collideSideWalls(ball);

          // Peg collisions (skip when deep in slot area)
          if (!ball.inSlot) {
            const restitution = 0.80;
            // Only check pegs near current y (1-2 rows around) for performance stability.
            const rowGuess = geom ? Math.round((ball.y - geom.pegAreaTop) / geom.gapY) - 1 : 0;
            const r0 = clamp(rowGuess - 1, 0, (geom?.rows || 1) - 1);
            const r1 = clamp(rowGuess + 1, 0, (geom?.rows || 1) - 1);
            for (let rrIdx = r0; rrIdx <= r1; rrIdx++) {
              const row = pegsByRow[rrIdx] || [];
              for (let i = 0; i < row.length; i++) {
                const p = row[i];
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

                  // Deterministic micro-jitter based on seed+nonce+row+peg (not frame-rate dependent).
                  const rrng = makeRngFromSeed(`${ball.seedUsed}::jitter::${ball.nonce}::${p.row}::${i}`);
                  ball.vx += (rrng() - 0.5) * 5.5 * dpr;
                  ball.vy += (rrng() - 0.5) * 2.0 * dpr;
                }
              }
            }
          }

          // Damping (more horizontal damping)
          ball.vx *= ball.inSlot ? 0.985 : 0.992;
          ball.vy *= ball.inSlot ? 0.992 : 0.996;

          // Cap speed to keep the motion clean (Stake-like).
          const maxVx = 1200 * dpr;
          const maxVy = 2200 * dpr;
          ball.vx = clamp(ball.vx, -maxVx, maxVx);
          ball.vy = clamp(ball.vy, -maxVy, maxVy);

          // Anti-stall: if the ball is hovering in the peg field with very low speed, nudge it down.
          if (!ball.inSlot && geom && ball.y > geom.pegAreaTop && Math.abs(ball.vx) + Math.abs(ball.vy) < 28 * dpr) {
            ball.vy += 160 * dpr * sdt;
          }

          // Gentle deterministic steering towards preselected target slot after most pegs are passed.
          // Keeps distribution binomial and guarantees a finish without obvious "magnet" behavior.
          if (!ball.inSlot && geom) {
            const steerStartY = geom.pegAreaTop + geom.gapY * (geom.rows * 0.70);
            if (ball.y > steerStartY && ball.y < slotTop - 6 * dpr) {
              const tx = padX + (ball.targetSlot + 0.5) * slotW;
              const dx = tx - ball.x;
              const pull = clamp(dx / (slotW * 6), -1, 1);
              ball.vx += pull * 42 * dpr * sdt;
              ball.vx *= 0.999;
            }
          }

          // Enter slot zone
          if (!ball.inSlot && ball.y + ball.r >= slotTop) {
            ball.inSlot = true;
            ball.enterAt = performance.now();
            ball.slotIdx = clamp(Math.floor((ball.x - padX) / slotW), 0, slotsCount - 1);
            // Nudge slightly inside slot
            ball.y = slotTop - ball.r;
            ball.vy *= 0.55;
          }

          // Slot settling physics
          if (ball.inSlot) {
            // Once the ball is in the slot zone, it should stay within its divider walls.
            const left = padX + ball.slotIdx * slotW;
            const right = left + slotW;

            if (ball.x - ball.r < left) {
              ball.x = left + ball.r;
              ball.vx = Math.abs(ball.vx) * 0.55;
              if (ball.slotIdx > 0) ball.slotIdx -= 1;
            }
            if (ball.x + ball.r > right) {
              ball.x = right - ball.r;
              ball.vx = -Math.abs(ball.vx) * 0.55;
              if (ball.slotIdx < slotsCount - 1) ball.slotIdx += 1;
            }

            // Bias inside slot zone towards preselected target slot (subtle).
            if (Number.isFinite(ball.targetSlot) && ball.slotIdx !== ball.targetSlot) {
              const tx = padX + (ball.targetSlot + 0.5) * slotW;
              const dx = tx - ball.x;
              const pull = clamp(dx / (slotW * 2.6), -1, 1);
              ball.vx += pull * 220 * dpr * sdt;
            }

            // Floor
            if (ball.y + ball.r > slotBottom) {
              ball.y = slotBottom - ball.r;
              ball.vy = -Math.abs(ball.vy) * 0.35;
              ball.vx *= 0.75;
              ball.settle += 1;
            }

            // Finish when mostly settled or after timeout in slot zone
            const tooLong = performance.now() - ball.enterAt > 1000;
            const slow = Math.abs(ball.vy) < 40 * dpr && Math.abs(ball.vx) < 35 * dpr;
            if (ball.settle >= 2 && slow) {
              balls.splice(bi, 1);
              finishBall(ball, clamp(ball.slotIdx, 0, slotsCount - 1));
            } else if (tooLong) {
              balls.splice(bi, 1);
              finishBall(ball, clamp(Number(ball.targetSlot) || ball.slotIdx, 0, slotsCount - 1));
            }
          }

          // Extra safety: if something goes weird, force finish after a hard timeout.
          if (!ball.inSlot && performance.now() - (ball.spawnAt || 0) > 6500) {
            balls.splice(bi, 1);
            finishBall(ball, clamp(Number(ball.targetSlot) || 0, 0, slotsCount - 1));
          }

          // Safety: fell out
          if (ball.y - ball.r > h + 220 * dpr) {
            balls.splice(bi, 1);
            const idx = clamp(Math.floor((ball.x - padX) / slotW), 0, slotsCount - 1);
            finishBall(ball, idx);
          }
        }
      }

      if (balls.length) setStatus(`Running (${balls.length})`, "run");
      else setStatus("Waiting", "");
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

      // Subtle in-canvas vignette (board has CSS felt background; this adds depth).
      ctx.save();
      const vg = ctx.createRadialGradient(w * 0.5, h * 0.25, Math.max(10, w * 0.05), w * 0.5, h * 0.55, Math.max(w, h) * 0.85);
      vg.addColorStop(0, "rgba(0,0,0,0.00)");
      vg.addColorStop(1, "rgba(0,0,0,0.40)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Pyramid rails (thin, classy).
      if (triangle) {
        ctx.save();
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.shadowColor = "rgba(0,234,255,0.12)";
        ctx.shadowBlur = 18 * dpr;
        ctx.beginPath();
        ctx.moveTo(triangle.apex.x, triangle.apex.y);
        ctx.lineTo(triangle.left.x2, triangle.left.y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(triangle.apex.x, triangle.apex.y);
        ctx.lineTo(triangle.right.x2, triangle.right.y2);
        ctx.stroke();
        ctx.restore();
      }

      // Pegs: metallic pins with glow
      ctx.save();
      for (const p of pegs) {
        const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, Math.max(1, p.r * 0.2), p.x, p.y, Math.max(1, p.r * 1.25));
        g.addColorStop(0, "rgba(255,255,255,0.98)");
        g.addColorStop(0.45, "rgba(255,255,255,0.72)");
        g.addColorStop(1, "rgba(210,220,240,0.18)");
        ctx.fillStyle = g;
        ctx.shadowColor = "rgba(255,255,255,0.18)";
        ctx.shadowBlur = 12 * dpr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(0,0,0,0.30)";
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }
      ctx.restore();

      // Pyramid outline (subtle)
      // (No explicit triangle lines — matches Stake screenshot vibe)

      // Balls: red glowing
      if (balls.length) {
        for (const ball of balls) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
          const bg = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, Math.max(1, ball.r * 0.2), ball.x, ball.y, Math.max(1, ball.r * 1.35));
          bg.addColorStop(0, "rgba(255,255,255,0.92)");
          bg.addColorStop(0.18, "rgba(255,140,170,0.92)");
          bg.addColorStop(0.62, "rgba(255, 40, 70, 0.98)");
          bg.addColorStop(1, "rgba(70, 0, 20, 0.95)");
          ctx.fillStyle = bg;
          ctx.shadowColor = "rgba(255, 40, 70, 0.45)";
          ctx.shadowBlur = 28 * dpr;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Slots + labels
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelSize = Math.max(11 * dpr, Math.min(18 * dpr, slotRects[0]?.w * 0.24));
      ctx.font = `1000 ${Math.floor(labelSize)}px "Space Grotesk", system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      for (let i = 0; i < slotRects.length; i++) {
        const r = slotRects[i];
        const m = Number(multipliers[i] ?? 0);
        const col = slotColor(m);
        const hi = i === highlight;

        // Box
        ctx.shadowColor = hi ? "rgba(0,255,136,0.35)" : col.glow;
        ctx.shadowBlur = (hi ? 26 : 18) * dpr;
        const gx = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        if (hi) {
          gx.addColorStop(0, "rgba(0,255,136,0.98)");
          gx.addColorStop(1, "rgba(0,255,136,0.62)");
        } else {
          gx.addColorStop(0, col.fill);
          gx.addColorStop(1, col.fill.replace("0.92", "0.70"));
        }
        ctx.fillStyle = gx;
        const rr = 8 * dpr;
        roundRect(ctx, r.x + 2 * dpr, r.y + 2 * dpr, r.w - 4 * dpr, r.h - 4 * dpr, rr);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        // Top highlight
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "rgba(255,255,255,1)";
        roundRect(ctx, r.x + 5 * dpr, r.y + 5 * dpr, r.w - 10 * dpr, Math.max(3 * dpr, r.h * 0.16), rr);
        ctx.fill();
        ctx.restore();

        // Text (cleaner + subtle outline)
        const txt = `x${m >= 10 ? m.toFixed(0) : m.toFixed(1)}`;
        ctx.lineWidth = 4 * dpr;
        ctx.strokeStyle = "rgba(0,0,0,0.38)";
        ctx.strokeText(txt, r.x + r.w / 2, r.y + r.h / 2);
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2);
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
    if (seedEl) {
      seedEl.addEventListener("input", () => {
        seedValue = (seedEl.value || "").trim();
        try {
          localStorage.setItem(SEED_KEY, seedValue);
        } catch {}
      });
    }
    if (newSeedBtn) {
      newSeedBtn.addEventListener("click", () => {
        setSeed(randomSeedText());
        nonce = 0;
        saveNonce();
        renderNonceHint();
      });
    }
    window.addEventListener("resize", () => setup());

    setBalanceUI();
    setSeed(loadSeed());
    renderNonceHint();
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
