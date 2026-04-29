(() => {
  const qs = (id) => document.getElementById(id);

  const rand01 = () => {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] / 2 ** 32;
    } catch {
      return Math.random();
    }
  };

  const RULES = {
    edgeChance: 0.0075, // <= 1% (rare)
    multHeadsTails: 2,
    multEdge: 20,
  };

  function rollOutcome() {
    const r = rand01();
    if (r < RULES.edgeChance) return "edge";
    return rand01() < 0.5 ? "heads" : "tails";
  }

  function label(o) {
    if (o === "heads") return "Heads";
    if (o === "tails") return "Tails";
    return "Edge";
  }

  function multiplier(pick) {
    return pick === "edge" ? RULES.multEdge : RULES.multHeadsTails;
  }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("err", "ok");
    if (kind) el.classList.add(kind);
  }

  function clampInt(n, min, max) {
    const x = Math.floor(Number(n));
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  function init() {
    const api = window.casinoBalance;
    if (!api) return;

    const betInput = qs("coinBetInput");
    const betHalf = qs("coinBetHalf");
    const betDouble = qs("coinBetDouble");
    const betMax = qs("coinBetMax");
    const betHint = qs("coinBetHint");

    const pickHeads = qs("coinPickHeads");
    const pickTails = qs("coinPickTails");
    const pickEdge = qs("coinPickEdge");
    const tossBtn = qs("coinTossBtn");
    const msgEl = qs("coinMsg");

    const resultPill = qs("coinResultPill");
    const pickValue = qs("coinPickValue");
    const betValue = qs("coinBetValue");
    const payoutIfWin = qs("coinPayoutIfWin");
    const multEl = qs("coinMult");
    const balEl = qs("coinBal");

    const coinWrap = qs("coinWrap");
    const coin = qs("coin");
    const shadow = document.querySelector(".coin-shadow");

    if (!betInput || !pickHeads || !pickTails || !pickEdge || !tossBtn || !coinWrap || !coin || !shadow) return;

    let pick = "heads";
    let busy = false;

    const renderBalance = () => {
      const bal = api.get();
      if (balEl) balEl.textContent = Number(bal || 0).toLocaleString("en-US");
      renderBetHint();
    };

    const getBet = () => {
      const bal = Math.max(0, Math.floor(Number(api.get()) || 0));
      const bet = clampInt(betInput.value, 1, Math.max(1, bal));
      return bet;
    };

    const renderBetHint = () => {
      const bal = Math.max(0, Math.floor(Number(api.get()) || 0));
      const bet = clampInt(betInput.value, 1, Math.max(1, bal));
      betInput.value = String(bet);
      if (betValue) betValue.textContent = String(bet);
      const m = multiplier(pick);
      if (multEl) multEl.textContent = `x${m}`;
      if (payoutIfWin) payoutIfWin.textContent = String(bet * m);
      if (betHint) betHint.textContent = `Max bet: ${bal.toLocaleString("en-US")}.`;
    };

    const setPick = (next) => {
      pick = next;
      pickHeads.classList.toggle("active", pick === "heads");
      pickTails.classList.toggle("active", pick === "tails");
      pickEdge.classList.toggle("active", pick === "edge");
      if (pickValue) pickValue.textContent = label(pick);
      renderBetHint();
      setMsg(msgEl, "", "");
    };

    const setBusy = (b) => {
      busy = !!b;
      tossBtn.disabled = busy;
      betInput.disabled = busy;
      betHalf.disabled = busy;
      betDouble.disabled = busy;
      betMax.disabled = busy;
      pickHeads.disabled = busy;
      pickTails.disabled = busy;
      pickEdge.disabled = busy;
    };

    async function animate(outcome) {
      // Web Animations API for smooth toss: arc in Y and pop in Z to sell 3D.
      const duration = 1500 + Math.floor(rand01() * 300);
      const driftX = (rand01() * 48 - 24);
      const popZ = 80 + Math.floor(rand01() * 80);

      const endX = outcome === "edge" ? 90 : 0;
      const endY = outcome === "tails" ? 180 : outcome === "edge" ? (rand01() < 0.5 ? 0 : 180) : 0;
      const spins = 10 + Math.floor(rand01() * 6);
      const wob = (rand01() * 18 - 9);

      coin.classList.add("spinning");

      const wrapAnim = coinWrap.animate(
        [
          { transform: "translate3d(0,0,0)", offset: 0 },
          { transform: `translate3d(${driftX}px, -220px, ${popZ}px)`, offset: 0.28 },
          { transform: `translate3d(${driftX * 0.18}px, 0, 18px)`, offset: 0.86 },
          { transform: `translate3d(${driftX * 0.18}px, -14px, 8px)`, offset: 0.93 },
          { transform: `translate3d(${driftX * 0.18}px, 0, 0)`, offset: 1 },
        ],
        { duration, easing: "cubic-bezier(.18,.82,.18,1)", fill: "forwards" },
      );

      const shadowAnim = shadow.animate(
        [
          { transform: "translateX(-50%) scale(1)", opacity: 0.62, offset: 0 },
          { transform: "translateX(-50%) scale(0.40)", opacity: 0.20, offset: 0.28 },
          { transform: "translateX(-50%) scale(1.03)", opacity: 0.62, offset: 0.86 },
          { transform: "translateX(-50%) scale(0.92)", opacity: 0.55, offset: 0.93 },
          { transform: "translateX(-50%) scale(1)", opacity: 0.62, offset: 1 },
        ],
        { duration, easing: "cubic-bezier(.18,.82,.18,1)", fill: "forwards" },
      );

      const coinAnim = coin.animate(
        [
          { transform: "rotateX(12deg) rotateY(12deg) rotateZ(0deg)", offset: 0 },
          { transform: `rotateX(${spins * 360}deg) rotateY(${720 + wob * 2}deg) rotateZ(${wob * 0.35}deg)`, offset: 0.72 },
          { transform: `rotateX(${endX + 16}deg) rotateY(${endY + 10}deg) rotateZ(${wob * 0.12}deg)`, offset: 0.90 },
          { transform: `rotateX(${endX}deg) rotateY(${endY}deg) rotateZ(0deg)`, offset: 1 },
        ],
        { duration, easing: "cubic-bezier(.16,.82,.2,1)", fill: "forwards" },
      );

      await Promise.all([wrapAnim.finished, shadowAnim.finished, coinAnim.finished]);
      coin.classList.remove("spinning");
    }

    async function toss() {
      if (busy) return;
      const bal = Math.max(0, Math.floor(Number(api.get()) || 0));
      const bet = getBet();
      if (bet > bal) {
        setMsg(msgEl, "Bet is larger than your balance.", "err");
        return;
      }

      setBusy(true);
      setMsg(msgEl, "", "");
      if (resultPill) resultPill.textContent = "…";

      // Deduct bet immediately
      api.set(bal - bet);
      renderBalance();

      const outcome = rollOutcome();
      await animate(outcome);

      const won = outcome === pick;
      const m = multiplier(pick);
      const payout = won ? bet * m : 0;

      if (resultPill) resultPill.textContent = label(outcome);
      if (won) {
        api.set(api.get() + payout);
        renderBalance();
        setMsg(msgEl, `Win: +${payout.toLocaleString("en-US")} (x${m})`, "ok");
      } else {
        setMsg(msgEl, `Loss: -${bet.toLocaleString("en-US")}`, "err");
      }

      setBusy(false);
      renderBetHint();
    }

    // Bind UI
    betInput.addEventListener("input", renderBetHint);
    betHalf.addEventListener("click", () => {
      betInput.value = String(Math.max(1, Math.floor(getBet() / 2)));
      renderBetHint();
    });
    betDouble.addEventListener("click", () => {
      betInput.value = String(Math.max(1, Math.floor(getBet() * 2)));
      renderBetHint();
    });
    betMax.addEventListener("click", () => {
      betInput.value = String(Math.max(1, Math.floor(Number(api.get()) || 1)));
      renderBetHint();
    });

    pickHeads.addEventListener("click", () => setPick("heads"));
    pickTails.addEventListener("click", () => setPick("tails"));
    pickEdge.addEventListener("click", () => setPick("edge"));
    tossBtn.addEventListener("click", toss);

    // Initial
    setPick("heads");
    renderBalance();
    renderBetHint();

    // Keep in sync if balance changes elsewhere.
    setInterval(renderBalance, 800);

    // Support /coin redirect to open coin tab.
    if (window.location.hash === "#coin") {
      try {
        window.__openCoinTab?.();
      } catch {}
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

