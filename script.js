const multipliers = ["1.2x", "1.5x", "2x", "5x", "10x", "100x"];
const ui = {
  btnHome: document.getElementById("btnHome"),
  btnRoulette: document.getElementById("btnRoulette"),
  btnMines: document.getElementById("btnMines"),
  homeToRoulette: document.getElementById("homeToRoulette"),
  homeToMines: document.getElementById("homeToMines"),
  views: {
    home: document.getElementById("homeView"),
    roulette: document.getElementById("rouletteView"),
    mines: document.getElementById("minesView")
  },
  ballTrack: document.getElementById("ballTrack"),
  startSimulation: document.getElementById("startSimulation"),
  rouletteResult: document.getElementById("rouletteResult"),
  gridSize: document.getElementById("gridSize"),
  minesCount: document.getElementById("minesCount"),
  betAmount: document.getElementById("betAmount"),
  startMines: document.getElementById("startMines"),
  cashoutMines: document.getElementById("cashoutMines"),
  resetMines: document.getElementById("resetMines"),
  minesGrid: document.getElementById("minesGrid"),
  minesResult: document.getElementById("minesResult"),
  balanceValue: document.getElementById("balanceValue")
};

const rouletteState = {
  running: false,
  x: 0,
  speed: 0,
  raf: 0,
  target: ""
};

const minesState = {
  size: 5,
  bombs: new Set(),
  opened: new Set(),
  gameOver: false,
  minesCount: 4,
  bet: 100,
  currentMultiplier: 1,
  roundActive: false
};
let balance = 5000;

init();

function init() {
  bindEvents();
  buildRouletteTrack();
  refreshBalance();
  populateMinesCountOptions();
  resetMinesGame();
}

function bindEvents() {
  ui.btnHome.addEventListener("click", () => switchView("home"));
  ui.btnRoulette.addEventListener("click", () => switchView("roulette"));
  ui.btnMines.addEventListener("click", () => switchView("mines"));
  ui.homeToRoulette.addEventListener("click", () => switchView("roulette"));
  ui.homeToMines.addEventListener("click", () => switchView("mines"));
  ui.startSimulation.addEventListener("click", startSimulation);
  ui.gridSize.addEventListener("change", () => {
    minesState.size = Number(ui.gridSize.value);
    populateMinesCountOptions();
    resetMinesGame();
  });
  ui.minesCount.addEventListener("change", () => {
    minesState.minesCount = Number(ui.minesCount.value);
    resetMinesGame();
  });
  ui.startMines.addEventListener("click", startMinesRound);
  ui.cashoutMines.addEventListener("click", cashoutMinesRound);
  ui.resetMines.addEventListener("click", resetMinesGame);
}

function switchView(view) {
  Object.values(ui.views).forEach((v) => v.classList.remove("active"));
  ui.views[view].classList.add("active");
  [ui.btnHome, ui.btnRoulette, ui.btnMines].forEach((b) => b.classList.remove("active"));
  if (view === "home") ui.btnHome.classList.add("active");
  if (view === "roulette") ui.btnRoulette.classList.add("active");
  if (view === "mines") ui.btnMines.classList.add("active");
}

function buildRouletteTrack() {
  ui.ballTrack.innerHTML = "";
  for (let i = 0; i < 70; i += 1) {
    const value = multipliers[i % multipliers.length];
    const card = document.createElement("div");
    card.className = `multiplier-card ${value === "100x" ? "x100" : ""}`;
    card.dataset.value = value;
    card.innerHTML = `<span class="value">${value}</span><span class="ball"></span>`;
    ui.ballTrack.appendChild(card);
  }
}

function startSimulation() {
  if (rouletteState.running) return;
  rouletteState.running = true;
  rouletteState.speed = 48;
  rouletteState.target = weightedPick([
    { value: "1.2x", weight: 38 },
    { value: "1.5x", weight: 26 },
    { value: "2x", weight: 18 },
    { value: "5x", weight: 12 },
    { value: "10x", weight: 5.5 },
    { value: "100x", weight: 0.5 }
  ]);
  ui.rouletteResult.textContent = "Spin...";
  spinFrame();

  window.setTimeout(() => {
    rouletteState.running = false;
    cancelAnimationFrame(rouletteState.raf);
    stopAtTarget();
  }, randomInt(3600, 5200));
}

function spinFrame() {
  rouletteState.x -= rouletteState.speed;
  const first = ui.ballTrack.firstElementChild;
  if (first) {
    const itemWidth = first.getBoundingClientRect().width + 10;
    while (-rouletteState.x >= itemWidth) {
      rouletteState.x += itemWidth;
      ui.ballTrack.appendChild(first);
    }
  }
  ui.ballTrack.style.transform = `translateX(${rouletteState.x}px)`;
  rouletteState.speed = Math.max(0.25, rouletteState.speed * 0.992);
  if (rouletteState.running) rouletteState.raf = requestAnimationFrame(spinFrame);
}

function stopAtTarget() {
  const cards = Array.from(ui.ballTrack.children);
  const targetCard = cards.find((c) => c.dataset.value === rouletteState.target) || cards[0];
  const targetIndex = cards.indexOf(targetCard);
  const itemWidth = targetCard.getBoundingClientRect().width + 10;
  const center = (ui.ballTrack.parentElement?.clientWidth || 900) / 2;
  const finalX = -(targetIndex * itemWidth - center + itemWidth / 2);
  ui.ballTrack.style.transition = "transform 850ms cubic-bezier(0.14, 0.84, 0.18, 1)";
  ui.ballTrack.style.transform = `translateX(${finalX}px)`;
  window.setTimeout(() => {
    rouletteState.x = finalX;
    ui.ballTrack.style.transition = "none";
    ui.rouletteResult.textContent = `Выпало: ${rouletteState.target}`;
  }, 900);
}

function resetMinesGame() {
  minesState.opened.clear();
  minesState.bombs.clear();
  minesState.gameOver = false;
  minesState.roundActive = false;
  minesState.currentMultiplier = 1;
  renderMinesGrid();
  ui.minesResult.textContent = "Нажми Start, чтобы начать раунд.";
}

function renderMinesGrid() {
  ui.minesGrid.innerHTML = "";
  ui.minesGrid.style.gridTemplateColumns = `repeat(${minesState.size}, 56px)`;
  const total = minesState.size * minesState.size;
  for (let i = 0; i < total; i += 1) {
    const btn = document.createElement("button");
    btn.className = "mine-cell";
    btn.dataset.index = String(i);
    btn.disabled = !minesState.roundActive;
    btn.addEventListener("click", () => openMineCell(i, btn));
    ui.minesGrid.appendChild(btn);
  }
}

function openMineCell(index, cell) {
  if (!minesState.roundActive || minesState.gameOver || minesState.opened.has(index)) return;
  minesState.opened.add(index);
  if (minesState.bombs.has(index)) {
    cell.classList.add("bomb");
    cell.textContent = "💣";
    minesState.gameOver = true;
    minesState.roundActive = false;
    ui.minesResult.textContent = "ВЗРЫВ! Ставка сгорела.";
    revealBombs();
    setCellsDisabled(true);
    return;
  }
  cell.classList.add("safe");
  cell.textContent = "◆";
  minesState.currentMultiplier = calculateCurrentMultiplier();
  const potential = Math.floor(minesState.bet * minesState.currentMultiplier);
  ui.minesResult.textContent = `Safe: ${minesState.opened.size} | x${minesState.currentMultiplier.toFixed(2)} | Вывод: ${potential}`;

  const total = minesState.size * minesState.size;
  const safeTotal = total - minesState.minesCount;
  if (minesState.opened.size >= safeTotal) {
    cashoutMinesRound(true);
  }
}

function revealBombs() {
  document.querySelectorAll(".mine-cell").forEach((cell) => {
    const idx = Number(cell.dataset.index);
    if (minesState.bombs.has(idx) && !cell.classList.contains("bomb")) {
      cell.classList.add("bomb");
      cell.textContent = "💣";
    }
  });
}

function startMinesRound() {
  if (minesState.roundActive) return;
  minesState.bet = Math.max(10, Number(ui.betAmount.value) || 0);
  if (minesState.bet > balance) {
    ui.minesResult.textContent = "Недостаточно баланса для ставки.";
    return;
  }

  balance -= minesState.bet;
  refreshBalance();
  minesState.opened.clear();
  minesState.bombs.clear();
  minesState.gameOver = false;
  minesState.roundActive = true;
  minesState.currentMultiplier = 1;

  const total = minesState.size * minesState.size;
  while (minesState.bombs.size < minesState.minesCount) {
    minesState.bombs.add(randomInt(0, total - 1));
  }
  renderMinesGrid();
  ui.minesResult.textContent = `Раунд стартовал. Ставка: ${minesState.bet}`;
}

function cashoutMinesRound(auto = false) {
  if (!minesState.roundActive) return;
  const win = Math.floor(minesState.bet * minesState.currentMultiplier);
  balance += win;
  refreshBalance();
  minesState.roundActive = false;
  minesState.gameOver = true;
  setCellsDisabled(true);
  ui.minesResult.textContent = auto
    ? `Поле очищено! Автовывод: +${win} coins (x${minesState.currentMultiplier.toFixed(2)})`
    : `Вывод сделан: +${win} coins (x${minesState.currentMultiplier.toFixed(2)})`;
}

function calculateCurrentMultiplier() {
  const total = minesState.size * minesState.size;
  const safeTotal = total - minesState.minesCount;
  let multiplier = 1;
  for (let i = 0; i < minesState.opened.size; i += 1) {
    const allLeft = total - i;
    const safeLeft = safeTotal - i;
    multiplier *= (allLeft / safeLeft) * 0.97;
  }
  return Math.max(1, multiplier);
}

function populateMinesCountOptions() {
  const total = minesState.size * minesState.size;
  const maxMines = total - 1;
  ui.minesCount.innerHTML = "";
  for (let i = 1; i <= maxMines; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    ui.minesCount.appendChild(option);
  }
  minesState.minesCount = Math.min(Math.max(1, minesState.minesCount), maxMines);
  ui.minesCount.value = String(minesState.minesCount);
}

function setCellsDisabled(disabled) {
  document.querySelectorAll(".mine-cell").forEach((cell) => {
    cell.disabled = disabled;
  });
}

function refreshBalance() {
  ui.balanceValue.textContent = String(balance);
}

function weightedPick(list) {
  const total = list.reduce((acc, item) => acc + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return list[0].value;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
