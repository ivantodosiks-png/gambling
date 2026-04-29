const BALANCE_KEY = "web_balance_v1";

export function loadBalance(defaultBalance: number) {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch {}
  return defaultBalance;
}

export function saveBalance(balance: number) {
  try {
    localStorage.setItem(BALANCE_KEY, String(Math.max(0, Math.floor(balance))));
  } catch {}
}

