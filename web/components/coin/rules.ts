import { rand01 } from "@/lib/rng";

export type CoinOutcome = "heads" | "tails" | "edge";

export const ODDS = {
  edgeChance: 0.0075, // 0.75% (<= 1%)
  headsChanceOfNonEdge: 0.5,
} as const;

export function rollOutcome(): CoinOutcome {
  const r = rand01();
  if (r < ODDS.edgeChance) return "edge";
  return rand01() < ODDS.headsChanceOfNonEdge ? "heads" : "tails";
}

export function multiplierForPick(pick: CoinOutcome) {
  return pick === "edge" ? 20 : 2;
}

export function labelForOutcome(o: CoinOutcome) {
  if (o === "heads") return "Heads";
  if (o === "tails") return "Tails";
  return "Edge";
}

