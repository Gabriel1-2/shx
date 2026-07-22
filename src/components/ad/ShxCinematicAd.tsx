"use client";

/**
 * Fully coded SHX cinematic ad — no AI video.
 * Timed scene sequencer + canvas particles + framer-motion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
    Volume2,
    VolumeX,
    Pause,
    Play,
    RotateCcw,
    SkipForward,
    X,
    Zap,
    Shield,
    Gift,
    Rocket,
    Activity,
    Bot,
} from "lucide-react";

type Scene = {
    id: string;
    durationMs: number;
    kicker?: string;
    title: string;
    sub?: string;
    lines?: string[];
    accent: "green" | "orange" | "cyan" | "purple" | "white";
    visual: "vault" | "routes" | "tiers" | "usdc" | "pro" | "proof" | "agent" | "split" | "logo";
};

const SCENES: Scene[] = [
    {
        id: "hook",
        durationMs: 9000,
        kicker: "0:00",
        title: "They want your deposit.",
        sub: "We want your edge.",
        lines: ["Non-custodial. Always.", "Keys stay in your wallet."],
        accent: "green",
        visual: "vault",
    },
    {
        id: "ultra",
        durationMs: 9000,
        kicker: "ULTRA",
        title: "Best routes. On Solana.",
        sub: "Jupiter Ultra under the hood.",
        lines: ["Deep liquidity.", "Settled on-chain."],
        accent: "cyan",
        visual: "routes",
    },
    {
        id: "tiers",
        durationMs: 9000,
        kicker: "LOYALTY",
        title: "Hold SHX. Pay less.",
        sub: "0.65% → 0.50% · Buy SHX at 0% platform fee.",
        lines: ["Base · Silver · Gold · Platinum · Diamond"],
        accent: "purple",
        visual: "tiers",
    },
    {
        id: "refer",
        durationMs: 9000,
        kicker: "USDC",
        title: "Invite. Earn real cash.",
        sub: "25–35% of fees after real volume — paid in USDC.",
        lines: ["Not points.", "Not vapor seasons."],
        accent: "green",
        visual: "usdc",
    },
    {
        id: "pro",
        durationMs: 8000,
        kicker: "PRO DESK",
        title: "Limit. DCA. Ape.",
        sub: "One terminal. Full control.",
        lines: ["Turbo land · size chips · live tape"],
        accent: "orange",
        visual: "pro",
    },
    {
        id: "proof",
        durationMs: 8000,
        kicker: "LEDGER",
        title: "Live proof. Not marketing.",
        sub: "Traders · volume · public tape.",
        lines: ["Transparency is the product."],
        accent: "cyan",
        visual: "proof",
    },
    {
        id: "agent",
        durationMs: 8000,
        kicker: "AGENTS",
        title: "Built for humans.",
        sub: "Ready for agents.",
        lines: ["API · MCP · bots · your signature"],
        accent: "purple",
        visual: "agent",
    },
    {
        id: "close",
        durationMs: 10000,
        kicker: "SHX",
        title: "Trade Solana.\nKeep your keys.\nGet paid in USDC.",
        sub: "shx.exchange",
        lines: ["Non-custodial · Jupiter Ultra · Partner program"],
        accent: "green",
        visual: "logo",
    },
];

const ACCENT: Record<Scene["accent"], string> = {
    green: "#22c55e",
    orange: "#f97316",
    cyan: "#22d3ee",
    purple: "#a855f7",
    white: "#f4f4f5",
};

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const fn = () => setReduced(mq.matches);
        mq.addEventListener("change", fn);
        return () => mq.removeEventListener("change", fn);
    }, []);
    return reduced;
}

/** Lightweight sci-fi UI ticks via Web Audio (no assets). */
function useAdAudio(enabled: boolean) {
    const ctxRef = useRef<AudioContext | null>(null);

    const ensure = useCallback(() => {
        if (typeof window === "undefined") return null;
        if (!ctxRef.current) {
            const AC =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            ctxRef.current = new AC();
        }
        return ctxRef.current;
    }, []);

    const blip = useCallback(
        (freq = 440, dur = 0.08, type: OscillatorType = "sine", gain = 0.04) => {
            if (!enabled) return;
            const ctx = ensure();
            if (!ctx) return;
            if (ctx.state === "suspended") void ctx.resume();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = type;
            o.frequency.value = freq;
            g.gain.value = gain;
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + dur);
        },
        [enabled, ensure]
    );

    const whoosh = useCallback(() => {
        if (!enabled) return;
        const ctx = ensure();
        if (!ctx) return;
        if (ctx.state === "suspended") void ctx.resume();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(120, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
        g.gain.value = 0.025;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.35);
    }, [enabled, ensure]);

    return { blip, whoosh };
}

function ParticleField({ color, intensity }: { color: string; intensity: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || reduced) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        let w = 0;
        let h = 0;
        const particles = Array.from({ length: 60 }, () => ({
            x: Math.random(),
            y: Math.random(),
            z: Math.random() * 0.8 + 0.2,
            vx: (Math.random() - 0.5) * 0.00035,
            vy: -Math.random() * 0.00045 - 0.0001,
        }));

        const resize = () => {
            w = canvas.width = canvas.offsetWidth * devicePixelRatio;
            h = canvas.height = canvas.offsetHeight * devicePixelRatio;
            ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        };
        resize();
        window.addEventListener("resize", resize);

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            const cssW = canvas.offsetWidth;
            const cssH = canvas.offsetHeight;
            for (const p of particles) {
                p.x += p.vx * intensity;
                p.y += p.vy * intensity;
                if (p.y < -0.05) p.y = 1.05;
                if (p.x < -0.05) p.x = 1.05;
                if (p.x > 1.05) p.x = -0.05;
                const px = p.x * cssW;
                const py = p.y * cssH;
                const r = p.z * 2.2;
                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.15 + p.z * 0.45;
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // faint grid
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.04;
            ctx.lineWidth = 1;
            const step = 48;
            for (let x = 0; x < cssW; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, cssH);
                ctx.stroke();
            }
            for (let y = 0; y < cssH; y += step) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(cssW, y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, [color, intensity, reduced]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
        />
    );
}

function VisualVault({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-md aspect-square mx-auto">
            <motion.div
                className="absolute inset-[12%] rounded-3xl border-2"
                style={{ borderColor: `${color}55`, boxShadow: `0 0 80px ${color}33` }}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.2 }}
            />
            {[0, 1, 2, 3].map((i) => (
                <motion.div
                    key={i}
                    className="absolute inset-0 rounded-3xl border"
                    style={{ borderColor: `${color}33` }}
                    initial={{ scale: 0.5 + i * 0.08, opacity: 0 }}
                    animate={{ scale: [0.7 + i * 0.05, 1.15], opacity: [0.5, 0] }}
                    transition={{ duration: 2.4, delay: i * 0.25, repeat: Infinity }}
                />
            ))}
            <motion.div
                className="absolute inset-[28%] rounded-2xl bg-black/60 border flex items-center justify-center"
                style={{ borderColor: color, boxShadow: `inset 0 0 40px ${color}44` }}
                animate={{ rotate: [0, 2, -2, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
            >
                <Shield size={56} style={{ color }} strokeWidth={1.25} />
            </motion.div>
            <motion.div
                className="absolute inset-[20%] rounded-3xl"
                style={{ background: `radial-gradient(circle, ${color}22, transparent 70%)` }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
            />
            {/* shatter bars */}
            {[...Array(8)].map((_, i) => (
                <motion.div
                    key={`s${i}`}
                    className="absolute left-1/2 top-1/2 h-px origin-left"
                    style={{
                        width: "40%",
                        background: `linear-gradient(90deg, ${color}, transparent)`,
                        rotate: `${i * 45}deg`,
                    }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: [0, 1, 0.6], opacity: [0, 1, 0.3] }}
                    transition={{ duration: 2, delay: 0.4 + i * 0.05, repeat: Infinity, repeatDelay: 2 }}
                />
            ))}
        </div>
    );
}

function VisualRoutes({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-lg h-64 md:h-80 mx-auto">
            {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                    key={i}
                    className="absolute left-0 right-0 h-[2px] rounded-full"
                    style={{
                        top: `${18 + i * 14}%`,
                        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                        opacity: 0.35 + i * 0.1,
                    }}
                    animate={{ x: ["-20%", "20%", "-20%"] }}
                    transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
                />
            ))}
            <motion.div
                className="absolute left-[8%] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{ background: color, boxShadow: `0 0 20px ${color}` }}
                animate={{ left: ["8%", "88%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute right-[10%] top-[40%] px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-widest"
                style={{ borderColor: color, color, boxShadow: `0 0 24px ${color}44` }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                JUPITER ULTRA
            </motion.div>
            <motion.div
                className="absolute left-[12%] bottom-[18%] px-3 py-1.5 rounded-lg bg-black/70 border border-white/10 text-[10px] font-mono text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0.7] }}
                transition={{ duration: 3, repeat: Infinity }}
            >
                ROUTE LOCKED · BEST OUT
            </motion.div>
            <Zap
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30"
                size={72}
                style={{ color }}
            />
        </div>
    );
}

function VisualTiers({ color }: { color: string }) {
    const tiers = [
        { name: "Base", fee: "0.65%" },
        { name: "Silver", fee: "0.60%" },
        { name: "Gold", fee: "0.55%" },
        { name: "Platinum", fee: "0.52%" },
        { name: "Diamond", fee: "0.50%" },
    ];
    return (
        <div className="w-full max-w-sm mx-auto space-y-2">
            {tiers.map((t, i) => (
                <motion.div
                    key={t.name}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border bg-black/50"
                    style={{
                        borderColor: i === tiers.length - 1 ? color : "rgba(255,255,255,0.08)",
                        boxShadow: i === tiers.length - 1 ? `0 0 30px ${color}33` : undefined,
                    }}
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 120 }}
                >
                    <span className="text-sm font-black text-white">{t.name}</span>
                    <span
                        className="text-sm font-mono font-bold"
                        style={{ color: i === tiers.length - 1 ? color : "#a1a1aa" }}
                    >
                        {t.fee}
                    </span>
                </motion.div>
            ))}
            <motion.div
                className="text-center text-xs font-black mt-3"
                style={{ color }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
            >
                BUY SHX · 0% PLATFORM FEE
            </motion.div>
        </div>
    );
}

function VisualUsdc({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-md h-64 mx-auto">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <Gift size={48} style={{ color }} />
            </div>
            {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                return (
                    <motion.div
                        key={i}
                        className="absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-full"
                        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                        animate={{
                            x: [0, Math.cos(angle) * 110],
                            y: [0, Math.sin(angle) * 80],
                            opacity: [1, 0.2],
                            scale: [1, 0.4],
                        }}
                        transition={{
                            duration: 2.2,
                            delay: i * 0.08,
                            repeat: Infinity,
                            repeatDelay: 0.4,
                        }}
                    />
                );
            })}
            <motion.div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full border text-xs font-black tracking-wide"
                style={{ borderColor: color, color }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                AUTO USDC PAYOUTS
            </motion.div>
        </div>
    );
}

function VisualPro({ color }: { color: string }) {
    const chips = ["0.1", "0.25", "0.5", "1", "2"];
    return (
        <div className="w-full max-w-md mx-auto space-y-4">
            <div className="grid grid-cols-3 gap-2">
                {["LIMIT", "DCA", "APE"].map((label, i) => (
                    <motion.div
                        key={label}
                        className="rounded-2xl border bg-black/60 p-4 text-center"
                        style={{
                            borderColor: i === 2 ? color : "rgba(255,255,255,0.1)",
                            boxShadow: i === 2 ? `0 0 28px ${color}44` : undefined,
                        }}
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.15 }}
                    >
                        <Rocket
                            size={18}
                            className="mx-auto mb-1"
                            style={{ color: i === 2 ? color : "#a1a1aa" }}
                        />
                        <div className="text-[11px] font-black text-white">{label}</div>
                    </motion.div>
                ))}
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
                {chips.map((c, i) => (
                    <motion.span
                        key={c}
                        className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                        style={{
                            borderColor: i === 2 ? color : "rgba(255,255,255,0.12)",
                            color: i === 2 ? color : "#fff",
                            background: i === 2 ? `${color}22` : "rgba(255,255,255,0.04)",
                        }}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.06 }}
                    >
                        {c} SOL
                    </motion.span>
                ))}
            </div>
        </div>
    );
}

function VisualProof({ color }: { color: string }) {
    const [n, setN] = useState(1284);
    useEffect(() => {
        const t = setInterval(() => setN((v) => v + Math.floor(Math.random() * 3)), 400);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="w-full max-w-md mx-auto space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/50 p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    <Activity size={12} style={{ color }} /> Live ledger
                </div>
                <motion.div
                    className="text-5xl font-black tabular-nums"
                    style={{ color }}
                    key={n}
                    initial={{ opacity: 0.5, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {n.toLocaleString()}
                </motion.div>
                <div className="text-xs text-white/60 mt-1">wallets traded on SHX</div>
            </div>
            <div className="flex gap-2 overflow-hidden">
                {["SHX", "SOL", "BONK", "WIF", "JUP"].map((s, i) => (
                    <motion.div
                        key={s}
                        className="shrink-0 px-3 py-2 rounded-xl border border-white/10 bg-black/40 text-xs font-bold text-white"
                        animate={{ x: [0, -8, 0] }}
                        transition={{ duration: 2, delay: i * 0.1, repeat: Infinity }}
                    >
                        {s} <span style={{ color }}>+{(Math.random() * 4).toFixed(1)}%</span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function VisualAgent({ color }: { color: string }) {
    const steps = ["CONNECT", "QUOTE", "SIGN", "SWAP"];
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
                <Bot size={40} style={{ color }} />
                <div className="h-px w-12 bg-white/20" />
                <Shield size={40} className="text-white" />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {steps.map((s, i) => (
                    <motion.div
                        key={s}
                        className="px-3 py-2 rounded-xl border text-[11px] font-black tracking-wider"
                        style={{ borderColor: color, color }}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.2 }}
                    >
                        {i + 1}. {s}
                    </motion.div>
                ))}
            </div>
            <motion.p
                className="text-center text-[11px] text-white/50 mt-4 font-mono"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                GET /api/agent · MCP · your keys sign
            </motion.p>
        </div>
    );
}

function VisualLogo({ color }: { color: string }) {
    return (
        <div className="relative text-center py-6">
            <motion.div
                className="text-7xl md:text-8xl font-black tracking-tighter"
                style={{
                    background: `linear-gradient(135deg, ${color}, #a3e635, #fff)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: `drop-shadow(0 0 40px ${color}88)`,
                }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100 }}
            >
                SHX
            </motion.div>
            <motion.div
                className="absolute inset-0 -z-10 rounded-full blur-3xl opacity-40"
                style={{ background: color }}
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.25, 0.5, 0.25] }}
                transition={{ duration: 4, repeat: Infinity }}
            />
            <motion.p
                className="mt-4 text-sm font-mono tracking-[0.35em] text-white/70 uppercase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                shx.exchange
            </motion.p>
        </div>
    );
}

function SceneVisual({ visual, color }: { visual: Scene["visual"]; color: string }) {
    switch (visual) {
        case "vault":
            return <VisualVault color={color} />;
        case "routes":
            return <VisualRoutes color={color} />;
        case "tiers":
            return <VisualTiers color={color} />;
        case "usdc":
            return <VisualUsdc color={color} />;
        case "pro":
            return <VisualPro color={color} />;
        case "proof":
            return <VisualProof color={color} />;
        case "agent":
            return <VisualAgent color={color} />;
        case "logo":
            return <VisualLogo color={color} />;
        default:
            return <VisualLogo color={color} />;
    }
}

export function ShxCinematicAd({ standalone = true }: { standalone?: boolean }) {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [sound, setSound] = useState(false);
    const [progress, setProgress] = useState(0);
    const [started, setStarted] = useState(false);
    const [done, setDone] = useState(false);
    const scene = SCENES[index];
    const color = ACCENT[scene.accent];
    const { blip, whoosh } = useAdAudio(sound && playing && started);
    const totalMs = useMemo(() => SCENES.reduce((a, s) => a + s.durationMs, 0), []);
    const elapsedBase = useMemo(
        () => SCENES.slice(0, index).reduce((a, s) => a + s.durationMs, 0),
        [index]
    );

    const goNext = useCallback(() => {
        setIndex((i) => {
            if (i >= SCENES.length - 1) {
                setDone(true);
                setPlaying(false);
                return i;
            }
            return i + 1;
        });
        setProgress(0);
    }, []);

    useEffect(() => {
        if (!started || !playing || done) return;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = now - start;
            const p = Math.min(1, t / scene.durationMs);
            setProgress(p);
            if (p >= 1) {
                goNext();
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [index, playing, started, done, scene.durationMs, goNext]);

    useEffect(() => {
        if (!started || !playing) return;
        whoosh();
        blip(520 + index * 40, 0.1, "triangle", 0.035);
    }, [index, started, playing, whoosh, blip]);

    const globalProgress = (elapsedBase + progress * scene.durationMs) / totalMs;

    const start = () => {
        setStarted(true);
        setPlaying(true);
        setDone(false);
        setIndex(0);
        setProgress(0);
        blip(660, 0.12, "sine", 0.05);
    };

    const replay = () => {
        setDone(false);
        setIndex(0);
        setProgress(0);
        setPlaying(true);
        setStarted(true);
    };

    return (
        <div
            data-ad-root
            className={`${
                standalone ? "fixed inset-0 z-[200]" : "relative min-h-screen"
            } bg-black text-white overflow-hidden select-none`}
        >
            <ParticleField color={color} intensity={playing ? 1 : 0.3} />

            {/* ambient glows */}
            <div
                className="absolute top-[-20%] left-[-10%] w-[70%] h-[50%] rounded-full blur-[120px] opacity-30 pointer-events-none transition-colors duration-700"
                style={{ background: color }}
            />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[45%] rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />

            {/* top chrome */}
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400">
                        SHX
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                        Cinematic
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setSound((s) => !s)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                        aria-label={sound ? "Mute" : "Sound"}
                    >
                        {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    {started && !done && (
                        <button
                            type="button"
                            onClick={() => setPlaying((p) => !p)}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                            aria-label={playing ? "Pause" : "Play"}
                        >
                            {playing ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                    )}
                    {started && !done && (
                        <button
                            type="button"
                            onClick={goNext}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                            aria-label="Skip scene"
                        >
                            <SkipForward size={16} />
                        </button>
                    )}
                    <Link
                        href="/"
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </Link>
                </div>
            </div>

            {/* progress */}
            {started && (
                <div className="absolute top-[calc(env(safe-area-inset-top)+3rem)] inset-x-4 z-20 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: color, width: `${globalProgress * 100}%` }}
                    />
                </div>
            )}

            {/* intro gate */}
            {!started && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-md"
                    >
                        <div className="text-6xl md:text-7xl font-black tracking-tighter mb-3 text-transparent bg-clip-text bg-gradient-to-br from-primary via-lime-300 to-white">
                            SHX
                        </div>
                        <p className="text-sm text-white/60 mb-2">
                            A coded cinematic — no stock footage, no AI video.
                        </p>
                        <p className="text-xs text-white/40 mb-8 font-mono">
                            ~{Math.round(totalMs / 1000)}s · tap through scenes anytime
                        </p>
                        <button
                            type="button"
                            onClick={start}
                            className="min-h-[52px] px-10 rounded-2xl bg-gradient-to-r from-primary to-lime-400 text-black font-black text-sm shadow-[0_0_40px_rgba(34,197,94,0.45)] active:scale-95 transition-transform"
                        >
                            ▶ Play ad
                        </button>
                        <div className="mt-4">
                            <Link href="/" className="text-[11px] text-white/40 hover:text-white">
                                Skip to exchange →
                            </Link>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* main stage */}
            {started && (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-5 pt-20 pb-28">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={scene.id}
                            className="w-full max-w-2xl"
                            initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="text-center mb-6 md:mb-8">
                                {scene.kicker && (
                                    <motion.div
                                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.25em] mb-4"
                                        style={{ borderColor: `${color}66`, color }}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                    >
                                        <span
                                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                                            style={{ background: color }}
                                        />
                                        {scene.kicker}
                                    </motion.div>
                                )}
                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] whitespace-pre-line">
                                    {scene.title.split("\n").map((line, i) => (
                                        <motion.span
                                            key={i}
                                            className="block"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 + i * 0.12 }}
                                        >
                                            {line}
                                        </motion.span>
                                    ))}
                                </h1>
                                {scene.sub && (
                                    <motion.p
                                        className="mt-3 text-sm md:text-base text-white/60 max-w-lg mx-auto"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.35 }}
                                    >
                                        {scene.sub}
                                    </motion.p>
                                )}
                            </div>

                            <div className="min-h-[220px] md:min-h-[280px] flex items-center justify-center">
                                <SceneVisual visual={scene.visual} color={color} />
                            </div>

                            {scene.lines && (
                                <div className="mt-6 flex flex-wrap justify-center gap-2">
                                    {scene.lines.map((line, i) => (
                                        <motion.span
                                            key={line}
                                            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/80"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.5 + i * 0.1 }}
                                        >
                                            {line}
                                        </motion.span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {/* end card */}
            <AnimatePresence>
                {done && (
                    <motion.div
                        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-6 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400 mb-2">
                            SHX
                        </div>
                        <p className="text-white/70 text-sm mb-8 max-w-sm">
                            Trade Solana. Keep your keys. Get paid in USDC.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                            <Link
                                href="/"
                                className="flex-1 min-h-[48px] inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-lime-400 text-black font-black text-sm"
                            >
                                Open exchange
                            </Link>
                            <Link
                                href="/pro"
                                className="flex-1 min-h-[48px] inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 font-bold text-sm"
                            >
                                Pro desk
                            </Link>
                        </div>
                        <div className="flex gap-4 mt-6">
                            <button
                                type="button"
                                onClick={replay}
                                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white"
                            >
                                <RotateCcw size={12} /> Replay
                            </button>
                            <Link
                                href="/partners"
                                className="text-xs text-primary hover:underline"
                            >
                                Partner program
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* bottom scene dots */}
            {started && !done && (
                <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-0 z-20 flex justify-center gap-1.5 px-4">
                    {SCENES.map((s, i) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                setIndex(i);
                                setProgress(0);
                                setPlaying(true);
                            }}
                            className="h-1 rounded-full transition-all"
                            style={{
                                width: i === index ? 28 : 8,
                                background: i === index ? color : "rgba(255,255,255,0.2)",
                            }}
                            aria-label={`Scene ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
