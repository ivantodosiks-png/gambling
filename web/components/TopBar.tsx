"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function TopBar(props: { balance: number; userTag?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg-0/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-primary/95 via-cyan/35 to-primary/70 text-[#07110c] shadow-[0_18px_34px_rgba(0,0,0,0.52)]">
            G
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">Gambling Simulator</div>
            <div className="text-xs text-muted/80">Virtual coins only • Premium UI concept</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={pillClass()}>
            Balance: <span className="font-extrabold tabular-nums">{props.balance.toLocaleString("en-US")}</span>
          </div>
          <div className={pillClass("hidden sm:inline-flex")}>
            <code className="text-xs">{props.userTag ?? "offline"}</code>
          </div>
          <motion.div whileHover={{ y: -1 }} whileTap={{ y: 0 }}>
            <Link
              className={cn(
                "inline-flex items-center rounded-2xl border border-white/14 px-3 py-2 text-sm font-extrabold",
                "bg-white/[0.02] hover:bg-white/[0.04] hover:shadow-glow",
              )}
              href="/games/coin"
            >
              Coin
            </Link>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

function pillClass(extra?: string) {
  return cn(
    "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.035] px-3 py-2 text-sm font-bold shadow-[0_12px_30px_rgba(0,0,0,0.22)]",
    extra,
  );
}

