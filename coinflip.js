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

  const pickOutcome = () => {
    // Very small chance to land on the edge.
    const edgeChance = 1 / 500; // 0.2%
    const r = rand01();
    if (r < edgeChance) return "edge";
    return rand01() < 0.5 ? "heads" : "tails";
  };

  const setMsg = (el, text, kind) => {
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg" + (kind ? ` ${kind}` : "");
  };

  const setOpen = (overlay, open) => {
    if (!overlay) return;
    overlay.classList.toggle("open", open);
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("cf-lock", open);
  };

  const init = () => {
    const openBtn = qs("coinFlipBtn") || qs("tab_coinFlip");
    const overlay = qs("coinFlipOverlay");
    const closeBtn = qs("cfCloseBtn");
    const pickHeads = qs("cfPickHeads");
    const pickTails = qs("cfPickTails");
    const tossBtn = qs("cfTossBtn");
    const coinWrap = qs("cfCoinWrap");
    const coin = qs("cfCoin");
    const msg = qs("cfMsg");

    if (!openBtn || !overlay || !closeBtn || !pickHeads || !pickTails || !tossBtn || !coinWrap || !coin) return;

    let pick = "heads";
    let running = false;

    const setPick = (next) => {
      pick = next;
      pickHeads.classList.toggle("active", pick === "heads");
      pickTails.classList.toggle("active", pick === "tails");
      setMsg(msg, "", "");
    };

    const close = () => {
      if (running) return;
      setOpen(overlay, false);
      setMsg(msg, "", "");
    };

    const open = () => {
      setOpen(overlay, true);
      // Focus for keyboard users.
      (tossBtn || closeBtn).focus?.();
    };

    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });

    pickHeads.addEventListener("click", () => setPick("heads"));
    pickTails.addEventListener("click", () => setPick("tails"));

    const animateToss = async () => {
      if (running) return;
      running = true;
      tossBtn.disabled = true;
      pickHeads.disabled = true;
      pickTails.disabled = true;
      setMsg(msg, "Tossing...", "");

      const outcome = pickOutcome(); // heads | tails | edge
      const spins = 8 + Math.floor(rand01() * 6); // 8..13
      const wobble = (rand01() * 22 - 11).toFixed(2) + "deg";
      const driftX = (rand01() * 26 - 13).toFixed(1) + "px";
      const driftZ = (rand01() * 18 - 9).toFixed(2) + "deg";

      let finalX = "0deg";
      let finalY = "0deg";
      if (outcome === "tails") finalY = "180deg";
      if (outcome === "edge") {
        finalX = "90deg";
        finalY = (rand01() < 0.5 ? "0deg" : "180deg");
      }

      coin.style.setProperty("--cf-spin-turns", String(spins));
      coin.style.setProperty("--cf-final-x", finalX);
      coin.style.setProperty("--cf-final-y", finalY);
      coin.style.setProperty("--cf-wobble", wobble);
      coin.style.setProperty("--cf-drift-x", driftX);
      coin.style.setProperty("--cf-drift-z", driftZ);

      coinWrap.classList.remove("toss");
      coin.classList.remove("spin");
      // Restart animation reliably.
      void coinWrap.offsetWidth;
      coinWrap.classList.add("toss");
      coin.classList.add("spin");

      const done = () =>
        new Promise((resolve) => {
          const onEnd = (ev) => {
            if (ev.target !== coin) return;
            coin.removeEventListener("animationend", onEnd);
            resolve();
          };
          coin.addEventListener("animationend", onEnd);
        });

      await done();

      let label = outcome === "heads" ? "Орёл" : outcome === "tails" ? "Решка" : "Ребро";
      if (outcome === "edge") {
        setMsg(msg, `Результат: ${label} (очень редкое!)`, "ok");
      } else if (pick === outcome) {
        setMsg(msg, `Результат: ${label}. Ты угадал!`, "ok");
      } else {
        setMsg(msg, `Результат: ${label}. Не угадал.`, "err");
      }

      running = false;
      tossBtn.disabled = false;
      pickHeads.disabled = false;
      pickTails.disabled = false;
    };

    tossBtn.addEventListener("click", animateToss);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
