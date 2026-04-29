/* coin.page.js
   Standalone coin toss page with bets.
   - No external heavy libs.
   - Uses Supabase session + same localStorage balance key as the main site (if available).
*/

// -----------------------------
// Utilities / RNG
// -----------------------------

const qs = (id) => document.getElementById(id);

function rand01() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  } catch {
    return Math.random();
  }
}

function clampInt(n, min, max) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function fmt(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("en-US");
}

// -----------------------------
// Balance storage (compatible with site.js)
// -----------------------------

const BALANCE_LS_PREFIX = "casino_balance_v1:";
const DEFAULT_BALANCE = 1000;

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

// -----------------------------
// Optional Supabase integration
// -----------------------------

async function getAuthedUser() {
  const sb = window.sb;
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user || null;
  } catch {
    return null;
  }
}

async function loadRemoteBalance(userId) {
  const sb = window.sb;
  if (!sb || !userId) return null;
  try {
    const { data, error } = await sb.from("profiles").select("balance").eq("id", userId).maybeSingle();
    if (error) throw error;
    const n = Number(data?.balance);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

async function persistRemoteBalance(userId, balance) {
  const sb = window.sb;
  if (!sb || !userId) return;
  try {
    await sb.from("profiles").update({ balance: Math.max(0, Math.floor(Number(balance) || 0)) }).eq("id", userId);
  } catch {
    // ignore (offline / RLS / missing table)
  }
}

// -----------------------------
// Audio (optional)
// -----------------------------

const AudioFx = (() => {
  let ctx = null;

  function ensureCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx) ctx = new Ctx();
    return ctx;
  }

  function beep({ type = "sine", freq = 440, gain = 0.03, ms = 90 }) {
    const c = ensureCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    setTimeout(() => {
      try {
        o.stop();
        o.disconnect();
        g.disconnect();
      } catch {}
    }, ms);
  }

  function spinStart() {
    // short rising “whoosh”
    beep({ type: "triangle", freq: 220, gain: 0.018, ms: 120 });
    setTimeout(() => beep({ type: "triangle", freq: 380, gain: 0.014, ms: 140 }), 110);
  }

  function spinTick() {
    beep({ type: "square", freq: 880, gain: 0.012, ms: 35 });
  }

  function landOk() {
    beep({ type: "sine", freq: 260, gain: 0.035, ms: 100 });
  }

  function landBad() {
    beep({ type: "sine", freq: 190, gain: 0.045, ms: 130 });
  }

  function landEdge() {
    beep({ type: "sine", freq: 520, gain: 0.05, ms: 120 });
    setTimeout(() => beep({ type: "sine", freq: 780, gain: 0.04, ms: 110 }), 95);
  }

  return { spinStart, spinTick, landOk, landBad, landEdge };
})();

// -----------------------------
// Coin animation
// -----------------------------

const Animator = (() => {
  // The coin has 3 display states:
  // - heads:  rotateY(0deg)
  // - tails:  rotateY(180deg)
  // - edge:   rotateX(90deg)
  function finalTransform(outcome) {
    if (outcome === "tails") return { rx: 0, ry: 180, rz: 0 };
    if (outcome === "edge") return { rx: 90, ry: rand01() < 0.5 ? 0 : 180, rz: 0 };
    return { rx: 0, ry: 0, rz: 0 };
  }

  async function toss({ coinWrap, coin, shadow, outcome, soundEnabled }) {
    // NOTE: We avoid CSS keyframes for the main motion so we can reliably “compose”
    // acceleration -> spin -> slowdown -> settle, using Web Animations API.
    const spins = 9 + Math.floor(rand01() * 7); // 9..15
    const wobble = (rand01() * 18 - 9); // deg
    const driftX = (rand01() * 36 - 18); // px
    const driftZ = (rand01() * 16 - 8); // deg

    const end = finalTransform(outcome);
    const duration = 1450 + Math.floor(rand01() * 420); // 1450..1870ms

    const wrapAnim = coinWrap.animate(
      [
        { transform: "translate3d(0,0,0)", offset: 0 },
        { transform: `translate3d(${driftX}px, -150px, 0)`, offset: 0.28 },
        { transform: `translate3d(${driftX * 0.18}px, 0, 0)`, offset: 0.86 },
        { transform: `translate3d(${driftX * 0.18}px, -12px, 0)`, offset: 0.93 },
        { transform: `translate3d(${driftX * 0.18}px, 0, 0)`, offset: 1 },
      ],
      { duration, easing: "cubic-bezier(.18,.82,.18,1)", fill: "forwards" },
    );

    const shadowAnim = shadow.animate(
      [
        { transform: "translateX(-50%) scale(1)", opacity: 0.62, offset: 0 },
        { transform: "translateX(-50%) scale(0.50)", opacity: 0.28, offset: 0.28 },
        { transform: "translateX(-50%) scale(1.03)", opacity: 0.62, offset: 0.86 },
        { transform: "translateX(-50%) scale(0.92)", opacity: 0.55, offset: 0.93 },
        { transform: "translateX(-50%) scale(1)", opacity: 0.62, offset: 1 },
      ],
      { duration, easing: "cubic-bezier(.18,.82,.18,1)", fill: "forwards" },
    );

    const coinAnim = coin.animate(
      [
        { transform: "rotateX(12deg) rotateY(12deg) rotateZ(0deg)", offset: 0 },
        {
          transform: `rotateX(${spins * 360}deg) rotateY(${360 + wobble}deg) rotateZ(${driftZ + wobble * 0.25}deg)`,
          offset: 0.72,
        },
        {
          transform: `rotateX(${end.rx + 16}deg) rotateY(${end.ry + 10}deg) rotateZ(${driftZ * 0.35}deg)`,
          offset: 0.90,
        },
        { transform: `rotateX(${end.rx}deg) rotateY(${end.ry}deg) rotateZ(0deg)`, offset: 1 },
      ],
      { duration, easing: "cubic-bezier(.16,.82,.2,1)", fill: "forwards" },
    );

    if (soundEnabled) {
      AudioFx.spinStart();
      // A couple of ticks during the “spin” window.
      setTimeout(() => AudioFx.spinTick(), Math.floor(duration * 0.36));
      setTimeout(() => AudioFx.spinTick(), Math.floor(duration * 0.52));
      setTimeout(() => AudioFx.spinTick(), Math.floor(duration * 0.66));
    }

    await Promise.all([wrapAnim.finished, coinAnim.finished, shadowAnim.finished]);
  }

  return { toss };
})();

// -----------------------------
// Game rules
// -----------------------------

const Rules = (() => {
  // Probabilities:
  // - Edge chance <= 1% (rare).
  // - Heads/Tails share the remainder (almost 50/50).
  const EDGE_CHANCE = 0.0075; // 0.75%

  function rollOutcome() {
    const r = rand01();
    if (r < EDGE_CHANCE) return "edge";
    return rand01() < 0.5 ? "heads" : "tails";
  }

  function multiplierForPick(pick) {
    if (pick === "edge") return 20;
    return 2;
  }

  return { rollOutcome, multiplierForPick };
})();

// -----------------------------
// UI / App
// -----------------------------

const App = (() => {
  const els = {
    backBtn: qs("backBtn"),
    balanceValue: qs("balanceValue"),
    userIdValue: qs("userIdValue"),
    betInput: qs("betInput"),
    betHalfBtn: qs("betHalfBtn"),
    betDoubleBtn: qs("betDoubleBtn"),
    betMaxBtn: qs("betMaxBtn"),
    betHint: qs("betHint"),
    pickHeadsBtn: qs("pickHeadsBtn"),
    pickTailsBtn: qs("pickTailsBtn"),
    pickEdgeBtn: qs("pickEdgeBtn"),
    tossBtn: qs("tossBtn"),
    resetBalanceBtn: qs("resetBalanceBtn"),
    soundToggle: qs("soundToggle"),
    msg: qs("msg"),
    stageSubtitle: qs("stageSubtitle"),
    resultPill: qs("resultPill"),
    pickedValue: qs("pickedValue"),
    betValue: qs("betValue"),
    payoutValue: qs("payoutValue"),
    toasts: qs("toasts"),
    coinWrap: qs("coinWrap"),
    coin: qs("coin"),
    shadow: document.querySelector(".shadow"),
  };

  const state = {
    userId: null,
    balance: DEFAULT_BALANCE,
    pick: "heads", // heads | tails | edge
    busy: false,
  };

  function setMsg(text, kind) {
    els.msg.textContent = text || "";
    els.msg.className = "msg" + (kind ? ` ${kind}` : "");
  }

  function toast(title, sub, kind = "") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`.trim();
    el.innerHTML = `<div class="t-title"></div><div class="t-sub"></div>`;
    el.querySelector(".t-title").textContent = title;
    el.querySelector(".t-sub").textContent = sub || "";
    els.toasts.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      el.style.transition = "opacity 220ms ease, transform 220ms ease";
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  function setBalance(next) {
    state.balance = Math.max(0, Math.floor(Number(next) || 0));
    els.balanceValue.textContent = fmt(state.balance);
  }

  function setPick(next) {
    state.pick = next;
    els.pickHeadsBtn.classList.toggle("active", next === "heads");
    els.pickTailsBtn.classList.toggle("active", next === "tails");
    els.pickEdgeBtn.classList.toggle("active", next === "edge");

    els.pickedValue.textContent = next === "heads" ? "Орёл" : next === "tails" ? "Решка" : "Ребро";
    els.payoutValue.textContent = `x${Rules.multiplierForPick(next)}`;
  }

  function getBet() {
    const max = Math.max(0, state.balance);
    const bet = clampInt(els.betInput.value, 1, Math.max(1, max));
    return bet;
  }

  function syncBetUi() {
    const raw = Number(els.betInput.value);
    const bet = clampInt(raw, 1, Math.max(1, state.balance));
    els.betInput.value = String(bet);
    els.betValue.textContent = fmt(bet);

    if (bet > state.balance) {
      els.betHint.textContent = "Ставка больше баланса.";
      return;
    }
    els.betHint.textContent = `Можно поставить до ${fmt(state.balance)}.`;
  }

  function setBusy(b) {
    state.busy = !!b;
    els.tossBtn.disabled = state.busy;
    els.betInput.disabled = state.busy;
    els.betHalfBtn.disabled = state.busy;
    els.betDoubleBtn.disabled = state.busy;
    els.betMaxBtn.disabled = state.busy;
    els.pickHeadsBtn.disabled = state.busy;
    els.pickTailsBtn.disabled = state.busy;
    els.pickEdgeBtn.disabled = state.busy;
    els.resetBalanceBtn.disabled = state.busy;
  }

  async function loadInitialBalance() {
    const local = loadBalanceFromLocalStorage(state.userId);
    if (typeof local === "number") {
      setBalance(local);
    } else {
      setBalance(DEFAULT_BALANCE);
      persistBalanceToLocalStorage(state.userId, DEFAULT_BALANCE);
    }

    // If Supabase profile exists, adopt it as the source of truth (best-effort).
    if (state.userId) {
      const remote = await loadRemoteBalance(state.userId);
      if (typeof remote === "number") {
        setBalance(remote);
        persistBalanceToLocalStorage(state.userId, remote);
      }
    }

    syncBetUi();
  }

  async function persistBalanceEverywhere() {
    persistBalanceToLocalStorage(state.userId, state.balance);
    await persistRemoteBalance(state.userId, state.balance);
  }

  function pickLabel(outcome) {
    if (outcome === "heads") return "Орёл";
    if (outcome === "tails") return "Решка";
    return "Ребро";
  }

  function updateResultPill(text, kind) {
    els.resultPill.textContent = text;
    els.resultPill.style.borderColor =
      kind === "ok" ? "rgba(0,255,136,0.30)" : kind === "err" ? "rgba(255,59,59,0.30)" : "rgba(255,255,255,0.14)";
  }

  async function onToss() {
    if (state.busy) return;

    const bet = getBet();
    if (!Number.isFinite(bet) || bet <= 0) {
      setMsg("Некорректная ставка.", "err");
      toast("Ошибка", "Некорректная ставка.", "err");
      return;
    }
    if (bet > state.balance) {
      setMsg("Ставка больше баланса.", "err");
      toast("Недостаточно средств", "Уменьши ставку.", "warn");
      return;
    }

    setBusy(true);
    setMsg("", "");
    els.stageSubtitle.textContent = "Подбрасываем…";
    updateResultPill("…", "");

    // 1) Deduct bet immediately (like a real bet flow).
    setBalance(state.balance - bet);
    await persistBalanceEverywhere();
    syncBetUi();

    // 2) Roll the outcome.
    const outcome = Rules.rollOutcome(); // heads | tails | edge

    // 3) Animate.
    try {
      await Animator.toss({
        coinWrap: els.coinWrap,
        coin: els.coin,
        shadow: els.shadow,
        outcome,
        soundEnabled: !!els.soundToggle.checked,
      });
    } catch {
      // If animation fails, still resolve the bet logic.
    }

    // 4) Resolve payout.
    const won = outcome === state.pick;
    const mult = Rules.multiplierForPick(state.pick);
    const payout = won ? bet * mult : 0;

    if (won) {
      setBalance(state.balance + payout);
      await persistBalanceEverywhere();
      updateResultPill(`Результат: ${pickLabel(outcome)}`, "ok");
      els.stageSubtitle.textContent = outcome === "edge" ? "Ребро! Это редкость." : "Победа!";
      if (els.soundToggle.checked) (outcome === "edge" ? AudioFx.landEdge : AudioFx.landOk)();
      setMsg(`Выигрыш: +${fmt(payout)} (x${mult})`, "ok");
      toast("Выигрыш", `+${fmt(payout)} • Результат: ${pickLabel(outcome)}`, "ok");
    } else {
      updateResultPill(`Результат: ${pickLabel(outcome)}`, "err");
      els.stageSubtitle.textContent = "Не повезло. Попробуй ещё раз.";
      if (els.soundToggle.checked) AudioFx.landBad();
      setMsg(`Проигрыш: -${fmt(bet)} • Выпало: ${pickLabel(outcome)}`, "err");
      toast("Проигрыш", `-${fmt(bet)} • Выпало: ${pickLabel(outcome)}`, "err");
    }

    // 5) Update UI summary.
    els.betValue.textContent = fmt(bet);
    els.payoutValue.textContent = won ? `+${fmt(payout)}` : "0";

    setBusy(false);
  }

  async function boot() {
    els.backBtn.addEventListener("click", () => (window.location.href = "./site.html"));

    // Pick buttons
    els.pickHeadsBtn.addEventListener("click", () => setPick("heads"));
    els.pickTailsBtn.addEventListener("click", () => setPick("tails"));
    els.pickEdgeBtn.addEventListener("click", () => setPick("edge"));

    // Bet controls
    els.betInput.addEventListener("input", () => syncBetUi());
    els.betHalfBtn.addEventListener("click", () => {
      els.betInput.value = String(Math.max(1, Math.floor(getBet() / 2)));
      syncBetUi();
    });
    els.betDoubleBtn.addEventListener("click", () => {
      els.betInput.value = String(Math.max(1, Math.floor(getBet() * 2)));
      syncBetUi();
    });
    els.betMaxBtn.addEventListener("click", () => {
      els.betInput.value = String(Math.max(1, Math.floor(state.balance)));
      syncBetUi();
    });

    els.tossBtn.addEventListener("click", onToss);

    els.resetBalanceBtn.addEventListener("click", async () => {
      if (state.busy) return;
      setBalance(DEFAULT_BALANCE);
      await persistBalanceEverywhere();
      syncBetUi();
      setMsg("Локальный баланс сброшен на 1000.", "ok");
      toast("Сброс", "Локальный баланс = 1000", "warn");
    });

    // Load auth (optional)
    const user = await getAuthedUser();
    state.userId = user?.id || null;
    els.userIdValue.textContent = state.userId ? state.userId : "offline";

    setPick("heads");
    await loadInitialBalance();

    // If balance is changed in another tab (main site), adopt it immediately.
    window.addEventListener("storage", (e) => {
      try {
        if (e.key !== balanceStorageKey(state.userId)) return;
        const n = Number(e.newValue);
        if (!Number.isFinite(n) || n < 0) return;
        if (Math.floor(n) === state.balance) return;
        setBalance(Math.floor(n));
        syncBetUi();
      } catch {
        // ignore
      }
    });
  }

  return { boot };
})();

App.boot();

