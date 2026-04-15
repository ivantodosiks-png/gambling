function createInfiniteRoulette(trackNode, onFrame) {
  const state = {
    running: false,
    x: 0,
    speed: 0,
    minSpeed: 0.2,
    targetItem: null,
    rafId: 0,
    itemWidth: 168
  };

  function appendItem(item, rarityInfo, paintImage) {
    const card = document.createElement("div");
    card.className = `roll-item ${rarityInfo[item.rarity].className}`;
    card.dataset.name = item.name;
    card.innerHTML = `<div class="item-thumb"></div><div class="item-info"><p class="item-name">${item.name}</p></div>`;
    paintImage(card.querySelector(".item-thumb"), item.img, item.name);
    trackNode.appendChild(card);
  }

  function rotateIfNeeded() {
    const first = trackNode.firstElementChild;
    if (!first) return;
    const cardWidth = first.getBoundingClientRect().width + 8;
    state.itemWidth = cardWidth || state.itemWidth;
    if (-state.x >= state.itemWidth) {
      state.x += state.itemWidth;
      trackNode.appendChild(first);
    }
  }

  function alignToTarget(onDone) {
    const cards = Array.from(trackNode.children);
    const idx = cards.findIndex((n) => n.dataset.name === state.targetItem.name);
    if (idx < 0) {
      onDone();
      return;
    }
    const viewportCenter = (trackNode.parentElement?.clientWidth || 900) / 2;
    const targetX = idx * state.itemWidth - viewportCenter + state.itemWidth / 2;
    trackNode.style.transition = "transform 760ms cubic-bezier(0.12, 0.82, 0.18, 1)";
    trackNode.style.transform = `translateX(${-targetX}px)`;
    window.setTimeout(onDone, 800);
  }

  function frame() {
    if (!state.running) return;
    state.x -= state.speed;
    rotateIfNeeded();
    trackNode.style.transform = `translateX(${state.x}px)`;
    if (typeof onFrame === "function") onFrame(state.speed);
    state.speed = Math.max(state.minSpeed, state.speed * 0.992);
    state.rafId = requestAnimationFrame(frame);
  }

  return {
    start(options) {
      const { fillerItems, reward, rarityInfo, paintImage, durationMs, onDone } = options;
      cancelAnimationFrame(state.rafId);
      trackNode.innerHTML = "";
      trackNode.style.transition = "none";
      state.x = 0;
      state.speed = 52;
      state.minSpeed = 0.35;
      state.targetItem = reward;
      state.running = true;

      for (let i = 0; i < 64; i += 1) {
        appendItem(fillerItems[i % fillerItems.length], rarityInfo, paintImage);
      }
      appendItem(reward, rarityInfo, paintImage);
      for (let i = 0; i < 16; i += 1) {
        appendItem(fillerItems[(i + 3) % fillerItems.length], rarityInfo, paintImage);
      }

      frame();
      window.setTimeout(() => {
        state.running = false;
        cancelAnimationFrame(state.rafId);
        alignToTarget(onDone);
      }, durationMs);
    }
  };
}

window.createInfiniteRoulette = createInfiniteRoulette;
