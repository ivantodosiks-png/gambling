"use client";

import { AnimatePresence, motion } from "framer-motion";

export type ToastKind = "ok" | "err" | "warn";
export type ToastItem = { id: string; title: string; sub?: string; kind: ToastKind };

export function Toasts(props: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] grid gap-2">
      <AnimatePresence initial={false}>
        {props.items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={[
              "w-[min(380px,calc(100vw-32px))] rounded-xl2 border bg-bg-0/70 p-3 backdrop-blur-xl",
              "shadow-[0_26px_80px_rgba(0,0,0,0.62)]",
              t.kind === "ok"
                ? "border-win/35 shadow-[0_26px_80px_rgba(0,0,0,0.62),0_0_0_1px_rgb(var(--win)/0.12)]"
                : t.kind === "err"
                  ? "border-lose/35 shadow-[0_26px_80px_rgba(0,0,0,0.62),0_0_0_1px_rgb(var(--lose)/0.12)]"
                  : "border-gold/40 shadow-[0_26px_80px_rgba(0,0,0,0.62),0_0_0_1px_rgb(var(--gold)/0.14)]",
            ].join(" ")}
          >
            <div className="text-sm font-extrabold tracking-tight">{t.title}</div>
            {t.sub ? <div className="mt-1 text-sm text-muted/80">{t.sub}</div> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

