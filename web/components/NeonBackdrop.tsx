"use client";

import { motion } from "framer-motion";

export function NeonBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute left-[-20%] top-[-25%] h-[520px] w-[520px] rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-22%] top-[-18%] h-[520px] w-[520px] rounded-full bg-cyan/14 blur-3xl"
        animate={{ x: [0, -32, 0], y: [0, 24, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-35%] left-[10%] h-[640px] w-[640px] rounded-full bg-gold/12 blur-3xl"
        animate={{ x: [0, 26, 0], y: [0, -22, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.08),transparent_55%)] opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),rgba(0,0,0,0.45))]" />
    </div>
  );
}

