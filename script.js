const multipliers = ["1.2x", "1.5x", "2x", "5x", "10x", "100x"];
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
  plinkoResult: document.getElementById("plinkoResult")
};

const rouletteState = {
  running: false,
  x: 0,
  raf: 0,
  target: "",
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
  pegs: [],
  balls: [],
  queue: 0,
  lastDropAt: 0,
  dropIntervalMs: 130,
  raf: 0,
  running: false,
  pendingBets: 0,
  width: 0,
  height: 0,
  topY: 52,
  slotHeight: 48,
  pegRadius: 5,
  ballRadius: 7,
  gravity: 1180,
  wallBounce: 0.72,
  pegBounce: 0.78,
  friction: 0.995,
  ctx: null,
  soundEnabled: true,
  audioCtx: null,
  resizeObserver: null
};
let balance = 5000;
let currentUserId = "";
let usersStore = {};
let isAdminLoggedIn = false;

init();

function init() {
  initUserSession();
  bindEvents();
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
    card.className = `multiplier-card ${value === "100x" ? "x100" : ""}`;
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
  buildRouletteTrack();
  rouletteState.running = true;
  rouletteState.target = weightedPick([
    { value: "1.2x", weight: 38 },
    { value: "1.5x", weight: 26 },
    { value: "2x", weight: 18 },
    { value: "5x", weight: 12 },
    { value: "10x", weight: 5.5 },
    { value: "100x", weight: 0.5 }
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
  ui.rouletteResult.textContent = `Result: ${rouletteState.target}`;
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
  plinkoState.rows = Number(ui.plinkoRows.value);
  plinkoState.risk = ui.plinkoRisk.value;
  plinkoState.soundEnabled = ui.plinkoSound.checked;
  plinkoState.ctx = ui.plinkoCanvas.getContext("2d");
  setupPlinkoResize();
  rebuildPlinkoBoard();
  startPlinkoLoop();
}

function rebuildPlinkoBoard() {
  updatePlinkoCanvasSize();
  plinkoState.pegs = buildPegLayout(plinkoState.rows, plinkoState.width, plinkoState.height, plinkoState.topY, plinkoState.slotHeight);
  plinkoState.multipliers = generatePlinkoMultipliers(plinkoState.rows, plinkoState.risk);
  plinkoState.balls = [];
  plinkoState.queue = 0;
  plinkoState.pendingBets = 0;
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
  ui.plinkoMultipliers.innerHTML = plinkoState.multipliers.map((mult) => {
    const cls = mult >= max * 0.7 ? "high" : mult <= 1 ? "low" : "mid";
    return `<span class="plinko-mult ${cls}">${mult}x</span>`;
  }).join("");
  ui.plinkoMultipliers.style.gridTemplateColumns = `repeat(${plinkoState.multipliers.length}, 1fr)`;
}

function queuePlinkoDrops(count) {
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
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", rebuildPlinkoBoard);
    return;
  }
  if (plinkoState.resizeObserver) {
    plinkoState.resizeObserver.disconnect();
  }
  plinkoState.resizeObserver = new ResizeObserver(() => {
    rebuildPlinkoBoard();
  });
  plinkoState.resizeObserver.observe(ui.plinkoBoard);
}

function updatePlinkoCanvasSize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = ui.plinkoBoard.getBoundingClientRect();
  plinkoState.width = Math.max(320, rect.width);
  plinkoState.height = Math.max(300, rect.height);
  ui.plinkoCanvas.width = Math.floor(plinkoState.width * dpr);
  ui.plinkoCanvas.height = Math.floor(plinkoState.height * dpr);
  if (plinkoState.ctx) {
    plinkoState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function buildPegLayout(rows, width, height, topY, slotHeight) {
  const pegs = [];
  const playableHeight = height - slotHeight - topY - 10;
  const rowGap = playableHeight / rows;
  const usableWidth = Math.min(width - 36, rows * 30);
  const centerX = width / 2;

  for (let row = 0; row < rows; row += 1) {
    const cols = row + 1;
    const y = topY + rowGap * (row + 0.5);
    const rowWidth = (cols - 1) * (usableWidth / rows);
    const startX = centerX - rowWidth / 2;
    for (let col = 0; col < cols; col += 1) {
      pegs.push({
        x: startX + col * (usableWidth / rows),
        y
      });
    }
  }
  return pegs;
}

function startPlinkoLoop() {
  if (plinkoState.running) return;
  plinkoState.running = true;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    processPlinkoQueue(now);
    stepPlinkoPhysics(dt);
    drawPlinkoBoard();
    plinkoState.raf = requestAnimationFrame(frame);
  }

  plinkoState.raf = requestAnimationFrame(frame);
}

function processPlinkoQueue(now) {
  if (plinkoState.queue <= 0) {
    if (plinkoState.balls.length === 0) {
      togglePlinkoButtons(false);
    }
    return;
  }
  togglePlinkoButtons(true);
  if (now - plinkoState.lastDropAt < plinkoState.dropIntervalMs) return;

  const bet = Math.max(10, Number(ui.plinkoBet.value) || 0);
  if (bet > balance) {
    plinkoState.queue = 0;
    plinkoState.pendingBets = 0;
    ui.plinkoResult.textContent = "Stopped: not enough balance for next ball.";
    return;
  }

  plinkoState.queue -= 1;
  plinkoState.pendingBets = Math.max(0, plinkoState.pendingBets - 1);
  plinkoState.lastDropAt = now;
  spawnPlinkoBall(bet);
  ui.plinkoStats.textContent = `Queued: ${plinkoState.queue} | In air: ${plinkoState.balls.length}`;
}

function spawnPlinkoBall(bet) {
  balance -= bet;
  refreshBalance();
  plinkoState.balls.push({
    x: plinkoState.width / 2 + (Math.random() - 0.5) * 2.2,
    y: 22,
    vx: (Math.random() - 0.5) * 14,
    vy: 0,
    r: plinkoState.ballRadius,
    bet,
    settled: false
  });
}

function stepPlinkoPhysics(dt) {
  if (plinkoState.balls.length === 0) return;
  const floorY = plinkoState.height - plinkoState.slotHeight - 2;

  for (let i = plinkoState.balls.length - 1; i >= 0; i -= 1) {
    const ball = plinkoState.balls[i];
    if (ball.settled) continue;

    ball.vy += plinkoState.gravity * dt;
    ball.vx *= plinkoState.friction;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx) * plinkoState.wallBounce;
    } else if (ball.x + ball.r > plinkoState.width) {
      ball.x = plinkoState.width - ball.r;
      ball.vx = -Math.abs(ball.vx) * plinkoState.wallBounce;
    }

    for (let p = 0; p < plinkoState.pegs.length; p += 1) {
      const peg = plinkoState.pegs[p];
      const dx = ball.x - peg.x;
      const dy = ball.y - peg.y;
      const minDist = ball.r + plinkoState.pegRadius;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= (1 + plinkoState.pegBounce) * dot * nx;
          ball.vy -= (1 + plinkoState.pegBounce) * dot * ny;
          ball.vx += (Math.random() - 0.5) * 40;
          playPlinkoTone(520 + Math.random() * 120, 0.016, 0.02);
        }
      }
    }

    if (ball.y + ball.r >= floorY) {
      settlePlinkoBall(i);
    }
  }
}

function settlePlinkoBall(ballIndex) {
  const ball = plinkoState.balls[ballIndex];
  const slotCount = plinkoState.multipliers.length;
  const slotWidth = plinkoState.width / slotCount;
  const slotIndex = Math.max(0, Math.min(slotCount - 1, Math.floor(ball.x / slotWidth)));
  const multiplier = plinkoState.multipliers[slotIndex];
  const win = Math.floor(ball.bet * multiplier);
  balance += win;
  refreshBalance();
  animateSlotHit(slotIndex, multiplier, win);
  ui.plinkoResult.textContent = `Landed on ${multiplier}x | Bet: ${ball.bet} | Win: ${win}`;
  ui.plinkoStats.textContent = `Queued: ${plinkoState.queue} | In air: ${Math.max(0, plinkoState.balls.length - 1)}`;
  plinkoState.balls.splice(ballIndex, 1);
  playPlinkoTone(multiplier >= 5 ? 800 : 620, 0.08, 0.04);
}

function drawPlinkoBoard() {
  const ctx = plinkoState.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, plinkoState.width, plinkoState.height);
  drawPlinkoBackground(ctx);
  drawPlinkoPegs(ctx);
  drawPlinkoSlots(ctx);
  drawPlinkoBalls(ctx);
}

function drawPlinkoBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, plinkoState.height);
  grad.addColorStop(0, "rgba(16, 50, 80, 0.35)");
  grad.addColorStop(1, "rgba(8, 20, 32, 0.45)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, plinkoState.width, plinkoState.height);
}

function drawPlinkoPegs(ctx) {
  for (const peg of plinkoState.pegs) {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, plinkoState.pegRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#e6f2ff";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(170, 220, 255, 0.8)";
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawPlinkoSlots(ctx) {
  const slotCount = plinkoState.multipliers.length;
  const slotWidth = plinkoState.width / slotCount;
  const top = plinkoState.height - plinkoState.slotHeight;
  for (let i = 0; i < slotCount; i += 1) {
    const mult = plinkoState.multipliers[i];
    const isHigh = mult >= Math.max(...plinkoState.multipliers) * 0.7;
    const isLow = mult <= 1;
    ctx.fillStyle = isHigh ? "#d82155" : isLow ? "#d38f11" : "#d46a27";
    ctx.fillRect(i * slotWidth + 1, top, slotWidth - 2, plinkoState.slotHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(`${mult}x`, i * slotWidth + slotWidth / 2, top + 28);
  }
}

function drawPlinkoBalls(ctx) {
  for (const ball of plinkoState.balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.r);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(1, "#d7ebff");
    ctx.fillStyle = glow;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(255, 255, 255, 0.85)";
    ctx.fill();
  }
  ctx.shadowBlur = 0;
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
  pop.style.left = `${(slotIndex + 0.5) * (ui.plinkoBoard.clientWidth / plinkoState.multipliers.length)}px`;
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
