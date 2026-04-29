import { cn } from "@/lib/cn";

export function GlassCard(props: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-xl2 border border-white/10 bg-white/[0.04] shadow-[0_26px_80px_rgba(0,0,0,0.62)] backdrop-blur-xl",
        "relative overflow-hidden",
        props.className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-24 left-[-18%] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -top-28 right-[-20%] h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
      </div>
      <div className="relative">{props.children}</div>
    </div>
  );
}

