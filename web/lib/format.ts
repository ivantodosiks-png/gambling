export function fmt(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return Math.floor(x).toLocaleString("en-US");
}

