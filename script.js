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
  btnAdmin: document.getElementById("btnAdmin"),
  homeToRoulette: document.getElementById("homeToRoulette"),
  homeToMines: document.getElementById("homeToMines"),
  views: {
    home: document.getElementById("homeView"),
    roulette: document.getElementById("rouletteView"),
    mines: document.getElementById("minesView"),
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
  adminUsersList: document.getElementById("adminUsersList")
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
let balance = 5000;
let currentUserId = "";
let usersStore = {};
let isAdminLoggedIn = false;

init();

function init() {
  initUserSession();
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
}

function switchView(view) {
  Object.values(ui.views).forEach((v) => v.classList.remove("active"));
  ui.views[view].classList.add("active");
  [ui.btnHome, ui.btnRoulette, ui.btnMines, ui.btnAdmin].forEach((b) => b.classList.remove("active"));
  if (view === "home") ui.btnHome.classList.add("active");
  if (view === "roulette") ui.btnRoulette.classList.add("active");
  if (view === "mines") ui.btnMines.classList.add("active");
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
