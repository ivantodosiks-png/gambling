const multipliers = ["0.1x", "0.5x", "1x", "1.2x", "1.5x", "2x", "3x", "5x", "10x", "50x"];
const START_BALANCE = 5000;
const USERS_STORAGE_KEY = "gamblingUsersV1";
const CURRENT_USER_ID_KEY = "gamblingCurrentUserIdV1";
const ADMIN_NAME = "Ivan";
const ADMIN_PASSWORD = "924015";

const ui = {
  btnHome: document.getElementById("btnHome"),
  btnRoulette: document.getElementById("btnRoulette"),
  btnMines: document.getElementById("btnMines"),
  btnPlinko: document.getElementById("btnPlinko"),
  btnAdmin: document.getElementById("btnAdmin"),
  homeToRoulette: document.getElementById("homeToRoulette"),
  homeToMines: document.getElementById("homeToMines"),
  views: {
    home: document.getElementById("homeView"),
    roulette: document.getElementById("rouletteView"),
    mines: document.getElementById("minesView"),
    plinko: document.getElementById("plinkoView"),
    admin: document.getElementById("adminView")
  },
  ballTrack: document.getElementById("ballTrack"),
  rouletteBet: document.getElementById("rouletteBet"),
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
  balanceValue: document.getElementById("balanceValue"),
  playerIdValue: document.getElementById("playerIdValue"),
  adminName: document.getElementById("adminName"),
  adminPassword: document.getElementById("adminPassword"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  adminRefreshBtn: document.getElementById("adminRefreshBtn"),
  adminClearAllBtn: document.getElementById("adminClearAllBtn"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  adminAuthText: document.getElementById("adminAuthText"),
  adminControls: document.getElementById("adminControls"),
  adminUsersList: document.getElementById("adminUsersList"),
  plinkoBet: document.getElementById("plinkoBet"),
  plinkoRows: document.getElementById("plinkoRows"),
  plinkoRisk: document.getElementById("plinkoRisk"),
  plinkoCount: document.getElementById("plinkoCount"),
  plinkoSound: document.getElementById("plinkoSound"),
  plinkoDropOne: document.getElementById("plinkoDropOne"),
  plinkoDropMany: document.getElementById("plinkoDropMany"),
  plinkoBoard: document.getElementById("plinkoBoard"),
  plinkoCanvas: document.getElementById("plinkoCanvas"),
  plinkoWinFx: document.getElementById("plinkoWinFx"),
  plinkoMultipliers: document.getElementById("plinkoMultipliers"),
  plinkoStats: document.getElementById("plinkoStats"),
  plinkoResult: document.getElementById("plinkoResult"),
  disclaimerOverlay: document.getElementById("disclaimerOverlay"),
  disclaimerAccept: document.getElementById("disclaimerAccept")
};

const rouletteState = {
  running: false,
  x: 0,
  raf: 0,
  target: "",
  bet: 0,
  itemWidth: 140,
  spinUntil: 0,
  decelFrom: 0,
  decelTo: 0,
  decelStart: 0,
  decelDuration: 0,
  lastTs: 0
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
const plinkoState = {
  rows: 16,
  risk: "medium",
  multipliers: [],
  balls: [],
  queue: 0,
  lastDropAt: 0,
  dropIntervalMs: 220,
  running: false,
  pendingBets: 0,
  width: 0,
  height: 0,
  slotHeight: 54,
  pegRadius: 5,
  ballRadius: 7,
  spawnY: 34,
  worldBodies: [],
  slotSensors: [],
  slotDividers: [],
  sideWalls: [],
  ctx: null,
  soundEnabled: true,
  audioCtx: null,
  resizeObserver: null,
  engine: null,
  render: null,
  runner: null,
  eventsBound: false
};
let balance = 5000;
let currentUserId = "";
let usersStore = {};
let isAdminLoggedIn = false;

init();

function init() {
  initUserSession();
  bindEvents();
  showDisclaimer();
  buildRouletteTrack();
  initPlinko();
  refreshBalance();
  populateMinesCountOptions();
  resetMinesGame();
}

function bindEvents() {
  ui.btnHome.addEventListener("click", () => switchView("home"));
  ui.btnRoulette.addEventListener("click", () => switchView("roulette"));
  ui.btnMines.addEventListener("click", () => switchView("mines"));
  ui.btnPlinko.addEventListener("click", () => switchView("plinko"));
  ui.btnAdmin.addEventListener("click", () => switchView("admin"));
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
  ui.adminLoginBtn.addEventListener("click", adminLogin);
  ui.adminRefreshBtn.addEventListener("click", renderAdminUsers);
  ui.adminClearAllBtn.addEventListener("click", adminClearAllUsers);
  ui.adminLogoutBtn.addEventListener("click", adminLogout);
  ui.plinkoRows.addEventListener("change", () => {
    plinkoState.rows = Number(ui.plinkoRows.value);
    rebuildPlinkoBoard();
  });
  ui.plinkoRisk.addEventListener("change", () => {
    plinkoState.risk = ui.plinkoRisk.value;
    rebuildPlinkoBoard();
  });
  ui.plinkoSound.addEventListener("change", () => {
    plinkoState.soundEnabled = ui.plinkoSound.checked;
  });
  ui.plinkoDropOne.addEventListener("click", () => queuePlinkoDrops(1));
  ui.plinkoDropMany.addEventListener("click", () => {
    const count = Math.min(100, Math.max(1, Number(ui.plinkoCount.value) || 1));
    queuePlinkoDrops(count);
  });
  ui.disclaimerAccept.addEventListener("click", hideDisclaimer);
}

function switchView(view) {
  Object.values(ui.views).forEach((v) => v.classList.remove("active"));
  ui.views[view].classList.add("active");
  [ui.btnHome, ui.btnRoulette, ui.btnMines, ui.btnPlinko, ui.btnAdmin].forEach((b) => b.classList.remove("active"));
  if (view === "home") ui.btnHome.classList.add("active");
  if (view === "roulette") ui.btnRoulette.classList.add("active");
  if (view === "mines") ui.btnMines.classList.add("active");
  if (view === "plinko") ui.btnPlinko.classList.add("active");
  if (view === "admin") ui.btnAdmin.classList.add("active");

  if (view === "admin" && isAdminLoggedIn) {
    renderAdminUsers();
  }
}

function buildRouletteTrack() {
  ui.ballTrack.innerHTML = "";
  for (let i = 0; i < 140; i += 1) {
    const value = multipliers[i % multipliers.length];
    const card = document.createElement("div");
    card.className = `multiplier-card ${value === "50x" ? "x100" : ""}`;
    card.dataset.value = value;
    card.innerHTML = `<span class="value">${value}</span><span class="ball"></span>`;
    ui.ballTrack.appendChild(card);
  }
  const firstCard = ui.ballTrack.firstElementChild;
  if (firstCard) {
    const trackStyle = getComputedStyle(ui.ballTrack);
    const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || "10") || 10;
    rouletteState.itemWidth = firstCard.getBoundingClientRect().width + gap;
  }
  rouletteState.x = 0;
  ui.ballTrack.style.transform = "translate3d(0, 0, 0)";
}

function startSimulation() {
  if (rouletteState.running) return;
  
  const bet = Math.max(10, Number(ui.rouletteBet.value) || 0);
  if (bet > balance) {
    ui.rouletteResult.textContent = "Not enough balance for this bet.";
    return;
  }
  
  balance -= bet;
  refreshBalance();
  
  buildRouletteTrack();
  rouletteState.running = true;
  rouletteState.bet = bet;
  rouletteState.target = weightedPick([
    { value: "0.1x", weight: 15 },
    { value: "0.5x", weight: 20 },
    { value: "1x", weight: 18 },
    { value: "1.2x", weight: 15 },
    { value: "1.5x", weight: 12 },
    { value: "2x", weight: 10 },
    { value: "3x", weight: 5 },
    { value: "5x", weight: 3 },
    { value: "10x", weight: 1.5 },
    { value: "50x", weight: 0.5 }
  ]);
  ui.startSimulation.disabled = true;
  ui.rouletteResult.textContent = "Spinning...";
  rouletteState.lastTs = 0;
  rouletteState.spinUntil = performance.now() + randomInt(1300, 1800);
  rouletteState.decelDuration = randomInt(1900, 2600);
  rouletteState.decelStart = 0;
  rouletteState.raf = requestAnimationFrame(spinFrame);
}

function spinFrame(ts) {
  if (!rouletteState.running) return;

  if (!rouletteState.lastTs) rouletteState.lastTs = ts;
  const dt = Math.min(40, ts - rouletteState.lastTs);
  rouletteState.lastTs = ts;

  if (ts < rouletteState.spinUntil) {
    const pxPerMs = 1.95;
    rouletteState.x -= pxPerMs * dt;
    ui.ballTrack.style.transform = `translate3d(${rouletteState.x}px, 0, 0)`;
    rouletteState.raf = requestAnimationFrame(spinFrame);
    return;
  }

  if (!rouletteState.decelStart) {
    rouletteState.decelStart = ts;
    rouletteState.decelFrom = rouletteState.x;
    rouletteState.decelTo = computeFinalStopX();
  }

  const elapsed = ts - rouletteState.decelStart;
  const progress = Math.min(1, elapsed / rouletteState.decelDuration);
  const eased = 1 - Math.pow(1 - progress, 4);
  rouletteState.x = rouletteState.decelFrom + (rouletteState.decelTo - rouletteState.decelFrom) * eased;
  ui.ballTrack.style.transform = `translate3d(${rouletteState.x}px, 0, 0)`;

  if (progress < 1) {
    rouletteState.raf = requestAnimationFrame(spinFrame);
    return;
  }

  rouletteState.running = false;
  cancelAnimationFrame(rouletteState.raf);
  rouletteState.x = rouletteState.decelTo;
  ui.ballTrack.style.transform = `translate3d(${rouletteState.x}px, 0, 0)`;
  
  const multiplier = Number(rouletteState.target.replace("x", ""));
  let win;
  if (multiplier >= 1) {
    win = Math.floor(rouletteState.bet * multiplier);
    balance += win;
  } else {
    win = -Math.floor(rouletteState.bet * (1 - multiplier));
    balance += win;
  }
  refreshBalance();
  
  const resultType = multiplier >= 1 ? "WON" : "LOST";
  const resultAmount = Math.abs(win);
  ui.rouletteResult.textContent = `${resultType} ${resultAmount} coins! ${rouletteState.target} | Bet: ${rouletteState.bet} | Profit: ${win > 0 ? '+' : ''}${win}`;
  ui.startSimulation.disabled = false;
}

function computeFinalStopX() {
  const cards = Array.from(ui.ballTrack.children);
  const itemWidth = rouletteState.itemWidth;
  const center = (ui.ballTrack.parentElement?.clientWidth || 900) / 2;
  const currentCenterIndex = Math.round((center - itemWidth / 2 - rouletteState.x) / itemWidth);
  const minIndex = currentCenterIndex + randomInt(18, 28);
  const targetIndexes = [];

  for (let i = 0; i < cards.length; i += 1) {
    if (cards[i].dataset.value === rouletteState.target && i >= minIndex) {
      targetIndexes.push(i);
    }
  }

  const fallbackIndex = cards.findIndex((card) => card.dataset.value === rouletteState.target);
  const selectedIndex = targetIndexes.length > 0
    ? targetIndexes[randomInt(0, targetIndexes.length - 1)]
    : Math.max(0, fallbackIndex);

  return -(selectedIndex * itemWidth - center + itemWidth / 2);
}

function resetMinesGame() {
  minesState.opened.clear();
  minesState.bombs.clear();
  minesState.gameOver = false;
  minesState.roundActive = false;
  minesState.currentMultiplier = 1;
  renderMinesGrid();
  ui.minesResult.textContent = "Press Start to begin a round.";
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
    ui.minesResult.textContent = "BOOM! You hit a mine and lost the bet.";
    revealBombs();
    setCellsDisabled(true);
    return;
  }
  cell.classList.add("safe");
  cell.textContent = "◆";
  minesState.currentMultiplier = calculateCurrentMultiplier();
  const potential = Math.floor(minesState.bet * minesState.currentMultiplier);
  ui.minesResult.textContent = `Safe: ${minesState.opened.size} | x${minesState.currentMultiplier.toFixed(2)} | Cash out: ${potential}`;

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
    ui.minesResult.textContent = "Not enough balance for this bet.";
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
  ui.minesResult.textContent = `Round started. Bet: ${minesState.bet}`;
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
    ? `Board cleared! Auto cash-out: +${win} coins (x${minesState.currentMultiplier.toFixed(2)})`
    : `Cash-out complete: +${win} coins (x${minesState.currentMultiplier.toFixed(2)})`;
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
  if (!currentUserId) return;
  const user = usersStore[currentUserId];
  if (!user) return;
  user.balance = balance;
  user.lastSeenAt = Date.now();
  saveUsersStore();
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

function initUserSession() {
  usersStore = loadUsersStore();
  const savedUserId = localStorage.getItem(CURRENT_USER_ID_KEY);
  currentUserId = savedUserId || generateVisitorId();
  const existingUser = usersStore[currentUserId];

  if (existingUser) {
    balance = Math.max(0, Number(existingUser.balance) || 0);
    existingUser.lastSeenAt = Date.now();
  } else {
    usersStore[currentUserId] = {
      id: currentUserId,
      balance: START_BALANCE,
      createdAt: Date.now(),
      lastSeenAt: Date.now()
    };
    balance = START_BALANCE;
  }

  localStorage.setItem(CURRENT_USER_ID_KEY, currentUserId);
  ui.playerIdValue.textContent = currentUserId;
  saveUsersStore();
}

function loadUsersStore() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveUsersStore() {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersStore));
}

function generateVisitorId() {
  const partA = Math.random().toString(36).slice(2, 8).toUpperCase();
  const partB = Date.now().toString(36).slice(-6).toUpperCase();
  return `U-${partA}-${partB}`;
}

function initPlinko() {
  if (!window.Matter) {
    ui.plinkoResult.textContent = "Matter.js failed to load.";
    return;
  }
  plinkoState.rows = Number(ui.plinkoRows.value);
  plinkoState.risk = ui.plinkoRisk.value;
  plinkoState.soundEnabled = ui.plinkoSound.checked;
  setupPlinkoResize();
  createPlinkoEngine();
  rebuildPlinkoBoard();
}

function rebuildPlinkoBoard() {
  if (!plinkoState.engine || !plinkoState.render) return;
  updatePlinkoCanvasSize();
  clearPlinkoWorld();
  plinkoState.multipliers = generatePlinkoMultipliers(plinkoState.rows, plinkoState.risk);
  buildPlinkoBoardBodies();
  plinkoState.balls = [];
  plinkoState.queue = 0;
  plinkoState.pendingBets = 0;
  plinkoState.lastDropAt = 0;
  togglePlinkoButtons(false);
  renderPlinkoMultipliers();
  ui.plinkoStats.textContent = `${plinkoState.rows} rows | ${plinkoState.risk} risk`;
}

function generatePlinkoMultipliers(rows, risk) {
  const low = {
    8: [3.5, 2, 1.2, 1, 0.8, 1, 1.2, 2, 3.5],
    12: [6, 3, 1.7, 1.2, 1, 0.7, 0.6, 0.7, 1, 1.2, 1.7, 3, 6],
    16: [8, 4.5, 2.4, 1.5, 1.2, 1, 0.8, 0.6, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2.4, 4.5, 8]
  };
  const medium = {
    8: [7, 3, 1.4, 1, 0.5, 1, 1.4, 3, 7],
    12: [12, 5, 2.4, 1.4, 1, 0.5, 0.3, 0.5, 1, 1.4, 2.4, 5, 12],
    16: [20, 9, 4, 2, 1.4, 1, 0.7, 0.4, 0.2, 0.4, 0.7, 1, 1.4, 2, 4, 9, 20]
  };
  const high = {
    8: [16, 7, 2, 1, 0.2, 1, 2, 7, 16],
    12: [40, 14, 5, 2, 1, 0.4, 0.2, 0.4, 1, 2, 5, 14, 40],
    16: [100, 26, 9, 4, 2, 1, 0.5, 0.3, 0.2, 0.3, 0.5, 1, 2, 4, 9, 26, 100]
  };
  const map = risk === "high" ? high : risk === "medium" ? medium : low;
  return map[rows].slice();
}

function formatMultiplier(value) {
  if (value >= 100) return 100;
  if (value >= 10) return Math.round(value);
  return Math.round(value * 10) / 10;
}

function renderPlinkoMultipliers() {
  const max = Math.max(...plinkoState.multipliers);
  const slotArea = getSlotArea();
  ui.plinkoMultipliers.innerHTML = plinkoState.multipliers.map((mult) => {
    const cls = mult >= max * 0.7 ? "high" : mult <= 1 ? "low" : "mid";
    return `<span class="plinko-mult ${cls}">${mult}x</span>`;
  }).join("");
  ui.plinkoMultipliers.style.gridTemplateColumns = `repeat(${plinkoState.multipliers.length}, 1fr)`;
  ui.plinkoMultipliers.style.left = `${slotArea.left}px`;
  ui.plinkoMultipliers.style.width = `${slotArea.width}px`;
  ui.plinkoMultipliers.style.right = "auto";
}

function queuePlinkoDrops(count) {
  if (!plinkoState.engine) return;
  const bet = Math.max(10, Number(ui.plinkoBet.value) || 0);
  if (bet * count > balance) {
    ui.plinkoResult.textContent = "Not enough balance for selected amount of balls.";
    return;
  }
  plinkoState.queue += count;
  plinkoState.pendingBets += count;
  ui.plinkoStats.textContent = `Queued: ${plinkoState.queue} | In air: ${plinkoState.balls.length}`;
}

function togglePlinkoButtons(disabled) {
  ui.plinkoDropOne.disabled = disabled;
  ui.plinkoDropMany.disabled = disabled;
  ui.plinkoRows.disabled = disabled;
  ui.plinkoRisk.disabled = disabled;
  ui.plinkoBet.disabled = disabled;
}

function setupPlinkoResize() {
  window.addEventListener("resize", rebuildPlinkoBoard);
  if (typeof ResizeObserver === "undefined") return;
  if (plinkoState.resizeObserver) {
    plinkoState.resizeObserver.disconnect();
  }
  plinkoState.resizeObserver = new ResizeObserver(() => {
    rebuildPlinkoBoard();
  });
  plinkoState.resizeObserver.observe(ui.plinkoBoard);
}

function updatePlinkoCanvasSize() {
  const rect = ui.plinkoBoard.getBoundingClientRect();
  plinkoState.width = Math.max(320, rect.width);
  plinkoState.height = Math.max(300, rect.height);
  ui.plinkoCanvas.width = plinkoState.width;
  ui.plinkoCanvas.height = plinkoState.height;
  if (plinkoState.render) {
    plinkoState.render.options.width = plinkoState.width;
    plinkoState.render.options.height = plinkoState.height;
    plinkoState.render.canvas.width = plinkoState.width;
    plinkoState.render.canvas.height = plinkoState.height;
  }
}

function createPlinkoEngine() {
  const MatterRef = window.Matter;
  plinkoState.engine = MatterRef.Engine.create({
    gravity: { x: 0, y: 1.12 },
    positionIterations: 20,
    velocityIterations: 20,
    constraintIterations: 10,
    enableSleeping: false
  });
  plinkoState.engine.timing.timeScale = 1;
  plinkoState.render = MatterRef.Render.create({
    canvas: ui.plinkoCanvas,
    engine: plinkoState.engine,
    options: {
      width: ui.plinkoBoard.clientWidth,
      height: ui.plinkoBoard.clientHeight,
      wireframes: false,
      background: "transparent",
      pixelRatio: 1,
      hasBounds: true
    }
  });
  plinkoState.runner = MatterRef.Runner.create({
    isFixed: true,
    delta: 1000 / 120
  });
  MatterRef.Render.run(plinkoState.render);
  MatterRef.Runner.run(plinkoState.runner, plinkoState.engine);

  if (!plinkoState.eventsBound) {
    MatterRef.Events.on(plinkoState.engine, "beforeUpdate", onPlinkoBeforeUpdate);
    MatterRef.Events.on(plinkoState.engine, "collisionStart", onPlinkoCollisionStart);
    plinkoState.eventsBound = true;
  }
}

function clearPlinkoWorld() {
  const MatterRef = window.Matter;
  MatterRef.World.clear(plinkoState.engine.world, false);
  plinkoState.worldBodies = [];
  plinkoState.slotSensors = [];
  plinkoState.slotDividers = [];
  plinkoState.sideWalls = [];
}

function buildPlinkoBoardBodies() {
  const MatterRef = window.Matter;
  const rows = plinkoState.rows;
  const slotCount = rows + 1;
  const centerX = plinkoState.width / 2;
  const topY = 64;
  const bottomSlotsY = plinkoState.height - plinkoState.slotHeight;
  const usableHeight = Math.max(260, bottomSlotsY - topY - 20);
  const rowSpacing = usableHeight / rows;
  const slotWidth = Math.min((plinkoState.width - 80) / slotCount, 38);
  const pegSpacing = Math.min(slotWidth, 34);
  const baseWidth = slotWidth * slotCount;
  const leftBase = centerX - baseWidth / 2;
  const rightBase = centerX + baseWidth / 2;
  const wallThickness = 24;

  for (let row = 0; row < rows; row += 1) {
    const count = row + 1;
    const y = topY + row * rowSpacing;
    const rowWidth = (count - 1) * pegSpacing;
    const startX = centerX - rowWidth / 2;
    for (let col = 0; col < count; col += 1) {
      const peg = MatterRef.Bodies.circle(startX + col * pegSpacing, y, plinkoState.pegRadius, {
        isStatic: true,
        restitution: 0.96,
        friction: 0,
        frictionStatic: 0,
        render: {
          fillStyle: "#e7f5ff"
        }
      });
      plinkoState.worldBodies.push(peg);
    }
  }

  const leftWall = MatterRef.Bodies.rectangle(leftBase - wallThickness / 2, topY + (bottomSlotsY - topY) / 2, wallThickness, bottomSlotsY - topY + plinkoState.slotHeight + 24, {
    isStatic: true,
    restitution: 0.2,
    friction: 0,
    render: { fillStyle: "rgba(0,0,0,0)" }
  });
  const rightWall = MatterRef.Bodies.rectangle(rightBase + wallThickness / 2, topY + (bottomSlotsY - topY) / 2, wallThickness, bottomSlotsY - topY + plinkoState.slotHeight + 24, {
    isStatic: true,
    restitution: 0.2,
    friction: 0,
    render: { fillStyle: "rgba(0,0,0,0)" }
  });
  const topWall = MatterRef.Bodies.rectangle(centerX, topY - wallThickness / 2, baseWidth + 48, wallThickness, {
    isStatic: true,
    restitution: 0.2,
    friction: 0,
    render: { fillStyle: "rgba(0,0,0,0)" }
  });
  const bottomFloor = MatterRef.Bodies.rectangle(centerX, bottomSlotsY + plinkoState.slotHeight / 2 + 6, baseWidth + 8, 12, {
    isStatic: true,
    restitution: 0.3,
    friction: 0.02,
    render: { fillStyle: "rgba(0,0,0,0)" }
  });

  plinkoState.sideWalls.push(leftWall, rightWall);
  plinkoState.worldBodies.push(leftWall, rightWall, topWall, bottomFloor);

  for (let i = 0; i <= slotCount; i += 1) {
    const x = leftBase + i * slotWidth;
    const divider = MatterRef.Bodies.rectangle(x, bottomSlotsY + plinkoState.slotHeight / 2, 6, plinkoState.slotHeight + 16, {
      isStatic: true,
      restitution: 0.2,
      friction: 0,
      render: {
        fillStyle: "rgba(255,255,255,0.12)"
      }
    });
    plinkoState.slotDividers.push(divider);
    plinkoState.worldBodies.push(divider);
  }

  for (let i = 0; i < slotCount; i += 1) {
    const sensorX = leftBase + i * slotWidth + slotWidth / 2;
    const sensor = MatterRef.Bodies.rectangle(sensorX, bottomSlotsY + plinkoState.slotHeight - 12, slotWidth - 10, 12, {
      isStatic: true,
      isSensor: true,
      label: `slot-${i}`,
      render: { fillStyle: "rgba(0,0,0,0)" }
    });
    plinkoState.slotSensors.push(sensor);
    plinkoState.worldBodies.push(sensor);
  }

  MatterRef.World.add(plinkoState.engine.world, plinkoState.worldBodies);
}

function onPlinkoBeforeUpdate() {
  if (!plinkoState.engine) return;
  const now = performance.now();
  processPlinkoQueue(now);
  ui.plinkoStats.textContent = `Queued: ${plinkoState.queue} | In air: ${plinkoState.balls.length}`;
}

function processPlinkoQueue(now) {
  if (plinkoState.queue <= 0) {
    if (plinkoState.balls.length === 0) togglePlinkoButtons(false);
    return;
  }
  togglePlinkoButtons(true);
  if (now - plinkoState.lastDropAt < plinkoState.dropIntervalMs) return;

  const bet = Math.max(10, Number(ui.plinkoBet.value) || 0);
  if (bet > balance) {
    plinkoState.queue = 0;
    ui.plinkoResult.textContent = "Stopped: not enough balance for next ball.";
    return;
  }

  plinkoState.queue -= 1;
  plinkoState.lastDropAt = now;
  spawnPlinkoBall(bet);
}

function spawnPlinkoBall(bet) {
  const MatterRef = window.Matter;
  balance -= bet;
  refreshBalance();
  const ball = MatterRef.Bodies.circle(plinkoState.width / 2 + (Math.random() - 0.5) * 3, plinkoState.spawnY, plinkoState.ballRadius, {
    restitution: 0.82,
    friction: 0.01,
    frictionAir: 0.006,
    frictionStatic: 0,
    density: 0.003,
    slop: 0.01,
    label: "plinko-ball",
    render: {
      fillStyle: "#ffffff"
    }
  });
  ball.plugin = {
    plinkoBet: bet,
    resolved: false
  };
  plinkoState.balls.push(ball);
  MatterRef.World.add(plinkoState.engine.world, ball);
}

function onPlinkoCollisionStart(event) {
  const MatterRef = window.Matter;
  for (const pair of event.pairs) {
    const ball = getBallFromPair(pair.bodyA, pair.bodyB);
    const sensor = getSlotSensorFromPair(pair.bodyA, pair.bodyB);
    if (!ball) {
      if (pair.bodyA.label === "plinko-ball" || pair.bodyB.label === "plinko-ball") {
        playPlinkoTone(520 + Math.random() * 120, 0.012, 0.015);
      }
      continue;
    }
    if (!sensor || ball.plugin?.resolved) continue;

    const slotIndex = Number(sensor.label.replace("slot-", ""));
    const multiplier = plinkoState.multipliers[slotIndex] || 0;
    const bet = Number(ball.plugin?.plinkoBet || 0);
    const win = Math.floor(bet * multiplier);
    balance += win;
    refreshBalance();
    animateSlotHit(slotIndex, multiplier, win);
    ui.plinkoResult.textContent = `Landed on ${multiplier}x | Bet: ${bet} | Win: ${win}`;
    playPlinkoTone(multiplier >= 5 ? 820 : 640, 0.08, 0.04);
    ball.plugin.resolved = true;

    plinkoState.balls = plinkoState.balls.filter((b) => b.id !== ball.id);
    MatterRef.World.remove(plinkoState.engine.world, ball);
  }
}

function getBallFromPair(a, b) {
  if (a.label === "plinko-ball") return a;
  if (b.label === "plinko-ball") return b;
  return null;
}

function getSlotSensorFromPair(a, b) {
  if (a.isSensor && a.label.startsWith("slot-")) return a;
  if (b.isSensor && b.label.startsWith("slot-")) return b;
  return null;
}

function animateSlotHit(slotIndex, multiplier, win) {
  const target = ui.plinkoMultipliers.children[slotIndex];
  if (target) {
    target.classList.remove("hit");
    void target.offsetWidth;
    target.classList.add("hit");
  }

  const pop = document.createElement("span");
  pop.className = "win-pop";
  const slotArea = getSlotArea();
  const slotWidth = slotArea.width / plinkoState.multipliers.length;
  pop.style.left = `${slotArea.left + (slotIndex + 0.5) * slotWidth}px`;
  pop.style.top = `${ui.plinkoBoard.clientHeight - plinkoState.slotHeight - 20}px`;
  pop.textContent = `+${win} (${multiplier}x)`;
  ui.plinkoWinFx.appendChild(pop);
  window.setTimeout(() => pop.remove(), 1000);
}

function playPlinkoTone(freq, duration, volume) {
  if (!plinkoState.soundEnabled) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!plinkoState.audioCtx) {
    plinkoState.audioCtx = new AudioCtx();
  }
  const ctx = plinkoState.audioCtx;
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

function getSlotArea() {
  const slotCount = plinkoState.multipliers.length || (plinkoState.rows + 1);
  const slotWidth = Math.min((plinkoState.width - 90) / slotCount, 36);
  const width = slotWidth * slotCount;
  const left = (plinkoState.width - width) / 2;
  return {
    left,
    width
  };
}

function showDisclaimer() {
  ui.disclaimerOverlay.classList.remove("hidden");
  document.body.classList.add("disclaimer-open");
}

function hideDisclaimer() {
  ui.disclaimerOverlay.classList.add("hidden");
  document.body.classList.remove("disclaimer-open");
}

function adminLogin() {
  const name = ui.adminName.value.trim();
  const password = ui.adminPassword.value.trim();
  if (name !== ADMIN_NAME || password !== ADMIN_PASSWORD) {
    ui.adminAuthText.textContent = "Wrong credentials.";
    return;
  }
  isAdminLoggedIn = true;
  ui.adminAuthText.textContent = "Admin access granted.";
  ui.adminControls.classList.remove("hidden");
  renderAdminUsers();
}

function adminLogout() {
  isAdminLoggedIn = false;
  ui.adminControls.classList.add("hidden");
  ui.adminAuthText.textContent = "Login required.";
  ui.adminPassword.value = "";
}

function adminClearAllUsers() {
  if (!isAdminLoggedIn) return;
  usersStore = {};
  usersStore[currentUserId] = {
    id: currentUserId,
    balance: balance,
    createdAt: Date.now(),
    lastSeenAt: Date.now()
  };
  saveUsersStore();
  ui.adminAuthText.textContent = "All users deleted. Current user kept.";
  renderAdminUsers();
}

function renderAdminUsers() {
  if (!isAdminLoggedIn) return;
  usersStore = loadUsersStore();
  const users = Object.values(usersStore).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (users.length === 0) {
    ui.adminUsersList.innerHTML = "<p class='muted'>No users yet.</p>";
    return;
  }
  ui.adminUsersList.innerHTML = users.map((user) => {
    const isCurrent = user.id === currentUserId ? " (current session)" : "";
    return `
      <div class="admin-user-card">
        <p><strong>ID:</strong> ${user.id}${isCurrent}</p>
        <p><strong>Created:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
        <p><strong>Last seen:</strong> ${new Date(user.lastSeenAt).toLocaleString()}</p>
        <div class="admin-balance-row">
          <label for="balance-${user.id}">Balance:</label>
          <input id="balance-${user.id}" class="admin-balance-input" type="number" min="0" step="10" value="${Math.floor(user.balance || 0)}">
          <button class="tab" data-user-save="${user.id}">Save</button>
        </div>
      </div>
    `;
  }).join("");

  ui.adminUsersList.querySelectorAll("[data-user-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-user-save");
      if (!targetId || !usersStore[targetId]) return;
      const input = ui.adminUsersList.querySelector(`#balance-${targetId}`);
      if (!(input instanceof HTMLInputElement)) return;
      const nextBalance = Math.max(0, Number(input.value) || 0);
      usersStore[targetId].balance = nextBalance;
      usersStore[targetId].lastSeenAt = Date.now();
      saveUsersStore();
      ui.adminAuthText.textContent = `Balance updated for ${targetId}.`;
      if (targetId === currentUserId) {
        balance = nextBalance;
        refreshBalance();
      }
      renderAdminUsers();
    });
  });
}
