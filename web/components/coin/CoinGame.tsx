"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { NeonBackdrop } from "@/components/NeonBackdrop";
import { TopBar } from "@/components/TopBar";
import { GlassCard } from "@/components/GlassCard";
import { MotionButton } from "@/components/MotionButton";
import { fmt } from "@/lib/format";
import { CoinScene } from "@/components/coin/CoinScene";
import { labelForOutcome, multiplierForPick, rollOutcome, type CoinOutcome } from "@/components/coin/rules";
import { loadBalance, saveBalance } from "@/components/coin/storage";
import { Toasts, type ToastItem, type ToastKind } from "@/components/coin/Toast";

const DEFAULT_BALANCE = 1000;

export function CoinGame() {
  const [balance, setBalance] = useState(DEFAULT_BALANCE);
  const [bet, setBet] = useState(100);
  const [pick, setPick] = useState<CoinOutcome>("heads");
  const [outcome, setOutcome] = useState<CoinOutcome>("heads");
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind?: ToastKind }>({ text: "" });
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const maxBet = Math.max(1, balance);
  const mult = multiplierForPick(pick);

  useEffect(() => {
    setBalance(loadBalance(DEFAULT_BALANCE));
  }, []);

  useEffect(() => {
    saveBalance(balance);
  }, [balance]);

  const betHint = useMemo(() => {
    if (bet <= 0) return "Enter a positive bet.";
    if (bet > balance) return "Bet is larger than your balance.";
    return `Max bet: ${fmt(balance)}.`;
  }, [bet, balance]);

  const pushToast = (kind: ToastKind, title: string, sub?: string) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
    const item: ToastItem = { id, kind, title, sub };
    setToasts((s) => [item, ...s].slice(0, 4));
    window.setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 2600);
  };

  const clampBet = (n: number) => {
    const x = Math.floor(Number(n));
    if (!Number.isFinite(x)) return 1;
    return Math.max(1, Math.min(maxBet, x));
  };

  const placeBetAndToss = async () => {
    if (spinning) return;

    const b = clampBet(bet);
    if (b > balance) {
      setMsg({ text: "Bet is larger than your balance.", kind: "err" });
      pushToast("warn", "Not enough balance", "Lower your bet.");
      return;
    }

    setMsg({ text: "" });
    setSpinning(true);

    // Deduct immediately.
    setBalance((x) => x - b);

    // Roll outcome now (we animate towards it).
    const nextOutcome = rollOutcome();
    setOutcome(nextOutcome);

    // Let the 3D component pick up state before we wait.
    await new Promise((r) => setTimeout(r, 20));

    // Match Coin3D duration (slightly longer than 1.35s to include settle).
    await new Promise((r) => setTimeout(r, 1450));

    const won = nextOutcome === pick;
    const payout = won ? b * mult : 0;

    if (won) {
      setBalance((x) => x + payout);
      setMsg({ text: `Win: +${fmt(payout)} (x${mult})`, kind: "ok" });
      pushToast("ok", "Win", `+${fmt(payout)} • Result: ${labelForOutcome(nextOutcome)}`);
    } else {
      setMsg({ text: `Loss: -${fmt(b)} • Landed: ${labelForOutcome(nextOutcome)}`, kind: "err" });
      pushToast("err", "Loss", `-${fmt(b)} • Result: ${labelForOutcome(nextOutcome)}`);
    }

    setSpinning(false);
  };

  return (
    <div className="min-h-screen">
      <NeonBackdrop />
      <TopBar balance={balance} userTag="offline" />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold tracking-tight">Coin Toss</div>
            <div className="mt-1 text-sm text-muted/80">Heads / Tails / Edge • place a bet and toss.</div>
          </div>
          <Link
            href="/"
            className="rounded-2xl border border-white/14 bg-white/[0.02] px-3 py-2 text-sm font-extrabold hover:bg-white/[0.04] hover:shadow-glow"
          >
            Dashboard
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <GlassCard className="p-5">
            <div className="text-base font-extrabold tracking-tight">Bet</div>
            <div className="mt-1 text-sm text-muted/80">Pick an outcome, enter a bet, then toss.</div>

            <div className="mt-4 rounded-xl2 border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs font-extrabold text-muted/80">Amount</div>
                <div className="text-xs text-muted/80">Coins</div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="min-w-[180px] flex-1 rounded-2xl border border-white/14 bg-white/[0.04] px-3 py-3 text-sm font-extrabold tabular-nums outline-none focus:border-cyan/45 focus:shadow-[0_0_0_3px_rgb(var(--cyan)/0.14)]"
                  inputMode="numeric"
                  value={String(bet)}
                  onChange={(e) => setBet(clampBet(Number(e.target.value)))}
                  disabled={spinning}
                />
                <div className="flex flex-wrap gap-2">
                  <MotionButton variant="chip" disabled={spinning} onClick={() => setBet(clampBet(bet / 2))}>
                    1/2
                  </MotionButton>
                  <MotionButton variant="chip" disabled={spinning} onClick={() => setBet(clampBet(bet * 2))}>
                    2x
                  </MotionButton>
                  <MotionButton variant="chip" disabled={spinning} onClick={() => setBet(clampBet(balance))}>
                    MAX
                  </MotionButton>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted/75">{betHint}</div>
            </div>

            <div className="mt-4 rounded-xl2 border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-extrabold text-muted/80">Pick outcome</div>
              <div className="mt-2 grid grid-cols-3 gap-2 max-[520px]:grid-cols-1">
                <PickButton
                  active={pick === "heads"}
                  label="Heads"
                  badge="x2"
                  onClick={() => setPick("heads")}
                  disabled={spinning}
                />
                <PickButton
                  active={pick === "tails"}
                  label="Tails"
                  badge="x2"
                  onClick={() => setPick("tails")}
                  disabled={spinning}
                />
                <PickButton
                  active={pick === "edge"}
                  label="Edge"
                  badge="x20"
                  onClick={() => setPick("edge")}
                  disabled={spinning}
                  edge
                />
              </div>
              <div className="mt-2 text-xs text-muted/75">Edge is extremely rare (≤ 1%).</div>
            </div>

            <div className="mt-4">
              <MotionButton className="w-full py-3 text-base" disabled={spinning} onClick={placeBetAndToss}>
                Place bet & toss
              </MotionButton>
              <div className={["mt-3 min-h-5 text-sm", msg.kind === "ok" ? "text-win" : msg.kind === "err" ? "text-lose" : "text-muted/80"].join(" ")}>
                {msg.text}
              </div>
            </div>

            <div className="mt-4 rounded-xl2 border border-white/10 bg-white/[0.03] p-4 text-xs text-muted/75">
              Simulator only. No real money. Balance is stored locally in your browser.
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-extrabold tracking-tight">Coin</div>
                <div className="mt-1 text-sm text-muted/80">
                  Pick: <span className="font-extrabold text-fg/95">{labelForOutcome(pick)}</span> • Bet:{" "}
                  <span className="font-extrabold tabular-nums text-fg/95">{fmt(bet)}</span> • Multiplier:{" "}
                  <span className="font-extrabold text-gold/90">x{mult}</span>
                </div>
              </div>
              <motion.div
                className="rounded-full border border-white/12 bg-white/[0.035] px-4 py-2 text-sm font-extrabold"
                animate={{
                  borderColor:
                    !spinning && outcome === pick ? "rgba(0,255,136,0.30)" : !spinning && msg.kind === "err" ? "rgba(255,59,59,0.30)" : "rgba(255,255,255,0.14)",
                }}
                transition={{ duration: 0.25 }}
              >
                Result: <span className="text-muted/90">{spinning ? "…" : labelForOutcome(outcome)}</span>
              </motion.div>
            </div>

            <div className="mt-4">
              <CoinScene outcome={outcome} spinning={spinning} />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <StatPill label="Balance" value={fmt(balance)} />
              <StatPill label="Bet" value={fmt(clampBet(bet))} />
              <StatPill label="Payout (if win)" value={fmt(clampBet(bet) * mult)} accent="gold" />
            </div>
          </GlassCard>
        </div>
      </main>

      <Toasts items={toasts} />
    </div>
  );
}

function StatPill(props: { label: string; value: string; accent?: "gold" }) {
  return (
    <div className="flex items-center justify-between rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-xs font-extrabold text-muted/80">{props.label}</div>
      <div className={["font-extrabold tabular-nums", props.accent === "gold" ? "text-gold/90" : ""].join(" ")}>
        {props.value}
      </div>
    </div>
  );
}

function PickButton(props: {
  active: boolean;
  label: string;
  badge: string;
  onClick: () => void;
  disabled?: boolean;
  edge?: boolean;
}) {
  const cls = props.edge
    ? props.active
      ? "border-gold/70 shadow-[0_0_0_3px_rgb(var(--gold)/0.14)_inset]"
      : "border-white/14 hover:border-gold/40 hover:shadow-[0_0_0_1px_rgb(var(--gold)/0.18),0_0_40px_rgb(var(--gold)/0.10)]"
    : props.active
      ? "border-primary/60 shadow-[0_0_0_3px_rgb(var(--primary)/0.14)_inset]"
      : "border-white/14 hover:border-cyan/25 hover:shadow-glowBlue";

  return (
    <motion.button
      whileHover={props.disabled ? undefined : { y: -1 }}
      whileTap={props.disabled ? undefined : { y: 0, scale: 0.99 }}
      disabled={props.disabled}
      onClick={props.onClick}
      className={[
        "flex items-center justify-between gap-2 rounded-xl2 border bg-white/[0.04] px-4 py-3 text-left font-extrabold",
        "shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        cls,
      ].join(" ")}
    >
      <span>{props.label}</span>
      <span className="rounded-full border border-white/12 bg-white/[0.035] px-3 py-1 text-xs font-extrabold text-muted/90">
        {props.badge}
      </span>
    </motion.button>
  );
}

