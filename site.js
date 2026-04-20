// Plain JS (no framework). Uses:
// - window.sb (Supabase client from supabase.js)
// - profiles table (id,email,balance,created_at)

(function () {
  // European roulette order (single zero), used for the wheel animation.
  const EURO_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];

  const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ]);

  function pocketColor(n) {
    if (n === 0) return "green";
    return RED_NUMBERS.has(n) ? "red" : "black";
  }

  const POCKETS = EURO_ORDER.map((n) => ({ n, c: pocketColor(n) }));

  const PAYOUT = {
    number: 36,
    color: 2,
    evenOdd: 2,
    lowHigh: 2,
    dozen: 3,
  };

  const STATE = {
    user: null,
    balance: 5000,
    betAmount: 100,
    roulette: {
      spinning: false,
      wheelDeg: 0,
      chipValue: 10,
      bets: {}, // { [betKey]: amount }
      history: [],
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

  const BALANCE_LS_PREFIX = "casino_balance_v1:";

  function balanceStorageKey(userId) {
    const uid = String(userId || "").trim();
    return uid ? `${BALANCE_LS_PREFIX}${uid}` : `${BALANCE_LS_PREFIX}unknown`;
  }

  function loadBalanceFromLocalStorage(userId) {
    try {
      const raw = localStorage.getItem(balanceStorageKey(userId));
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
      return null;
    } catch {
      return null;
    }
  }

  function persistBalanceToLocalStorage(userId, balance) {
    try {
      localStorage.setItem(balanceStorageKey(userId), String(Math.max(0, Math.floor(Number(balance) || 0))));
    } catch {
      // ignore
    }
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
    // Small вЂњtickвЂќ sound using WebAudio (no external assets).
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

  async function ensureProfile(user) {
    const sb = window.sb;
    if (!sb || !user?.id) return null;

    try {
      const { data: profile, error } = await sb.from("profiles").select("id,email,username,balance,created_at").eq("id", user.id).maybeSingle();
      if (error) throw error;
      if (profile) return profile;

      const email = String(user.email || "").trim();
      const usernameFromEmail = email && email.includes("@") ? email.split("@")[0].slice(0, 24) : "";
      const username = String(user.user_metadata?.username || usernameFromEmail || "").trim().slice(0, 24) || null;

      const row = { id: user.id, email: email || "unknown@email.com", username, balance: 5000 };
      const { data: created, error: insertError } = await sb.from("profiles").insert([row]).select("id,email,username,balance,created_at").single();
      if (insertError) throw insertError;
      return created || null;
    } catch {
      // If table/columns are missing, or insert is blocked, just continue with local defaults.
      return null;
    }
  }

  async function loadBalance(userId) {
    const local = loadBalanceFromLocalStorage(userId);
    if (typeof local === "number") return local;

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
    if (STATE.user?.id) persistBalanceToLocalStorage(STATE.user.id, n);
    persistBalanceDebounced();
  }

  // Expose minimal balance API for mini-games (e.g. Crash modal).
  // Keeps Supabase persistence behavior via existing `setBalance`.
  window.casinoBalance = {
    get: () => STATE.balance,
    set: (next) => setBalance(next),
  };

  function setUserId(text) {
    qs("userIdValue").textContent = text || "-";
  }

  function switchView(view) {
    for (const v of document.querySelectorAll(".view")) v.classList.remove("active");
    qs(view).classList.add("active");

    for (const t of document.querySelectorAll(".tab")) t.classList.remove("active");
    qs(`tab_${view}`).classList.add("active");

    // Re-measure layouts after switching tabs (hidden elements report 0 sizes).
    if (view === "minesView") setTimeout(() => renderMinesGrid(), 0);
    if (view === "rouletteView") setTimeout(() => buildWheel(), 0);
  }
  // ---- Roulette ----
  function fmtCompact(n) {
    const x = Math.floor(Number(n) || 0);
    if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(x % 1_000_000 === 0 ? 0 : 1)}m`;
    if (x >= 1_000) return `${(x / 1_000).toFixed(x % 1_000 === 0 ? 0 : 1)}k`;
    return String(x);
  }

  function rouletteTotalBet() {
    const bets = STATE.roulette.bets || {};
    let sum = 0;
    for (const k of Object.keys(bets)) sum += Number(bets[k]) || 0;
    return Math.max(0, Math.floor(sum));
  }

  function rouletteBetsCount() {
    const bets = STATE.roulette.bets || {};
    return Object.keys(bets).filter((k) => (Number(bets[k]) || 0) > 0).length;
  }

  function renderHistory() {
    const host = qs("rouletteHistory");
    host.innerHTML = "";
    const list = STATE.roulette.history.slice(0, 12);
    for (let i = 0; i < list.length; i += 1) {
      const h = list[i];
      const div = document.createElement("div");
      div.className = `hist ${h.c}`;
      div.textContent = String(h.n);
      div.classList.add("in");
      div.style.animationDelay = `${Math.min(160, i * 22)}ms`;
      host.appendChild(div);
    }
  }

  function renderRouletteSummary() {
    qs("rouletteTotalBet").textContent = fmt(rouletteTotalBet());
    qs("rouletteBetsCount").textContent = String(rouletteBetsCount());
  }

  function setChipValue(next) {
    const v = Math.max(1, Math.floor(Number(next) || 1));
    STATE.roulette.chipValue = v;
    const inp = qs("rouletteChipInput");
    if (inp) inp.value = String(v);

    for (const b of document.querySelectorAll("#rouletteChipRow [data-chip]")) {
      b.classList.toggle("active", Number(b.dataset.chip) === v);
    }
  }

  function buildWheel() {
    const ring = qs("wheelRing");
    const labels = qs("wheelLabels");
    const rotor = qs("wheelRotor");
    const wheel = document.querySelector(".roulette-wheel");
    if (!ring || !labels || !rotor) return;

    const slot = 360 / POCKETS.length;
    const w = wheel ? wheel.getBoundingClientRect().width : 360;
    // Place labels on the rim (inside the thick border). Using a proportional radius is
    // more stable than trying to infer CSS border widths.
    const labelRadius = Math.max(100, w * 0.35);

    const stops = [];
    for (let i = 0; i < POCKETS.length; i += 1) {
      const p = POCKETS[i];
      const start = i * slot;
      const end = (i + 1) * slot;
      // Slightly lift "black" so dark text is still readable (user request).
      // Classic roulette colors (more "true" red/black/green).
      const col =
        p.c === "red"
          ? "rgba(232, 59, 87, 0.98)"
          : p.c === "black"
            ? "rgba(12, 16, 32, 0.98)"
            : "rgba(34, 197, 94, 0.98)";
      stops.push(`${col} ${start}deg ${end}deg`);
    }
    // Align pocket 0 to the top (ball position).
    ring.style.background = `conic-gradient(from 0deg, ${stops.join(",")})`;

    labels.innerHTML = "";
    for (let i = 0; i < POCKETS.length; i += 1) {
      const p = POCKETS[i];
      const a = i * slot + slot / 2;
      const d = document.createElement("div");
      d.className = `wheel-label ${p.c}`;
      d.textContent = String(p.n);
      d.style.transform = `translate(-50%, -50%) rotate(${a}deg) translateY(-${labelRadius}px) rotate(${-a}deg)`;
      labels.appendChild(d);
    }

    rotor.style.transition = "none";
    rotor.style.transform = `rotate(${STATE.roulette.wheelDeg || 0}deg)`;
    void rotor.offsetWidth;

    // Place ball at the top on initial render.
    const outerR = Math.max(104, w * 0.34);
    setWheelBall(0, outerR);
  }

  let ballRaf = 0;
  function setWheelBall(angleDeg, radiusPx) {
    const ball = qs("wheelBall");
    if (!ball) return;
    const a = (Number(angleDeg) || 0) * (Math.PI / 180);
    const r = Number(radiusPx) || 0;
    const x = Math.sin(a) * r;
    const y = -Math.cos(a) * r;
    ball.style.transform = `translate(-50%, -50%) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateWheelBall(durationMs) {
    cancelAnimationFrame(ballRaf);
    const wheel = document.querySelector(".roulette-wheel");
    const w = wheel ? wheel.getBoundingClientRect().width : 360;
    const outerR = Math.max(104, w * 0.34);
    const innerR = Math.max(84, w * 0.28);

    const spinsBall = 12 + Math.floor(Math.random() * 4);
    const startAngle = spinsBall * 360 + Math.floor(Math.random() * 180);
    const endAngle = 0;

    const t0 = performance.now();
    const dropAt = 0.78; // last part: ball drops into the pocket ring

    const ball = qs("wheelBall");
    if (ball) ball.classList.add("fast");

    const frame = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / Math.max(1, durationMs)));
      const e = easeOutCubic(p);

      // Ball runs opposite direction (looks more "real").
      const baseAng = startAngle * (1 - e) + endAngle * e;
      // Subtle wobble (fades out) for more "physics".
      const wobble = Math.sin(p * 14 * Math.PI) * (1 - p) * 1.6;
      const ang = baseAng + wobble;

      let r = outerR;
      if (p > dropAt) {
        const t = (p - dropAt) / (1 - dropAt);
        const ee = easeOutCubic(t);
        // Add a tiny bounce at the end of the drop.
        const bounce = Math.sin(Math.min(1, t) * Math.PI) * 3.5;
        // Tiny radial jitter while dropping into the pocket ring.
        const jitter = Math.sin((t * 22) * Math.PI) * (1 - t) * 1.2;
        r = outerR * (1 - ee) + innerR * ee + bounce + jitter;
      }

      setWheelBall(ang, r);

      if (ball) {
        if (p > 0.9) ball.classList.remove("fast");
      }

      if (p < 1) ballRaf = requestAnimationFrame(frame);
      else {
        if (ball) ball.classList.remove("fast");
        setWheelBall(0, innerR);
      }
    };
    ballRaf = requestAnimationFrame(frame);
  }

  function makeBetButton(text, betKey, extraClass) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `rbet ${extraClass || ""}`.trim();
    b.dataset.bet = betKey;
    b.textContent = text;
    return b;
  }

  function buildRouletteTable() {
    const host = qs("rouletteTable");
    if (!host) return;
    host.innerHTML = "";

    const top = document.createElement("div");
    top.className = "rt-grid rt-top";

    const zero = makeBetButton("0", "n:0", "green tall");
    top.appendChild(zero);

    // 3 rows x 12 columns like Stake
    for (let col = 0; col < 12; col += 1) {
      const nTop = 3 + col * 3;
      const nMid = 2 + col * 3;
      const nBot = 1 + col * 3;
      const btnTop = makeBetButton(String(nTop), `n:${nTop}`, pocketColor(nTop));
      const btnMid = makeBetButton(String(nMid), `n:${nMid}`, pocketColor(nMid));
      const btnBot = makeBetButton(String(nBot), `n:${nBot}`, pocketColor(nBot));
      btnTop.style.gridRow = "1";
      btnMid.style.gridRow = "2";
      btnBot.style.gridRow = "3";
      btnTop.style.gridColumn = String(col + 2);
      btnMid.style.gridColumn = String(col + 2);
      btnBot.style.gridColumn = String(col + 2);
      top.appendChild(btnTop);
      top.appendChild(btnMid);
      top.appendChild(btnBot);
    }

    host.appendChild(top);

    const dozens = document.createElement("div");
    dozens.className = "rt-grid rt-dozens";
    const spacer1 = document.createElement("div");
    spacer1.className = "rt-spacer";
    dozens.appendChild(spacer1);

    const d1 = makeBetButton("1 to 12", "dozen:1", "outside");
    const d2 = makeBetButton("13 to 24", "dozen:2", "outside");
    const d3 = makeBetButton("25 to 36", "dozen:3", "outside");
    d1.style.gridColumn = "2 / span 4";
    d2.style.gridColumn = "6 / span 4";
    d3.style.gridColumn = "10 / span 4";
    dozens.appendChild(d1);
    dozens.appendChild(d2);
    dozens.appendChild(d3);
    host.appendChild(dozens);

    const outs = document.createElement("div");
    outs.className = "rt-grid rt-outs";
    const spacer2 = document.createElement("div");
    spacer2.className = "rt-spacer";
    outs.appendChild(spacer2);

    const low = makeBetButton("1 to 18", "low", "outside");
    const even = makeBetButton("Even", "even", "outside");
    const red = makeBetButton("Red", "color:red", "outside red");
    const black = makeBetButton("Black", "color:black", "outside black");
    const odd = makeBetButton("Odd", "odd", "outside");
    const high = makeBetButton("19 to 36", "high", "outside");

    // 6 buttons, each spans 2 number-columns (total 12)
    const outBtns = [low, even, red, black, odd, high];
    for (let i = 0; i < outBtns.length; i += 1) {
      outBtns[i].style.gridColumn = `${2 + i * 2} / span 2`;
      outs.appendChild(outBtns[i]);
    }

    host.appendChild(outs);

    host.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest && e.target.closest("button[data-bet]");
      if (!btn) return;
      placeRouletteBet(btn.dataset.bet);
    });
  }

  function renderRouletteBets() {
    const bets = STATE.roulette.bets || {};
    for (const btn of document.querySelectorAll("#rouletteTable button[data-bet]")) {
      const key = btn.dataset.bet;
      const amt = Math.floor(Number(bets[key]) || 0);
      let chip = btn.querySelector(":scope > .chip-on");
      if (amt <= 0) {
        if (chip) chip.remove();
        btn.classList.remove("has-chip");
        continue;
      }

      if (!chip) {
        chip = document.createElement("span");
        chip.className = "chip-on";
        chip.innerHTML = `<span class="chip-amt"></span>`;
        btn.appendChild(chip);
      }
      btn.classList.add("has-chip");
      chip.querySelector(".chip-amt").textContent = fmtCompact(amt);
    }

    renderRouletteSummary();
  }

  function placeRouletteBet(key) {
    if (STATE.roulette.spinning) return;
    const msgEl = qs("rouletteMsg");
    setMsg(msgEl, "", "");

    const chip = Math.max(1, Math.floor(Number(STATE.roulette.chipValue) || 1));
    const totalBefore = rouletteTotalBet();
    if (totalBefore + chip > STATE.balance) return setMsg(msgEl, "Not enough balance for that chip.", "err");

    const bets = STATE.roulette.bets || (STATE.roulette.bets = {});
    bets[key] = Math.floor(Number(bets[key]) || 0) + chip;
    renderRouletteBets();
  }

  function clearRouletteBets() {
    if (STATE.roulette.spinning) return;
    STATE.roulette.bets = {};
    renderRouletteBets();
    setMsg(qs("rouletteMsg"), "Bets cleared.", "");
  }

  function betMult(key, rolled) {
    if (key.startsWith("n:")) return rolled.n === Number(key.slice(2)) ? PAYOUT.number : 0;
    if (key === "color:red") return rolled.c === "red" ? PAYOUT.color : 0;
    if (key === "color:black") return rolled.c === "black" ? PAYOUT.color : 0;
    if (key === "even") return rolled.n !== 0 && rolled.n % 2 === 0 ? PAYOUT.evenOdd : 0;
    if (key === "odd") return rolled.n % 2 === 1 ? PAYOUT.evenOdd : 0;
    if (key === "low") return rolled.n >= 1 && rolled.n <= 18 ? PAYOUT.lowHigh : 0;
    if (key === "high") return rolled.n >= 19 && rolled.n <= 36 ? PAYOUT.lowHigh : 0;
    if (key === "dozen:1") return rolled.n >= 1 && rolled.n <= 12 ? PAYOUT.dozen : 0;
    if (key === "dozen:2") return rolled.n >= 13 && rolled.n <= 24 ? PAYOUT.dozen : 0;
    if (key === "dozen:3") return rolled.n >= 25 && rolled.n <= 36 ? PAYOUT.dozen : 0;
    return 0;
  }

  async function spinRoulette() {
    if (STATE.roulette.spinning) return;

    const msgEl = qs("rouletteMsg");
    setMsg(msgEl, "", "");

    const totalBet = rouletteTotalBet();
    if (totalBet <= 0) return setMsg(msgEl, "Place a bet first.", "err");
    if (totalBet > STATE.balance) return setMsg(msgEl, "Not enough balance.", "err");

    STATE.roulette.spinning = true;
    qs("rouletteSpinBtn").disabled = true;
    qs("rouletteClearBtn").disabled = true;
    document.body.classList.add("roulette-spinning");

    setBalance(STATE.balance - totalBet);

    const rotor = qs("wheelRotor");
    const slot = 360 / POCKETS.length;
    
    // Generate a random final angle where the ball will land (0-360 degrees)
    // This determines which pocket wins
    const finalBallAngle = Math.random() * 360;
    
    // Determine which pocket this angle corresponds to
    // Each pocket spans from i*slot to (i+1)*slot degrees
    const pocketIdxAtAngle = Math.floor(finalBallAngle / slot) % POCKETS.length;
    const rolled = POCKETS[pocketIdxAtAngle];

    // Slower wheel spin; ball animation runs slightly faster (see animateWheelBall).
    const spins = 4 + Math.floor(Math.random() * 3);
    const duration = 5600 + Math.floor(Math.random() * 700);

    // Rotate wheel so that the winning pocket appears where the ball will land
    // Ball lands at angle 0, so we need to rotate the wheel to align the winning pocket there
    const targetDeg = (STATE.roulette.wheelDeg || 0) + spins * 360 - finalBallAngle;
    STATE.roulette.wheelDeg = targetDeg;

    // Tick sound while spinning (simple interval)
    const tickInterval = setInterval(() => playTick(25), 140);

    if (rotor) {
      rotor.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.78, 0.10, 1)`;
      rotor.style.transform = `rotate(${targetDeg}deg)`;
    }
    animateWheelBall(duration);

    await new Promise((r) => setTimeout(r, duration + 40));
    clearInterval(tickInterval);
    playStop();

    // Tiny vibration on stop for realism.
    const wheel = document.querySelector(".roulette-wheel");
    if (wheel) {
      wheel.classList.remove("shake");
      void wheel.offsetWidth;
      wheel.classList.add("shake");
      setTimeout(() => wheel.classList.remove("shake"), 600);
    }

    // Resolve bets
    const bets = STATE.roulette.bets || {};
    let winTotal = 0;
    for (const k of Object.keys(bets)) {
      const amt = Math.floor(Number(bets[k]) || 0);
      if (amt <= 0) continue;
      const m = betMult(k, rolled);
      if (m > 0) winTotal += amt * m;
    }

    const profit = winTotal - totalBet;
    if (winTotal > 0) {
      setBalance(STATE.balance + winTotal);
      setMsg(msgEl, `WIN +${fmt(profit)} | Rolled ${rolled.n} ${rolled.c.toUpperCase()}`, "ok");
      document.body.classList.add("win-flash");
      setTimeout(() => document.body.classList.remove("win-flash"), 900);
    } else {
      setMsg(msgEl, `LOSE -${fmt(totalBet)} | Rolled ${rolled.n} ${rolled.c.toUpperCase()}`, "err");
    }

    STATE.roulette.history.unshift(rolled);
    STATE.roulette.history = STATE.roulette.history.slice(0, 20);
    renderHistory();

    // Flash the rolled number on the table
    for (const b of document.querySelectorAll("#rouletteTable .rbet")) b.classList.remove("rolled");
    const rolledBtn = document.querySelector(`#rouletteTable button[data-bet="n:${rolled.n}"]`);
    if (rolledBtn) {
      rolledBtn.classList.add("rolled");
      setTimeout(() => rolledBtn.classList.remove("rolled"), 900);
    }

    STATE.roulette.spinning = false;
    qs("rouletteSpinBtn").disabled = false;
    qs("rouletteClearBtn").disabled = false;
    document.body.classList.remove("roulette-spinning");
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
    // odds = О  (n-i)/(safe-i)
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

    // Fit the grid into the board without scrolling.
    const size = STATE.mines.size;
    const rect = host.getBoundingClientRect();
    const maxW = Math.max(120, rect.width - 4);
    const maxH = Math.max(120, rect.height - 4);
    let cell = Math.floor(Math.min(maxW / size, maxH / size));
    cell = Math.max(18, Math.min(62, cell));
    host.style.setProperty("--cell", `${cell}px`);
    host.style.gridTemplateColumns = `repeat(${size}, var(--cell))`;
    host.style.gridAutoRows = "var(--cell)";
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
        btn.textContent = "◆";
      }
      if (!STATE.mines.active || opened) btn.disabled = true;
      host.appendChild(btn);
    }
  }

  function renderMinesControls() {
    qs("minesSizeValue").textContent = `${STATE.mines.size}x${STATE.mines.size}`;
    qs("minesMinesCtrlValue").textContent = String(STATE.mines.mines);
    qs("minesMinesValue").textContent = String(STATE.mines.mines);
    const maxMines = STATE.mines.size * STATE.mines.size - 1;
    qs("minesMinesHint").textContent = `Max mines: ${maxMines}`;
  }

  function setMinesSize(next) {
    const size = Math.min(15, Math.max(2, Math.floor(Number(next) || 5)));
    STATE.mines.size = size;
    const maxMines = size * size - 1;
    STATE.mines.mines = Math.min(maxMines, Math.max(1, STATE.mines.mines));
    renderMinesControls();
  }

  function setMinesMines(next) {
    const maxMines = STATE.mines.size * STATE.mines.size - 1;
    const mines = Math.min(maxMines, Math.max(1, Math.floor(Number(next) || 1)));
    STATE.mines.mines = mines;
    renderMinesControls();
  }

  function resetMinesRound() {
    STATE.mines.active = false;
    STATE.mines.bombs = [];
    STATE.mines.opened = [];
    STATE.mines.cashoutMultiplier = 1;
    qs("minesStartBtn").disabled = false;
    qs("minesCashoutBtn").disabled = true;
    qs("minesSizeMinus").disabled = false;
    qs("minesSizePlus").disabled = false;
    qs("minesMinesMinus").disabled = false;
    qs("minesMinesPlus").disabled = false;
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
    qs("minesSizeMinus").disabled = true;
    qs("minesSizePlus").disabled = true;
    qs("minesMinesMinus").disabled = true;
    qs("minesMinesPlus").disabled = true;
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
        cell.textContent = "●";
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
      cell.textContent = "●";
      STATE.mines.active = false;
      qs("minesCashoutBtn").disabled = true;
      qs("minesStartBtn").disabled = false;
      qs("minesSizeMinus").disabled = false;
      qs("minesSizePlus").disabled = false;
      qs("minesMinesMinus").disabled = false;
      qs("minesMinesPlus").disabled = false;
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
    cell.textContent = "◆";

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
    qs("minesSizeMinus").disabled = false;
    qs("minesSizePlus").disabled = false;
    qs("minesMinesMinus").disabled = false;
    qs("minesMinesPlus").disabled = false;
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

  // ---- Bootstrap ----
  async function boot() {
    if (window.maintenanceGuard) {
      const blocked = await window.maintenanceGuard(window.sb);
      if (blocked) return;
    }

    STATE.user = await requireAuth();
    if (!STATE.user) return;

    await ensureProfile(STATE.user);

    async function ensureDisclaimerAccepted() {
      const key = "ivan_disclaimer_v1";
      try {
        if (localStorage.getItem(key) === "1") return true;
      } catch {}

      return await new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "disc-overlay";
        overlay.innerHTML = `
          <div class="disc-card" role="dialog" aria-modal="true" aria-label="Disclaimer">
            <h2 class="disc-title">Disclaimer</h2>
            <div class="disc-text">
This is a demo / simulator. It is NOT a real casino.
No real money is used. Everything is virtual coins for entertainment only.

By clicking Accept, you confirm you understand this.
            </div>
            <div class="disc-actions">
              <button type="button" id="discAcceptBtn">Accept</button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const btn = overlay.querySelector("#discAcceptBtn");
        btn.addEventListener("click", () => {
          try {
            localStorage.setItem(key, "1");
          } catch {}
          overlay.remove();
          document.body.style.overflow = prevOverflow;
          resolve(true);
        });
      });
    }

    await ensureDisclaimerAccepted();

    setUserId(STATE.user.id);

    setBalance(await loadBalance(STATE.user.id));

    // Top buttons
    qs("logoutBtn").addEventListener("click", async () => {
      await window.sb.auth.signOut();
      window.location.href = "./index.html";
    });
    qs("profileBtn").addEventListener("click", () => (window.location.href = "./dashboard.html"));
    qs("leaderboardBtn").addEventListener("click", () => (window.location.href = "./leaderboard.html"));
    qs("adminBtn").addEventListener("click", () => (window.location.href = "./admin.html"));

    if (await isAdmin()) qs("adminBtn").style.visibility = "visible";

    // Tabs
    qs("tab_rouletteView").addEventListener("click", () => switchView("rouletteView"));
    qs("tab_minesView").addEventListener("click", () => switchView("minesView"));
    qs("tab_blackjackView").addEventListener("click", () => switchView("blackjackView"));
    qs("tab_crashView")?.addEventListener("click", () => switchView("crashView"));
    switchView("rouletteView");

    // Roulette UI
    buildWheel();
    buildRouletteTable();
    renderRouletteBets();
    renderHistory();
    renderRouletteSummary();

    // Rebuild wheel labels on resize so numbers stay aligned.
    let wheelT = 0;
    window.addEventListener("resize", () => {
      clearTimeout(wheelT);
      wheelT = setTimeout(() => buildWheel(), 120);
    });

    setChipValue(STATE.roulette.chipValue || 10);

    qs("rouletteSpinBtn").addEventListener("click", spinRoulette);
    qs("rouletteClearBtn").addEventListener("click", clearRouletteBets);

    qs("rouletteChipRow").addEventListener("click", (e) => {
      const btn = e.target && e.target.closest && e.target.closest("button[data-chip]");
      if (!btn) return;
      setChipValue(Number(btn.dataset.chip) || 10);
    });

    const chipInp = qs("rouletteChipInput");
    chipInp.addEventListener("input", () => {
      const v = Math.max(1, Math.floor(Number(chipInp.value) || 1));
      chipInp.value = String(v);
      setChipValue(v);
    });
    qs("rouletteChipHalf").addEventListener("click", () => setChipValue(Math.max(1, Math.floor((STATE.roulette.chipValue || 1) / 2))));
    qs("rouletteChipDouble").addEventListener("click", () => setChipValue(Math.max(1, Math.floor((STATE.roulette.chipValue || 1) * 2))));

    // Mines controls
    loadMinesState();
    qs("minesBetInput").value = String(STATE.mines.lastBet);
    setMinesSize(STATE.mines.size);
    setMinesMines(STATE.mines.mines);

    const lockMinesControls = (locked) => {
      qs("minesSizeMinus").disabled = locked;
      qs("minesSizePlus").disabled = locked;
      qs("minesMinesMinus").disabled = locked;
      qs("minesMinesPlus").disabled = locked;
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

    qs("minesSizeMinus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      setMinesSize(STATE.mines.size - 1);
      resetMinesRound();
    });
    qs("minesSizePlus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      setMinesSize(STATE.mines.size + 1);
      resetMinesRound();
    });

    qs("minesMinesMinus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      setMinesMines(STATE.mines.mines - 1);
      resetMinesRound();
    });
    qs("minesMinesPlus").addEventListener("click", () => {
      if (STATE.mines.active) return;
      setMinesMines(STATE.mines.mines + 1);
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

    // Initial state
    setMsg(qs("rouletteMsg"), "Pick a chip value and place your bets.", "");
    renderRouletteBets();
    renderRouletteSummary();
    renderHistory();

    // Optional hints (only if elements exist in other pages)
    const bh = qs("balanceHint");
    if (bh) bh.textContent = "";
    const pbh = qs("profileBalanceHint");
    if (pbh) pbh.textContent = "";
  }

  window.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => {
      const msg = e?.message || "Error";
      const el = qs("globalMsg");
      if (el) setMsg(el, msg, "err");
    });
  });
})();
