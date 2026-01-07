import { SwapInterface } from "@/components/SwapInterface";
import { Leaderboard } from "@/components/Leaderboard";
import { FeeTransparency } from "@/components/FeeTransparency";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center p-4 md:p-24">
      <div className="z-10 w-full max-w-6xl items-start justify-center gap-8 lg:flex">

        {/* Main Swap Area */}
        <div className="flex w-full flex-col items-center gap-8">
          <SwapInterface />
          {/* Vibe Text */}
          <div className="text-center text-muted-foreground opacity-50">
            <p className="text-xs tracking-[0.2em]">NON-CUSTODIAL • SOLANA NATIVE • TRADER FIRST</p>
          </div>

          {/* Mobile Fee View (visible on mobile only if needed, but sidebar is hidden on mobile so let's check) */}
          <div className="block w-full max-w-md lg:hidden">
            <FeeTransparency />
          </div>
        </div>

        {/* Sidebar / Leaderboard */}
        <div className="hidden w-full max-w-sm space-y-4 lg:block">
          <Leaderboard />
          <FeeTransparency />
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="mb-2 text-sm font-bold text-white">System Status</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Jupiter API</span> <span className="text-green-500">Operational</span></div>
              <div className="flex justify-between"><span>Solana TPS</span> <span className="text-green-500">2,450</span></div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
