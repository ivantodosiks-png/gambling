"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function MotionButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "chip" },
) {
  const variant = props.variant ?? "primary";
  const cls =
    variant === "primary"
      ? "bg-gradient-to-br from-primary/95 to-primary/85 text-white shadow-[0_18px_60px_rgba(168,85,255,0.16)] hover:shadow-glow"
      : variant === "chip"
        ? "border border-white/14 bg-white/[0.06] text-fg shadow-none hover:shadow-glowBlue hover:border-cyan/25"
        : "border border-white/14 bg-transparent text-fg shadow-[0_12px_30px_rgba(0,0,0,0.22)] hover:shadow-glow hover:border-primary/35";

  return (
    <motion.button
      whileHover={props.disabled ? undefined : { y: -1 }}
      whileTap={props.disabled ? undefined : { y: 0, scale: 0.99 }}
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-extrabold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        cls,
        props.className,
      )}
    />
  );
}

