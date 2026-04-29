import { NeonBackdrop } from "@/components/NeonBackdrop";
import { TopBar } from "@/components/TopBar";
import { GlassCard } from "@/components/GlassCard";
import { GameCard } from "@/components/GameCard";

export default function HomePage() {
  // This new Next.js UI is a redesign concept running alongside the legacy static site.
  const balance = 1000;

  return (
    <div className="min-h-screen">
      <NeonBackdrop />
      <TopBar balance={balance} userTag="offline" />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <GlassCard className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-2xl font-extrabold tracking-tight">Premium Casino Simulator UI</div>
                  <div className="mt-2 max-w-2xl text-sm text-muted/80">
                    A modern dark-luxury redesign: glow accents, glass UI, micro-interactions, and motion-first layout.
                    Virtual coins only.
                  </div>
                </div>
                <div className="rounded-full border border-white/12 bg-white/[0.035] px-4 py-2 text-sm font-extrabold text-muted/90">
                  60fps motion • lazy visuals • modular components
                </div>
              </div>
            </GlassCard>

            <div className="grid gap-3 md:grid-cols-2">
              <GameCard
                title="Coin Toss"
                description="Place a bet, pick Heads/Tails/Edge, enjoy premium motion."
                href="/games/coin"
                accent="gold"
                badge="NEW"
              />
              <GameCard
                title="Roulette (UI stub)"
                description="High-end table layout placeholder (wire-ready)."
                href="/"
                accent="violet"
                badge="WIP"
              />
              <GameCard
                title="Mines (UI stub)"
                description="AAA-style grid & risk ladder placeholder."
                href="/"
                accent="cyan"
                badge="WIP"
              />
              <GameCard
                title="Blackjack (UI stub)"
                description="Dealer table concept placeholder."
                href="/"
                accent="violet"
                badge="WIP"
              />
            </div>
          </div>

          <aside className="space-y-4">
            <GlassCard className="p-5">
              <div className="text-sm font-extrabold tracking-tight">Dashboard</div>
              <div className="mt-2 grid gap-2">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs text-muted/80">Balance</div>
                  <div className="font-extrabold tabular-nums">{balance.toLocaleString("en-US")}</div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs text-muted/80">Session</div>
                  <div className="text-xs font-extrabold text-muted/90">offline</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="text-sm font-extrabold tracking-tight">Activity</div>
              <div className="mt-2 space-y-2 text-sm text-muted/80">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  Win/Loss animations, toast feedback, and smooth transitions live on the Coin page.
                </div>
              </div>
            </GlassCard>
          </aside>
        </div>
      </main>
    </div>
  );
}

