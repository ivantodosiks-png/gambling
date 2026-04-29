export function rand01() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  } catch {
    return Math.random();
  }
}

