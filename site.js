// Plain JS (no framework). Uses:
// - window.sb (Supabase client from supabase.js)
// - profiles table (id,email,balance,created_at)

(function () {
  const POCKETS = [
    { n: 0, c: "green" },
    { n: 1, c: "red" },
    { n: 2, c: "black" },
    { n: 3, c: "red" },
    { n: 4, c: "black" },
    { n: 5, c: "red" },
    { n: 6, c: "black" },
    { n: 7, c: "red" },
    { n: 8, c: "black" },
    { n: 9, c: "red" },
    { n: 10, c: "black" },
    { n: 11, c: "black" },
    { n: 12, c: "red" },
    { n: 13, c: "black" },
    { n: 14, c: "red" },
  ];

  const PAYOUT = {
    color: { red: 2, black: 2, green: 14 },
    number: 14,
  };

  const STATE = {
    user: null,
    balance: 5000,
    betAmount: 100,
    roulette: {
      spinning: false,
      bet: { type: "color", value: "red" },
      history: [],
      trackOffset: 0,
    },
    mines: {
      size: 5,
      mines: 4,
      bet: 100,
      lastBet: 100,
      active: false,
      bombs: [],
      opened: [],
      cashoutMultiplier: 1,
    },
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function fmt(n) {
    const x = Number(n) || 0;
    return x.toLocaleString("en-US");
  }

  function setMsg(el, text, kind) {
    el.textContent = text || "";
    el.classList.remove("err", "ok");
    if (kind) el.classList.add(kind);
  }

  function playTick(ms) {
    // Small “tick” sound using WebAudio (no external assets).
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 900;
      g.gain.value = 0.02;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, ms);
    } catch {
      // ignore
    }
  }

  function playStop() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 220;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 90);
    } catch {}
  }

  async function requireAuth() {
    const sb = window.sb;
    if (!sb) {
      window.location.href = "./index.html";
      return null;
    }

    const { data } = await sb.auth.getSession();
    if (!data.session) {
      window.location.href = "./index.html";
      return null;
    }
    return data.session.user;
  }

  async function loadBalance(userId) {
    const sb = window.sb;
    try {
      const { data: profile, error } = await sb
        .from("profiles")
        .select("balance")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      const bal = Number(profile?.balance);
      if (Number.isFinite(bal) && bal >= 0) return bal;
      return 5000;
    } catch (e) {
      const msg = e?.message || "";
      // If balance column missing, fallback to local balance.
      if (msg.includes("column") && msg.includes("balance") && msg.includes("does not exist")) return 5000;
      return 5000;
    }
  }

  let persistTimer = 0;
  function persistBalanceDebounced() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      const sb = window.sb;
      if (!sb || !STATE.user) return;
      try {
        await sb.from("profiles").update({ balance: STATE.balance }).eq("id", STATE.user.id);
      } catch {
        // ignore
      }
    }, 350);
  }

  async function isAdmin() {
    try {
      const { data } = await window.sb.rpc("is_admin");
      return Boolean(data);
    } catch {
      return false;
    }
  }

  function setBalance(next) {
    const n = Math.max(0, Math.floor(Number(next) || 0));
    STATE.balance = n;
    qs("balanceValue").textContent = fmt(n);
    persistBalanceDebounced();
  }

  function setUserId(text) {
    qs("userIdValue").textContent = text || "-";
  }

  function switchView(view) {
    for (const v of document.querySelectorAll(".view")) v.classList.remove("active");
    qs(view).classList.add("active");

    for (const t of document.querySelectorAll(".tab")) t.classList.remove("active");
    qs(`tab_${view}`).classList.add("active");
  }

  // ---- Roulette ----
  function renderHistory() {
    const host = qs("rouletteHistory");
    host.innerHTML = "";
    for (const h of STATE.roulette.history.slice(0, 12)) {
      const div = document.createElement("div");
      div.className = `hist ${h.c}`;
      div.textContent = String(h.n);
      host.appendChild(div);
    }
  }

  function renderBetSelection() {
    // Colors
    const bet = STATE.roulette.bet;
    for (const btn of document.querySelectorAll("[data-r-color]")) {
      btn.classList.toggle("active", bet.type === "color" && bet.value === btn.dataset.rColor);
    }
    const label = bet.type === "color" ? "Color" : "Number";
    qs("rouletteBetType").textContent = label;
    qs("rouletteColorBox").style.display = bet.type === "color" ? "block" : "none";
    qs("rouletteNumberBox").style.display = bet.type === "number" ? "block" : "none";
  }

  function buildTrack(targetPocket) {
    const track = qs("rouletteTrack");
    track.innerHTML = "";

    // Create a long sequence so the animation looks “real”.
    const seq = [];
    for (let i = 0; i < 70; i += 1) {
      const p = POCKETS[i % POCKETS.length];
      seq.push(p);
    }

    // Choose a stop index for the target that is deep enough in the list.
    const candidates = [];
    for (let i = 25; i < seq.length; i += 1) {
      if (seq[i].n === targetPocket.n) candidates.push(i);
    }
    const stopIndex = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : 30;

    for (const p of seq) {
      const d = document.createElement("div");
      d.className = `pocket ${p.c}`;
      d.textContent = String(p.n);
      track.appendChild(d);
    }

    return { stopIndex };
  }

  function getPocketWidth() {
    const first = qs("rouletteTrack").firstElementChild;
    if (!first) return 84;
    const style = getComputedStyle(qs("rouletteTrack"));
    const gap = Number.parseFloat(style.gap || style.columnGap || "10") || 10;
    return first.getBoundingClientRect().width + gap;
  }

  async function spinRoulette() {
    if (STATE.roulette.spinning) return;
    const msgEl = qs("rouletteMsg");
    setMsg(msgEl, "", "");

    const bet = Math.max(1, Math.floor(Number(STATE.betAmount) || 1));
    if (bet > STATE.balance) return setMsg(msgEl, "Not enough balance.", "err");

    STATE.roulette.spinning = true;
    qs("rouletteSpinBtn").disabled = true;

    setBalance(STATE.balance - bet);

    const target = POCKETS[Math.floor(Math.random() * POCKETS.length)];
    const { stopIndex } = buildTrack(target);

    const track = qs("rouletteTrack");
    const windowEl = qs("rouletteWindow");

    // Reset transform
    track.style.transition = "none";
    track.style.transform = "translate3d(0,0,0)";
    void track.offsetWidth;

    // Compute target X so the chosen pocket lands at the marker.
    const itemW = getPocketWidth();
    const centerX = windowEl.clientWidth / 2;
    const pocketCenterX = itemW * stopIndex + itemW / 2 + 18; // padding-left in CSS
    const targetX = centerX - pocketCenterX;

    // Animate (spin + decel)
    const duration = 3200 + Math.floor(Math.random() * 600);
    track.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.75, 0.12, 1)`;
    track.style.transform = `translate3d(${targetX}px, 0, 0)`;

    // Tick sound while spinning (best-effort)
    const tickInterval = setInterval(() => playTick(35), 180);

    await new Promise((r) => setTimeout(r, duration + 30));
    clearInterval(tickInterval);
    playStop();

    // Resolve bet
    const b = STATE.roulette.bet;
    let win = 0;
    if (b.type === "color") {
      const payout = PAYOUT.color[b.value] || 0;
      if (target.c === b.value) win = bet * payout;
    } else {
      if (target.n === b.value) win = bet * PAYOUT.number;
    }

    if (win > 0) {
      setBalance(STATE.balance + win);
      setMsg(msgEl, `WIN +${fmt(win)} (rolled ${target.n} ${target.c})`, "ok");
    } else {
      setMsg(msgEl, `LOSE -${fmt(bet)} (rolled ${target.n} ${target.c})`, "err");
    }

    STATE.roulette.history.unshift(target);
    STATE.roulette.history = STATE.roulette.history.slice(0, 20);
    renderHistory();

    STATE.roulette.spinning = false;
    qs("rouletteSpinBtn").disabled = false;
  }

  // ---- Mines ----
  function minesKey() {
    return STATE.user ? `mines_state_${STATE.user.id}` : "mines_state";
  }

  function saveMinesState() {
    try {
      const s = STATE.mines;
      const payload = {
        size: s.size,
        mines: s.mines,
        bet: s.bet,
        lastBet: s.lastBet,
        active: s.active,
        bombs: s.bombs,
        opened: s.opened,
        cashoutMultiplier: s.cashoutMultiplier,
      };
      localStorage.setItem(minesKey(), JSON.stringify(payload));
    } catch {}
  }

  function loadMinesState() {
    try {
      const raw = localStorage.getItem(minesKey());
      if (!raw) return;
      const p = JSON.parse(raw);
      if (!p || typeof p !== "object") return;
      const size = Math.min(15, Math.max(2, Number(p.size) || 5));
      STATE.mines.size = size;
      const maxMines = size * size - 1;
      STATE.mines.mines = Math.min(maxMines, Math.max(1, Number(p.mines) || 4));
      STATE.mines.bet = Math.max(1, Math.floor(Number(p.bet) || 100));
      STATE.mines.lastBet = Math.max(1, Math.floor(Number(p.lastBet || p.bet) || 100));
      STATE.mines.active = Boolean(p.active);
      STATE.mines.bombs = Array.isArray(p.bombs) ? p.bombs : [];
      STATE.mines.opened = Array.isArray(p.opened) ? p.opened : [];
      STATE.mines.cashoutMultiplier = Number(p.cashoutMultiplier) || 1;
    } catch {}
  }

  function minesCellCount() {
    return STATE.mines.size * STATE.mines.size;
  }

  function minesMultiplier(openedCount, mineCount, size) {
    // "Fair-ish" multiplier from probability (with small house edge).
    // odds = Π (n-i)/(safe-i)
    // multiplier = odds * (1 - edge)
    const n = size * size;
    const safe = n - mineCount;
    const k = openedCount;
    const edge = 0.01;
    if (k <= 0) return 1;
    if (safe <= 0) return 1;
    if (k > safe) return 1;

    let odds = 1;
    for (let i = 0; i < k; i += 1) {
      odds *= (n - i) / (safe - i);
    }
    const mult = odds * (1 - edge);
    return Number(mult.toFixed(2));
  }

  function renderMinesStats() {
    qs("minesMinesValue").textContent = String(STATE.mines.mines);
    qs("minesOpenedValue").textContent = String(STATE.mines.opened.length);
    qs("minesMultValue").textContent = `${STATE.mines.cashoutMultiplier.toFixed(2)}x`;

    const profit = Math.max(0, Math.floor(STATE.mines.bet * STATE.mines.cashoutMultiplier) - STATE.mines.bet);
    qs("minesProfitValue").textContent = fmt(profit);

    const cashBtn = qs("minesCashoutBtn");
    if (STATE.mines.active) {
      const payout = Math.floor(STATE.mines.bet * STATE.mines.cashoutMultiplier);
      cashBtn.textContent = `Cash out (${fmt(payout)})`;
    } else {
      cashBtn.textContent = "Cash out";
    }
  }

  function renderMinesGrid() {
    const host = qs("minesGrid");
    host.style.gridTemplateColumns = `repeat(${STATE.mines.size}, minmax(0, 1fr))`;
    host.innerHTML = "";

    const cellCount = minesCellCount();
    for (let i = 0; i < cellCount; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mine-cell";
      btn.dataset.idx = String(i);
      btn.textContent = "";

      const opened = STATE.mines.opened.includes(i);
      if (opened) {
        btn.classList.add("opened");
        btn.textContent = "\uD83D\uDC8E";
      }
      if (!STATE.mines.active || opened) btn.disabled = true;
      host.appendChild(btn);
    }
  }

  function buildMinesSelectOptions() {
    const sizeSel = qs("minesGridSize");
    const minesSel = qs("minesMinesSelect");

    sizeSel.value = String(STATE.mines.size);
    const maxMines = STATE.mines.size * STATE.mines.size - 1;
    const nextMines = Math.min(maxMines, Math.max(1, STATE.mines.mines));
    STATE.mines.mines = nextMines;

    minesSel.innerHTML = "";
    for (let i = 1; i <= maxMines; i += 1) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      minesSel.appendChild(opt);
    }
    minesSel.value = String(nextMines);
    qs("minesMinesValue").textContent = String(nextMines);
  }

  function resetMinesRound() {
    STATE.mines.active = false;
    STATE.mines.bombs = [];
    STATE.mines.opened = [];
    STATE.mines.cashoutMultiplier = 1;
    qs("minesStartBtn").disabled = false;
    qs("minesCashoutBtn").disabled = true;
    qs("minesGridSize").disabled = false;
    qs("minesMinesSelect").disabled = false;
    qs("minesBetInput").disabled = false;
    qs("minesBetHalf").disabled = false;
    qs("minesBetDouble").disabled = false;
    setMsg(qs("minesMsg"), "Choose settings and press Bet.", "");
    renderMinesStats();
    renderMinesGrid();
    saveMinesState();
  }

  function startMinesRound() {
    const msgEl = qs("minesMsg");
    setMsg(msgEl, "", "");

    const bet = Math.max(1, Math.floor(Number(qs("minesBetInput").value) || 1));
    if (bet > STATE.balance) return setMsg(msgEl, "Not enough balance.", "err");

    // Deduct bet upfront.
    setBalance(STATE.balance - bet);
    STATE.mines.bet = bet;
    STATE.mines.lastBet = bet;

    STATE.mines.active = true;
    STATE.mines.opened = [];
    STATE.mines.cashoutMultiplier = 1;

    const count = minesCellCount();
    const bombs = new Set();
    while (bombs.size < STATE.mines.mines) {
      bombs.add(Math.floor(Math.random() * count));
    }
    STATE.mines.bombs = Array.from(bombs);

    qs("minesStartBtn").disabled = true;
    qs("minesCashoutBtn").disabled = false;
    qs("minesGridSize").disabled = true;
    qs("minesMinesSelect").disabled = true;
    qs("minesBetInput").disabled = true;
    qs("minesBetHalf").disabled = true;
    qs("minesBetDouble").disabled = true;
    setMsg(msgEl, "Round started. Open tiles.", "");
    renderMinesStats();
    renderMinesGrid();
    saveMinesState();
  }

  function revealAllBombs() {
    for (const cell of document.querySelectorAll(".mine-cell")) {
      const idx = Number(cell.dataset.idx);
      if (STATE.mines.bombs.includes(idx)) {
        cell.classList.add("bomb");
        cell.textContent = "\uD83D\uDCA3";
      }
      cell.disabled = true;
    }
  }

  function openMineCell(idx) {
    if (!STATE.mines.active) return;
    if (STATE.mines.opened.includes(idx)) return;

    const cell = document.querySelector(`.mine-cell[data-idx="${idx}"]`);
    if (!cell) return;

    cell.classList.add("mine-pop");
    setTimeout(() => cell.classList.remove("mine-pop"), 220);

    const isBomb = STATE.mines.bombs.includes(idx);
    if (isBomb) {
      cell.classList.add("bomb");
      cell.textContent = "\uD83D\uDCA3";
      STATE.mines.active = false;
      qs("minesCashoutBtn").disabled = true;
      qs("minesStartBtn").disabled = false;
      qs("minesGridSize").disabled = false;
      qs("minesMinesSelect").disabled = false;
      qs("minesBetInput").disabled = false;
      qs("minesBetHalf").disabled = false;
      qs("minesBetDouble").disabled = false;
      setMsg(qs("minesMsg"), "BOOM! You hit a mine.", "err");
      revealAllBombs();
      saveMinesState();
      return;
    }

    STATE.mines.opened.push(idx);
    cell.classList.add("opened");
    cell.textContent = "\uD83D\uDC8E";

    const mult = minesMultiplier(STATE.mines.opened.length, STATE.mines.mines, STATE.mines.size);
    STATE.mines.cashoutMultiplier = mult;
    renderMinesStats();
    setMsg(qs("minesMsg"), `Safe! Cash out at ${mult.toFixed(2)}x`, "ok");
    saveMinesState();
  }

  function cashoutMines() {
    if (!STATE.mines.active) return;
    STATE.mines.active = false;
    qs("minesCashoutBtn").disabled = true;
    qs("minesStartBtn").disabled = false;
    qs("minesGridSize").disabled = false;
    qs("minesMinesSelect").disabled = false;
    qs("minesBetInput").disabled = false;
    qs("minesBetHalf").disabled = false;
    qs("minesBetDouble").disabled = false;

    const win = Math.floor(STATE.mines.bet * STATE.mines.cashoutMultiplier);
    setBalance(STATE.balance + win);
    setMsg(qs("minesMsg"), `CASH OUT +${fmt(win)}`, "ok");

    // Disable further interaction
    for (const cell of document.querySelectorAll(".mine-cell")) cell.disabled = true;
    saveMinesState();
  }

  // ---- Bet stepper ----
  function setBetAmount(next) {
    const n = Math.max(1, Math.floor(Number(next) || 1));
    STATE.betAmount = n;
    qs("betValue").textContent = fmt(n);
  }

  // ---- Bootstrap ----
  async function boot() {
    STATE.user = await requireAuth();
    if (!STATE.user) return;

    setUserId(STATE.user.id);

    STATE.balance = await loadBalance(STATE.user.id);
    setBalance(STATE.balance);

    // Top buttons
    qs("logoutBtn").addEventListener("click", async () => {
      await window.sb.auth.signOut();
      window.location.href = "./index.html";
    });
    qs("profileBtn").addEventListener("click", () => (window.location.href = "./dashboard.html"));
    qs("adminBtn").addEventListener("click", () => (window.location.href = "./admin.html"));

    if (await isAdmin()) qs("adminBtn").style.display = "inline-block";

    // Tabs
    qs("tab_rouletteView").addEventListener("click", () => switchView("rouletteView"));
    qs("tab_minesView").addEventListener("click", () => switchView("minesView"));
    switchView("rouletteView");

    // Bet amount stepper (shared)
    setBetAmount(100);
    qs("betMinus").addEventListener("click", () => setBetAmount(Math.max(1, STATE.betAmount - 10)));
    qs("betPlus").addEventListener("click", () => setBetAmount(STATE.betAmount + 10));

    // Roulette bet type toggle
    qs("betTypeColor").addEventListener("click", () => {
      STATE.roulette.bet = { type: "color", value: "red" };
      renderBetSelection();
    });
    qs("betTypeNumber").addEventListener("click", () => {
      const n = Number(qs("rouletteNumber").value);
      STATE.roulette.bet = { type: "number", value: Number.isFinite(n) ? n : 0 };
      renderBetSelection();
    });

    // Roulette bets
    for (const btn of document.querySelectorAll("[data-r-color]")) {
      btn.addEventListener("click", () => {
        STATE.roulette.bet = { type: "color", value: btn.dataset.rColor };
        renderBetSelection();
      });
    }
    qs("rouletteNumber").addEventListener("change", () => {
      if (STATE.roulette.bet.type !== "number") return;
      const n = Number(qs("rouletteNumber").value);
      STATE.roulette.bet.value = Number.isFinite(n) ? n : 0;
      renderBetSelection();
    });
    qs("rouletteSpinBtn").addEventListener("click", spinRoulette);

    // Mines controls
    loadMinesState();
    qs("minesBetInput").value = String(STATE.mines.lastBet);
    qs("minesGridSize").value = String(STATE.mines.size);
    buildMinesSelectOptions();

    const lockMinesControls = (locked) => {
      qs("minesGridSize").disabled = locked;
      qs("minesMinesSelect").disabled = locked;
      qs("minesBetInput").disabled = locked;
      qs("minesBetHalf").disabled = locked;
      qs("minesBetDouble").disabled = locked;
    };

    if (STATE.mines.active && Array.isArray(STATE.mines.bombs) && STATE.mines.bombs.length) {
      qs("minesStartBtn").disabled = true;
      qs("minesCashoutBtn").disabled = false;
      lockMinesControls(true);
      qs("minesBetInput").value = String(STATE.mines.bet);
      setMsg(qs("minesMsg"), "Round restored. Continue opening tiles.", "ok");
      renderMinesStats();
      renderMinesGrid();
    } else {
      resetMinesRound();
      lockMinesControls(false);
    }

    qs("minesGridSize").addEventListener("change", () => {
      if (STATE.mines.active) return;
      const size = Math.min(15, Math.max(2, Number(qs("minesGridSize").value) || 5));
      STATE.mines.size = size;
      buildMinesSelectOptions();
      resetMinesRound();
    });

    qs("minesMinesSelect").addEventListener("change", () => {
      if (STATE.mines.active) return;
      const maxMines = STATE.mines.size * STATE.mines.size - 1;
      const mines = Math.min(maxMines, Math.max(1, Number(qs("minesMinesSelect").value) || 1));
      STATE.mines.mines = mines;
      qs("minesMinesValue").textContent = String(mines);
      resetMinesRound();
    });

    qs("minesBetInput").addEventListener("input", () => {
      if (STATE.mines.active) return;
      const bet = Math.max(1, Math.floor(Number(qs("minesBetInput").value) || 1));
      STATE.mines.lastBet = bet;
      qs("minesBetInput").value = String(bet);
      saveMinesState();
    });

    qs("minesBetHalf").addEventListener("click", () => {
      if (STATE.mines.active) return;
      const bet = Math.max(1, Math.floor((Number(qs("minesBetInput").value) || 1) / 2));
      qs("minesBetInput").value = String(bet);
      STATE.mines.lastBet = bet;
      saveMinesState();
    });
    qs("minesBetDouble").addEventListener("click", () => {
      if (STATE.mines.active) return;
      const bet = Math.max(1, Math.floor((Number(qs("minesBetInput").value) || 1) * 2));
      qs("minesBetInput").value = String(bet);
      STATE.mines.lastBet = bet;
      saveMinesState();
    });

    qs("minesStartBtn").addEventListener("click", () => {
      startMinesRound();
      lockMinesControls(true);
    });
    qs("minesCashoutBtn").addEventListener("click", () => {
      cashoutMines();
      lockMinesControls(false);
    });

    qs("minesGrid").addEventListener("click", (e) => {
      const cell = e.target && e.target.closest && e.target.closest(".mine-cell");
      if (!cell) return;
      const idx = Number(cell.dataset.idx);
      if (!Number.isFinite(idx)) return;
      openMineCell(idx);
    });

    // Initial selections
    STATE.roulette.bet = { type: "color", value: "red" };
    renderBetSelection();
    renderHistory();
    buildTrack(POCKETS[Math.floor(Math.random() * POCKETS.length)]);

    // A little help if balance column missing
    qs("balanceHint").textContent = "";
    if (qs("profileBalanceHint")) qs("profileBalanceHint").textContent = "";
  }

  window.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => {
      const msg = e?.message || "Error";
      const el = qs("globalMsg");
      if (el) setMsg(el, msg, "err");
    });
  });
})();
