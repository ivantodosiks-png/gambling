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
    for (const btn of document.querySelectorAll("[data-r-num]")) {
      btn.classList.toggle("active", bet.type === "number" && bet.value === Number(btn.dataset.rNum));
    }

    const label = bet.type === "color" ? `Color: ${bet.value}` : `Number: ${bet.value}`;
    qs("rouletteBetType").textContent = label;
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
    const stopIndex = candidates[Math.floor(Math.random() * candidates.length)];

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
      STATE.mines.size = p.size === 6 ? 6 : 5;
      STATE.mines.mines = Math.min(10, Math.max(1, Number(p.mines) || 4));
      STATE.mines.bet = Math.max(1, Math.floor(Number(p.bet) || 100));
      STATE.mines.active = Boolean(p.active);
      STATE.mines.bombs = Array.isArray(p.bombs) ? p.bombs : [];
      STATE.mines.opened = Array.isArray(p.opened) ? p.opened : [];
      STATE.mines.cashoutMultiplier = Number(p.cashoutMultiplier) || 1;
    } catch {}
  }

  function minesCellCount() {
    return STATE.mines.size * STATE.mines.size;
  }

  function minesIdxToRc(i) {
    const size = STATE.mines.size;
    return { r: Math.floor(i / size), c: i % size };
  }

  function minesMultiplier(openedCount, mineCount, size) {
    // Simple arcade-like multiplier. Not a real casino formula.
    // More mines => higher growth.
    const base = 1 + mineCount / 8;
    return Number((Math.pow(base, openedCount / 2) * 1.02).toFixed(2));
  }

  function renderMinesStats() {
    qs("minesSizeValue").textContent = `${STATE.mines.size}x${STATE.mines.size}`;
    qs("minesMinesValue").textContent = String(STATE.mines.mines);
    qs("minesBetValue").textContent = fmt(STATE.mines.bet);
    qs("minesOpenedValue").textContent = String(STATE.mines.opened.length);
    qs("minesMultValue").textContent = `${STATE.mines.cashoutMultiplier.toFixed(2)}x`;
  }

  function renderMinesGrid() {
    const host = qs("minesGrid");
    host.style.gridTemplateColumns = `repeat(${STATE.mines.size}, 1fr)`;
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
        btn.textContent = "💎";
      }
      if (!STATE.mines.active || opened) btn.disabled = true;
      host.appendChild(btn);
    }
  }

  function resetMinesRound() {
    STATE.mines.active = false;
    STATE.mines.bombs = [];
    STATE.mines.opened = [];
    STATE.mines.cashoutMultiplier = 1;
    qs("minesStartBtn").disabled = false;
    qs("minesCashoutBtn").disabled = true;
    setMsg(qs("minesMsg"), "Set mines and press Start.", "");
    renderMinesStats();
    renderMinesGrid();
    saveMinesState();
  }

  function startMinesRound() {
    const msgEl = qs("minesMsg");
    setMsg(msgEl, "", "");

    const bet = Math.max(1, Math.floor(Number(STATE.mines.bet) || 1));
    if (bet > STATE.balance) return setMsg(msgEl, "Not enough balance.", "err");

    // Deduct bet upfront.
    setBalance(STATE.balance - bet);

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
        cell.textContent = "💣";
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
      cell.textContent = "💣";
      STATE.mines.active = false;
      qs("minesCashoutBtn").disabled = true;
      setMsg(qs("minesMsg"), "BOOM! You hit a mine.", "err");
      revealAllBombs();
      saveMinesState();
      return;
    }

    STATE.mines.opened.push(idx);
    cell.classList.add("opened");
    cell.textContent = "💎";

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

  function setMinesBet(next) {
    const n = Math.max(1, Math.floor(Number(next) || 1));
    STATE.mines.bet = n;
    qs("minesBetValue").textContent = fmt(n);
    saveMinesState();
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

    // Roulette bets
    for (const btn of document.querySelectorAll("[data-r-color]")) {
      btn.addEventListener("click", () => {
        STATE.roulette.bet = { type: "color", value: btn.dataset.rColor };
        renderBetSelection();
      });
    }
    for (const btn of document.querySelectorAll("[data-r-num]")) {
      btn.addEventListener("click", () => {
        STATE.roulette.bet = { type: "number", value: Number(btn.dataset.rNum) };
        renderBetSelection();
      });
    }
    qs("rouletteSpinBtn").addEventListener("click", spinRoulette);

    // Mines controls
    loadMinesState();
    renderMinesStats();
    renderMinesGrid();
    resetMinesRound();

    qs("minesSizeMinus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      STATE.mines.size = 5;
      resetMinesRound();
    });
    qs("minesSizePlus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      STATE.mines.size = 6;
      resetMinesRound();
    });
    qs("minesMinesMinus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      STATE.mines.mines = Math.max(1, STATE.mines.mines - 1);
      resetMinesRound();
    });
    qs("minesMinesPlus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      STATE.mines.mines = Math.min(10, STATE.mines.mines + 1);
      resetMinesRound();
    });

    qs("minesBetMinus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      setMinesBet(Math.max(1, STATE.mines.bet - 10));
      renderMinesStats();
    });
    qs("minesBetPlus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      setMinesBet(STATE.mines.bet + 10);
      renderMinesStats();
    });

    qs("minesStartBtn").addEventListener("click", startMinesRound);
    qs("minesCashoutBtn").addEventListener("click", cashoutMines);
    qs("minesResetBtn").addEventListener("click", () => {
      resetMinesRound();
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
