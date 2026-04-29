"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/cn";

export function GameCard(props: {
  title: string;
  description: string;
  href: string;
  accent?: "violet" | "cyan" | "gold";
  badge?: string;
}) {
  const accent = props.accent ?? "violet";
  const glow =
    accent === "cyan"
      ? "shadow-glowBlue"
      : accent === "gold"
        ? "shadow-[0_0_0_1px_rgb(var(--gold)/0.18),0_0_40px_rgb(var(--gold)/0.10)]"
        : "shadow-glow";

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
      <Link href={props.href} className="block">
        <GlassCard className={cn("p-5 hover:border-white/16", glow)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-extrabold tracking-tight">{props.title}</div>
              <div className="mt-1 text-sm text-muted/80">{props.description}</div>
            </div>
            {props.badge ? (
              <div className="rounded-full border border-white/12 bg-white/[0.035] px-3 py-1 text-xs font-extrabold text-muted/90">
                {props.badge}
              </div>
            ) : null}
          </div>

          <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full w-1/3", accentBar(accent))} />
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  );
}

function accentBar(accent: "violet" | "cyan" | "gold") {
  if (accent === "cyan") return "bg-gradient-to-r from-cyan/0 via-cyan/70 to-cyan/0";
  if (accent === "gold") return "bg-gradient-to-r from-gold/0 via-gold/80 to-gold/0";
  return "bg-gradient-to-r from-primary/0 via-primary/70 to-primary/0";
}

