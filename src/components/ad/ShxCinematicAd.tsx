"use client";

/**
 * SHX Cinematic Ad v2 — fully coded, no AI video.
 * Multi-layer canvas · kinetic type · scene spectacles · film grade · Web Audio score.
 */
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";
import confetti from "canvas-confetti";
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
    Lock,
    Unlock,
    ChevronRight,
} from "lucide-react";

/* ───────────────── types ───────────────── */

type Accent = "green" | "orange" | "cyan" | "purple" | "white";
type Visual =
    | "void"
    | "vault"
    | "routes"
    | "tiers"
    | "usdc"
    | "pro"
    | "proof"
    | "agent"
    | "split"
    | "logo";

type Scene = {
    id: string;
    durationMs: number;
    kicker: string;
    title: string;
    sub?: string;
    bullets?: string[];
    accent: Accent;
    visual: Visual;
    flash?: boolean;
};

const C: Record<Accent, string> = {
    green: "#22c55e",
    orange: "#fb923c",
    cyan: "#22d3ee",
    purple: "#c084fc",
    white: "#fafafa",
};

const SCENES: Scene[] = [
    {
        id: "cold",
        durationMs: 7000,
        kicker: "SHULEVITZ EXCHANGE",
        title: "The vault wants\nyour keys.",
        sub: "Every CEX is a counterparty risk wearing a nice UI.",
        accent: "white",
        visual: "void",
    },
    {
        id: "hook",
        durationMs: 9000,
        kicker: "NON-CUSTODIAL",
        title: "We never\nhold them.",
        sub: "Connect. Trade. Leave. Your wallet is the bank.",
        bullets: ["Phantom · Solflare", "No deposit. No freeze."],
        accent: "green",
        visual: "vault",
        flash: true,
    },
    {
        id: "ultra",
        durationMs: 9000,
        kicker: "JUPITER ULTRA",
        title: "Best route.\nEvery swap.",
        sub: "Institutional-grade aggregation. Settled on Solana.",
        bullets: ["Deepest liquidity", "MEV-aware execution"],
        accent: "cyan",
        visual: "routes",
    },
    {
        id: "tiers",
        durationMs: 9000,
        kicker: "LOYALTY ENGINE",
        title: "Hold SHX.\nPay less.",
        sub: "0.65% → 0.50%. Buy SHX at zero platform fee.",
        bullets: ["Diamond tier", "0% SHX buys"],
        accent: "purple",
        visual: "tiers",
    },
    {
        id: "refer",
        durationMs: 9000,
        kicker: "REAL MONEY",
        title: "Invite traders.\nEarn USDC.",
        sub: "25–35% of fees after real volume. Auto-paid. Not points.",
        bullets: ["$100 qualify gate", "Lifetime fee share"],
        accent: "green",
        visual: "usdc",
    },
    {
        id: "pro",
        durationMs: 8500,
        kicker: "PRO DESK",
        title: "Limit. DCA.\nApe Mode.",
        sub: "One terminal for launches, ladders, and schedules.",
        bullets: ["Turbo land", "Size chips", "Live tape"],
        accent: "orange",
        visual: "pro",
    },
    {
        id: "proof",
        durationMs: 8500,
        kicker: "PUBLIC LEDGER",
        title: "Live proof.\nNot marketing.",
        sub: "Unique wallets. Volume. Tape. On the product itself.",
        accent: "cyan",
        visual: "proof",
    },
    {
        id: "agent",
        durationMs: 8000,
        kicker: "AGENT NATIVE",
        title: "Humans trade.\nAgents connect.",
        sub: "REST + MCP. Quote. Sign. Swap. You keep the keys.",
        bullets: ["Open CORS", "Bot-ready"],
        accent: "purple",
        visual: "agent",
    },
    {
        id: "split",
        durationMs: 8000,
        kicker: "CHOOSE",
        title: "Deposit…\nor dominate.",
        sub: "Old world freezes. New world settles.",
        accent: "green",
        visual: "split",
        flash: true,
    },
    {
        id: "close",
        durationMs: 11000,
        kicker: "SHX",
        title: "Trade Solana.\nKeep your keys.\nGet paid in USDC.",
        sub: "shx.exchange",
        bullets: ["Non-custodial", "Jupiter Ultra", "Partner program"],
        accent: "green",
        visual: "logo",
        flash: true,
    },
];

/* ───────────────── hooks ───────────────── */

function useReducedMotion() {
    const [r, setR] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setR(mq.matches);
        const f = () => setR(mq.matches);
        mq.addEventListener("change", f);
        return () => mq.removeEventListener("change", f);
    }, []);
    return r;
}

function useAdScore(on: boolean) {
    const ctx = useRef<AudioContext | null>(null);
    const master = useRef<GainNode | null>(null);

    const get = useCallback(() => {
        if (typeof window === "undefined") return null;
        if (!ctx.current) {
            const AC =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            ctx.current = new AC();
            master.current = ctx.current.createGain();
            master.current.gain.value = 0.12;
            master.current.connect(ctx.current.destination);
        }
        if (ctx.current.state === "suspended") void ctx.current.resume();
        return ctx.current;
    }, []);

    const tone = useCallback(
        (
            freq: number,
            dur = 0.12,
            type: OscillatorType = "sine",
            vol = 0.35,
            when = 0
        ) => {
            if (!on) return;
            const c = get();
            if (!c || !master.current) return;
            const t0 = c.currentTime + when;
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t0);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g);
            g.connect(master.current);
            o.start(t0);
            o.stop(t0 + dur + 0.02);
        },
        [on, get]
    );

    const hit = useCallback(() => {
        if (!on) return;
        tone(55, 0.35, "sine", 0.5);
        tone(110, 0.2, "triangle", 0.2, 0.02);
        tone(880, 0.08, "square", 0.08, 0.05);
    }, [on, tone]);

    const whoosh = useCallback(() => {
        if (!on) return;
        const c = get();
        if (!c || !master.current) return;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(180, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(36, c.currentTime + 0.45);
        g.gain.setValueAtTime(0.08, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.45);
        o.connect(g);
        g.connect(master.current);
        o.start();
        o.stop(c.currentTime + 0.5);
    }, [on, get]);

    const arpeggio = useCallback(
        (base = 220) => {
            if (!on) return;
            [0, 4, 7, 12].forEach((semi, i) => {
                const f = base * Math.pow(2, semi / 12);
                tone(f, 0.15, "sine", 0.18, i * 0.07);
            });
        },
        [on, tone]
    );

    return { hit, whoosh, arpeggio, tone };
}

/* ───────────────── canvas nebula ───────────────── */

function CosmicCanvas({
    color,
    intensity,
    mode,
}: {
    color: string;
    intensity: number;
    mode: Visual;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const reduced = useReducedMotion();
    const mouse = useRef({ x: 0.5, y: 0.5 });

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || reduced) return;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;

        let w = 0,
            h = 0,
            raf = 0,
            t = 0;

        type P = {
            x: number;
            y: number;
            z: number;
            vx: number;
            vy: number;
            life: number;
        };
        const stars: P[] = Array.from({ length: 120 }, () => ({
            x: Math.random(),
            y: Math.random(),
            z: Math.random(),
            vx: (Math.random() - 0.5) * 0.0002,
            vy: (Math.random() - 0.5) * 0.0002,
            life: Math.random(),
        }));
        const trails: { x: number; y: number; vx: number; vy: number; a: number }[] =
            [];

        const resize = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            w = canvas.offsetWidth;
            h = canvas.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener("resize", resize);

        const onMove = (e: PointerEvent) => {
            mouse.current.x = e.clientX / window.innerWidth;
            mouse.current.y = e.clientY / window.innerHeight;
        };
        window.addEventListener("pointermove", onMove);

        const hexToRgb = (hex: string) => {
            const n = parseInt(hex.slice(1), 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        };

        const draw = () => {
            t += 0.008 * intensity;
            const rgb = hexToRgb(color);
            ctx.fillStyle = "#020203";
            ctx.fillRect(0, 0, w, h);

            // nebula blobs
            const blobs = [
                { x: 0.2 + Math.sin(t * 0.4) * 0.05, y: 0.3, s: 0.55 },
                { x: 0.75 + Math.cos(t * 0.3) * 0.04, y: 0.65, s: 0.5 },
                {
                    x: mouse.current.x,
                    y: mouse.current.y,
                    s: 0.35,
                },
            ];
            for (const b of blobs) {
                const g = ctx.createRadialGradient(
                    b.x * w,
                    b.y * h,
                    0,
                    b.x * w,
                    b.y * h,
                    b.s * Math.max(w, h)
                );
                g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`);
                g.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},0.05)`);
                g.addColorStop(1, "transparent");
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }

            // perspective grid floor
            ctx.save();
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.07)`;
            ctx.lineWidth = 1;
            const horizon = h * 0.55;
            for (let i = 0; i < 16; i++) {
                const y = horizon + ((h - horizon) * i) / 15;
                const p = i / 15;
                ctx.globalAlpha = 0.05 + p * 0.12;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            for (let i = -12; i <= 12; i++) {
                ctx.globalAlpha = 0.06;
                ctx.beginPath();
                ctx.moveTo(w / 2 + i * 40, horizon);
                ctx.lineTo(w / 2 + i * 180, h);
                ctx.stroke();
            }
            ctx.restore();

            // stars
            for (const s of stars) {
                s.x += s.vx * intensity;
                s.y += s.vy * intensity;
                s.life += 0.01;
                if (s.x < 0 || s.x > 1) s.vx *= -1;
                if (s.y < 0 || s.y > 1) s.vy *= -1;
                const tw = 0.4 + Math.sin(s.life * 4 + s.z * 10) * 0.4;
                ctx.beginPath();
                ctx.fillStyle = `rgba(255,255,255,${0.15 + s.z * 0.6 * tw})`;
                ctx.arc(s.x * w, s.y * h, 0.6 + s.z * 1.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // mode-specific trails
            if (mode === "routes" || mode === "ultra" || intensity > 0.8) {
                if (Math.random() < 0.15 * intensity) {
                    trails.push({
                        x: Math.random() * w,
                        y: Math.random() * h * 0.7,
                        vx: (2 + Math.random() * 6) * (Math.random() > 0.5 ? 1 : -1),
                        vy: (Math.random() - 0.5) * 1.5,
                        a: 1,
                    });
                }
            }
            for (let i = trails.length - 1; i >= 0; i--) {
                const tr = trails[i];
                tr.x += tr.vx;
                tr.y += tr.vy;
                tr.a -= 0.02;
                if (tr.a <= 0) {
                    trails.splice(i, 1);
                    continue;
                }
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${tr.a})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(tr.x, tr.y);
                ctx.lineTo(tr.x - tr.vx * 4, tr.y - tr.vy * 4);
                ctx.stroke();
            }

            // film vignette
            const vig = ctx.createRadialGradient(
                w / 2,
                h / 2,
                h * 0.2,
                w / 2,
                h / 2,
                h * 0.85
            );
            vig.addColorStop(0, "transparent");
            vig.addColorStop(1, "rgba(0,0,0,0.72)");
            ctx.fillStyle = vig;
            ctx.fillRect(0, 0, w, h);

            // scanline
            ctx.fillStyle = "rgba(0,0,0,0.04)";
            for (let y = 0; y < h; y += 3) {
                ctx.fillRect(0, y, w, 1);
            }

            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", onMove);
        };
    }, [color, intensity, mode, reduced]);

    return (
        <canvas
            ref={ref}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
        />
    );
}

/* ───────────────── kinetic type ───────────────── */

function KineticTitle({ text, color }: { text: string; color: string }) {
    const lines = text.split("\n");
    return (
        <h1 className="text-[clamp(2rem,7vw,4.25rem)] font-black tracking-[-0.04em] leading-[0.95]">
            {lines.map((line, li) => (
                <span key={li} className="block overflow-hidden py-0.5">
                    {line.split(" ").map((word, wi) => (
                        <motion.span
                            key={`${li}-${wi}`}
                            className="inline-block mr-[0.28em] last:mr-0"
                            style={
                                wi === line.split(" ").length - 1
                                    ? {
                                          background: `linear-gradient(135deg, ${color}, #fff 70%)`,
                                          WebkitBackgroundClip: "text",
                                          WebkitTextFillColor: "transparent",
                                      }
                                    : undefined
                            }
                            initial={{ y: "110%", opacity: 0, rotate: 4 }}
                            animate={{ y: 0, opacity: 1, rotate: 0 }}
                            transition={{
                                delay: 0.08 + li * 0.12 + wi * 0.06,
                                duration: 0.7,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            {word}
                        </motion.span>
                    ))}
                </span>
            ))}
        </h1>
    );
}

/* ───────────────── scene visuals ───────────────── */

function VVoid({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-lg mx-auto h-56 md:h-72 flex items-center justify-center">
            <motion.div
                className="absolute w-40 h-40 md:w-52 md:h-52 rounded-full border border-white/10"
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
            />
            <motion.div
                className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full"
                style={{
                    boxShadow: `inset 0 0 60px ${color}33, 0 0 80px ${color}22`,
                    border: `1px solid ${color}44`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <Lock size={48} className="text-white/80 relative z-10" strokeWidth={1.2} />
            <motion.div
                className="absolute inset-x-0 bottom-4 text-center text-[10px] font-mono tracking-[0.4em] text-white/30 uppercase"
                animate={{ opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 2.5, repeat: Infinity }}
            >
                custody · risk · wait
            </motion.div>
        </div>
    );
}

function VVault({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-md mx-auto aspect-square max-h-[320px]">
            {/* broken cage */}
            {[...Array(12)].map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                    <motion.div
                        key={i}
                        className="absolute left-1/2 top-1/2 origin-left h-[2px] rounded-full"
                        style={{
                            width: "42%",
                            background: `linear-gradient(90deg, ${color}, transparent)`,
                            rotate: `${(i * 30)}deg`,
                        }}
                        initial={{ scaleX: 0.3, opacity: 0 }}
                        animate={{
                            scaleX: [0.3, 1, 0.85],
                            opacity: [0, 1, 0.4],
                            x: [0, Math.cos(a) * 8],
                        }}
                        transition={{
                            duration: 2.2,
                            delay: 0.15 + i * 0.04,
                            repeat: Infinity,
                            repeatDelay: 1.5,
                        }}
                    />
                );
            })}
            <motion.div
                className="absolute inset-[22%] rounded-[1.75rem] border-2 bg-black/50 flex items-center justify-center"
                style={{
                    borderColor: color,
                    boxShadow: `0 0 60px ${color}55, inset 0 0 40px ${color}22`,
                }}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 90, delay: 0.2 }}
            >
                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5, type: "spring" }}
                >
                    <Unlock size={52} style={{ color }} strokeWidth={1.25} />
                </motion.div>
            </motion.div>
            <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle, ${color}33 0%, transparent 55%)`,
                }}
                animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
            />
            {/* floating key shards */}
            {[...Array(6)].map((_, i) => (
                <motion.div
                    key={`k${i}`}
                    className="absolute w-2 h-2 rounded-sm"
                    style={{ background: color, left: "50%", top: "50%" }}
                    animate={{
                        x: [0, (i % 2 ? 1 : -1) * (60 + i * 18)],
                        y: [0, -40 - i * 12, 20],
                        opacity: [0, 1, 0],
                        rotate: [0, 180 + i * 40],
                    }}
                    transition={{
                        duration: 2.4,
                        delay: 0.6 + i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 1,
                    }}
                />
            ))}
        </div>
    );
}

function VRoutes({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-xl h-64 md:h-80 mx-auto">
            {/* highway lanes */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.div
                    key={i}
                    className="absolute h-[3px] left-0 right-0 rounded-full overflow-hidden"
                    style={{ top: `${16 + i * 13}%` }}
                >
                    <motion.div
                        className="h-full w-1/3 rounded-full"
                        style={{
                            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                            opacity: 0.4 + i * 0.08,
                        }}
                        animate={{ x: ["-100%", "400%"] }}
                        transition={{
                            duration: 1.6 + i * 0.15,
                            repeat: Infinity,
                            ease: "linear",
                            delay: i * 0.12,
                        }}
                    />
                </motion.div>
            ))}
            {/* winning packet */}
            <motion.div
                className="absolute top-[42%] w-4 h-4 rounded-full z-10"
                style={{
                    background: color,
                    boxShadow: `0 0 30px ${color}, 0 0 60px ${color}`,
                }}
                animate={{ left: ["5%", "92%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute right-4 top-6 px-3 py-2 rounded-xl border bg-black/70 backdrop-blur text-[10px] font-black tracking-[0.2em]"
                style={{ borderColor: color, color, boxShadow: `0 0 30px ${color}44` }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
            >
                BEST ROUTE · ULTRA
            </motion.div>
            <motion.div
                className="absolute left-4 bottom-8 px-3 py-2 rounded-xl bg-black/70 border border-white/10 font-mono text-[10px] text-white/80"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                latency &lt; block · settled ✓
            </motion.div>
            <Zap
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"
                size={96}
                style={{ color }}
            />
        </div>
    );
}

function VTiers({ color }: { color: string }) {
    const tiers = [
        { n: "Base", f: "0.65%", dim: true },
        { n: "Silver", f: "0.60%", dim: true },
        { n: "Gold", f: "0.55%", dim: false },
        { n: "Platinum", f: "0.52%", dim: false },
        { n: "Diamond", f: "0.50%", hot: true },
    ];
    return (
        <div className="w-full max-w-sm mx-auto space-y-2">
            {tiers.map((t, i) => (
                <motion.div
                    key={t.n}
                    className="relative flex items-center justify-between px-4 py-3 rounded-2xl border overflow-hidden"
                    style={{
                        borderColor: t.hot ? color : "rgba(255,255,255,0.08)",
                        background: t.hot ? `${color}14` : "rgba(0,0,0,0.45)",
                        boxShadow: t.hot ? `0 0 40px ${color}33` : undefined,
                    }}
                    initial={{ x: -60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 140 }}
                >
                    {t.hot && (
                        <motion.div
                            className="absolute inset-0 opacity-30"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                            }}
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    )}
                    <span
                        className={`text-sm font-black relative ${t.dim ? "text-white/50" : "text-white"}`}
                    >
                        {t.n}
                    </span>
                    <span
                        className="text-sm font-mono font-bold relative"
                        style={{ color: t.hot ? color : "#a1a1aa" }}
                    >
                        {t.f}
                    </span>
                </motion.div>
            ))}
            <motion.div
                className="mt-3 text-center py-2.5 rounded-2xl font-black text-xs tracking-wide"
                style={{
                    background: `linear-gradient(90deg, ${color}, #a3e635)`,
                    color: "#000",
                    boxShadow: `0 0 30px ${color}66`,
                }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7 }}
            >
                BUY SHX · 0% PLATFORM FEE
            </motion.div>
        </div>
    );
}

function VUsdc({ color }: { color: string }) {
    return (
        <div className="relative w-full max-w-md h-64 md:h-72 mx-auto">
            {/* network nodes */}
            {[...Array(8)].map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                const r = 100;
                return (
                    <motion.div
                        key={i}
                        className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2"
                        style={{ borderColor: color, background: "#000" }}
                        animate={{
                            x: Math.cos(a) * r,
                            y: Math.sin(a) * r * 0.75,
                            scale: [1, 1.3, 1],
                        }}
                        transition={{
                            duration: 3,
                            delay: i * 0.1,
                            repeat: Infinity,
                        }}
                    />
                );
            })}
            <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-2xl border-2 flex items-center justify-center bg-black/80"
                style={{
                    borderColor: color,
                    boxShadow: `0 0 50px ${color}55`,
                }}
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity }}
            >
                <Gift size={32} style={{ color }} />
            </motion.div>
            {/* USDC streams inward */}
            {[...Array(10)].map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                return (
                    <motion.div
                        key={`d${i}`}
                        className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full"
                        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
                        animate={{
                            x: [Math.cos(a) * 130, 0],
                            y: [Math.sin(a) * 100, 0],
                            opacity: [0, 1, 0],
                            scale: [0.5, 1, 0.2],
                        }}
                        transition={{
                            duration: 1.8,
                            delay: i * 0.12,
                            repeat: Infinity,
                        }}
                    />
                );
            })}
            <motion.div
                className="absolute bottom-2 inset-x-0 text-center text-[11px] font-black tracking-[0.25em]"
                style={{ color }}
            >
                25–35% · USDC · AUTO
            </motion.div>
        </div>
    );
}

function VPro({ color }: { color: string }) {
    return (
        <div className="w-full max-w-md mx-auto space-y-4">
            <div className="grid grid-cols-3 gap-2">
                {[
                    { l: "LIMIT", i: Activity },
                    { l: "DCA", i: Rocket },
                    { l: "APE", i: Zap, hot: true },
                ].map((x, i) => (
                    <motion.div
                        key={x.l}
                        className="rounded-2xl border p-4 text-center bg-black/60 backdrop-blur"
                        style={{
                            borderColor: x.hot ? color : "rgba(255,255,255,0.1)",
                            boxShadow: x.hot ? `0 0 40px ${color}44` : undefined,
                        }}
                        initial={{ y: 40, opacity: 0, rotateX: 40 }}
                        animate={{ y: 0, opacity: 1, rotateX: 0 }}
                        transition={{ delay: i * 0.12, type: "spring" }}
                    >
                        <x.i
                            size={22}
                            className="mx-auto mb-2"
                            style={{ color: x.hot ? color : "#a1a1aa" }}
                        />
                        <div className="text-[11px] font-black text-white tracking-wider">
                            {x.l}
                        </div>
                    </motion.div>
                ))}
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
                {["0.1", "0.25", "0.5", "1", "2"].map((s, i) => (
                    <motion.span
                        key={s}
                        className="min-w-[3.25rem] text-center px-3 py-2 rounded-xl border text-xs font-bold"
                        style={{
                            borderColor: i === 2 ? color : "rgba(255,255,255,0.12)",
                            color: i === 2 ? color : "#fff",
                            background: i === 2 ? `${color}22` : "rgba(255,255,255,0.04)",
                            boxShadow: i === 2 ? `0 0 20px ${color}33` : undefined,
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.45 + i * 0.06, type: "spring" }}
                    >
                        {s}
                    </motion.span>
                ))}
            </div>
            <motion.div
                className="text-center text-[10px] font-mono text-white/40 tracking-widest"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                TURBO · SIZE · LAND
            </motion.div>
        </div>
    );
}

function VProof({ color }: { color: string }) {
    const [n, setN] = useState(2840);
    const [vol, setVol] = useState(1.24);
    useEffect(() => {
        const t = setInterval(() => {
            setN((v) => v + Math.floor(Math.random() * 4) + 1);
            setVol((v) => v + Math.random() * 0.02);
        }, 280);
        return () => clearInterval(t);
    }, []);
    const pairs = ["SHX", "SOL", "BONK", "WIF", "JUP", "RAY"];
    return (
        <div className="w-full max-w-md mx-auto space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/55 p-4 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">
                        Wallets
                    </div>
                    <div className="text-3xl font-black tabular-nums" style={{ color }}>
                        {n.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/55 p-4 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">
                        Volume
                    </div>
                    <div className="text-3xl font-black tabular-nums text-white">
                        ${vol.toFixed(2)}M
                    </div>
                </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 py-3">
                <motion.div
                    className="flex gap-3 whitespace-nowrap px-3"
                    animate={{ x: [0, -200] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                    {[...pairs, ...pairs].map((p, i) => (
                        <span
                            key={`${p}${i}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold"
                        >
                            {p}
                            <span style={{ color }}>
                                +{(1 + (i % 5) * 0.7).toFixed(1)}%
                            </span>
                        </span>
                    ))}
                </motion.div>
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] text-white/50">
                <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: color }}
                />
                LIVE LEDGER · ON-PRODUCT
            </div>
        </div>
    );
}

function VAgent({ color }: { color: string }) {
    const steps = [
        { t: "CONNECT", d: "wallet state" },
        { t: "QUOTE", d: "ultra order" },
        { t: "SIGN", d: "your keys" },
        { t: "SWAP", d: "execute" },
    ];
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="flex items-center justify-center gap-4 mb-8">
                <motion.div
                    className="w-16 h-16 rounded-2xl border flex items-center justify-center bg-black/60"
                    style={{ borderColor: color, boxShadow: `0 0 30px ${color}44` }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                >
                    <Bot size={28} style={{ color }} />
                </motion.div>
                <motion.div
                    className="h-px w-16"
                    style={{
                        background: `linear-gradient(90deg, ${color}, transparent)`,
                    }}
                    animate={{ scaleX: [0.5, 1, 0.5], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                    className="w-16 h-16 rounded-2xl border border-white/20 flex items-center justify-center bg-black/60"
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
                >
                    <Shield size={28} className="text-white" />
                </motion.div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {steps.map((s, i) => (
                    <motion.div
                        key={s.t}
                        className="rounded-xl border border-white/10 bg-black/50 px-3 py-3"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 * i }}
                    >
                        <div className="text-[10px] font-black tracking-widest" style={{ color }}>
                            0{i + 1} · {s.t}
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">{s.d}</div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function VSplit({ color }: { color: string }) {
    return (
        <div className="w-full max-w-lg mx-auto grid grid-cols-2 gap-2 md:gap-3 h-56 md:h-64">
            <motion.div
                className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 flex flex-col justify-between overflow-hidden relative"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent" />
                <div className="relative text-[10px] font-black tracking-widest text-red-400/80">
                    OLD WORLD
                </div>
                <div className="relative space-y-2">
                    {["Deposit", "Wait", "Freeze risk"].map((t) => (
                        <div
                            key={t}
                            className="text-xs text-white/40 line-through decoration-red-500/50"
                        >
                            {t}
                        </div>
                    ))}
                </div>
                <Lock size={20} className="relative text-white/30" />
            </motion.div>
            <motion.div
                className="rounded-2xl border p-4 flex flex-col justify-between overflow-hidden relative"
                style={{
                    borderColor: color,
                    boxShadow: `0 0 40px ${color}33`,
                    background: `linear-gradient(160deg, ${color}22, #000 60%)`,
                }}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
            >
                <div className="relative text-[10px] font-black tracking-widest" style={{ color }}>
                    SHX
                </div>
                <div className="relative space-y-2">
                    {["Connect", "Trade", "Keep keys"].map((t) => (
                        <div key={t} className="text-xs font-bold text-white">
                            {t}
                        </div>
                    ))}
                </div>
                <Unlock size={20} className="relative" style={{ color }} />
            </motion.div>
        </div>
    );
}

function VLogo({ color }: { color: string }) {
    return (
        <div className="relative text-center py-4">
            <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-50"
                style={{ background: color }}
                animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 3.5, repeat: Infinity }}
            />
            <motion.div
                className="relative text-[clamp(4.5rem,18vw,8rem)] font-black tracking-tighter leading-none"
                style={{
                    background: `linear-gradient(145deg, ${color} 0%, #a3e635 45%, #fff 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: `drop-shadow(0 0 50px ${color})`,
                }}
                initial={{ scale: 0.4, opacity: 0, letterSpacing: "0.4em" }}
                animate={{ scale: 1, opacity: 1, letterSpacing: "-0.06em" }}
                transition={{ type: "spring", stiffness: 80, damping: 12 }}
            >
                SHX
            </motion.div>
            <motion.p
                className="relative mt-4 text-sm md:text-base font-mono tracking-[0.45em] uppercase text-white/70"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
            >
                shx.exchange
            </motion.p>
        </div>
    );
}

function SceneVisual({ visual, color }: { visual: Visual; color: string }) {
    const map: Record<Visual, ReactNode> = {
        void: <VVoid color={color} />,
        vault: <VVault color={color} />,
        routes: <VRoutes color={color} />,
        tiers: <VTiers color={color} />,
        usdc: <VUsdc color={color} />,
        pro: <VPro color={color} />,
        proof: <VProof color={color} />,
        agent: <VAgent color={color} />,
        split: <VSplit color={color} />,
        logo: <VLogo color={color} />,
    };
    return <>{map[visual]}</>;
}

/* ───────────────── main ad ───────────────── */

export function ShxCinematicAd({ standalone = true }: { standalone?: boolean }) {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [sound, setSound] = useState(false);
    const [progress, setProgress] = useState(0);
    const [started, setStarted] = useState(false);
    const [done, setDone] = useState(false);
    const [flash, setFlash] = useState(false);
    const scene = SCENES[index];
    const color = C[scene.accent];
    const { hit, whoosh, arpeggio } = useAdScore(sound && playing && started);

    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const sx = useSpring(mx, { stiffness: 40, damping: 20 });
    const sy = useSpring(my, { stiffness: 40, damping: 20 });

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
                try {
                    confetti({
                        particleCount: 100,
                        spread: 80,
                        origin: { y: 0.6 },
                        colors: ["#22c55e", "#a3e635", "#ffffff", "#22d3ee"],
                    });
                } catch {
                    /* ignore */
                }
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
            const p = Math.min(1, (now - start) / scene.durationMs);
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
        if (scene.flash) {
            setFlash(true);
            hit();
            const t = setTimeout(() => setFlash(false), 180);
            return () => clearTimeout(t);
        }
        arpeggio(200 + index * 30);
    }, [index, started, playing, whoosh, hit, arpeggio, scene.flash]);

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            mx.set((e.clientX / window.innerWidth - 0.5) * 20);
            my.set((e.clientY / window.innerHeight - 0.5) * 14);
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
    }, [mx, my]);

    const globalProgress = (elapsedBase + progress * scene.durationMs) / totalMs;

    const start = () => {
        setStarted(true);
        setPlaying(true);
        setDone(false);
        setIndex(0);
        setProgress(0);
        hit();
    };

    const replay = () => {
        setDone(false);
        setIndex(0);
        setProgress(0);
        setPlaying(true);
        setStarted(true);
        hit();
    };

    return (
        <div
            data-ad-root
            className={`${
                standalone ? "fixed inset-0 z-[200]" : "relative min-h-screen"
            } bg-[#020203] text-white overflow-hidden select-none`}
        >
            <CosmicCanvas
                color={color}
                intensity={playing && started ? 1 : 0.35}
                mode={scene.visual}
            />

            {/* parallax glow */}
            <motion.div
                className="absolute w-[80vw] h-[80vw] max-w-[700px] max-h-[700px] rounded-full blur-[100px] opacity-25 pointer-events-none"
                style={{
                    background: color,
                    x: sx,
                    y: sy,
                    left: "10%",
                    top: "5%",
                }}
            />

            {/* flash */}
            <AnimatePresence>
                {flash && (
                    <motion.div
                        className="absolute inset-0 z-50 pointer-events-none"
                        style={{ background: color }}
                        initial={{ opacity: 0.55 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                    />
                )}
            </AnimatePresence>

            {/* film grain overlay */}
            <div
                className="absolute inset-0 z-[5] pointer-events-none opacity-[0.07] mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* top chrome */}
            <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-3 sm:px-5 pt-[max(0.65rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-black bg-gradient-to-r from-primary to-lime-300 bg-clip-text text-transparent">
                        SHX
                    </span>
                    <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-[0.28em] text-white/35">
                        Cinema v2
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setSound((s) => !s)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95 backdrop-blur"
                    >
                        {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                    {started && !done && (
                        <>
                            <button
                                type="button"
                                onClick={() => setPlaying((p) => !p)}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                            >
                                {playing ? <Pause size={15} /> : <Play size={15} />}
                            </button>
                            <button
                                type="button"
                                onClick={goNext}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                            >
                                <SkipForward size={15} />
                            </button>
                        </>
                    )}
                    <Link
                        href="/"
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 active:scale-95"
                    >
                        <X size={15} />
                    </Link>
                </div>
            </div>

            {/* progress rail */}
            {started && (
                <div className="absolute top-[calc(env(safe-area-inset-top)+2.85rem)] inset-x-3 sm:inset-x-5 z-30">
                    <div className="h-[3px] rounded-full bg-white/10 overflow-hidden flex gap-0.5">
                        {SCENES.map((s, i) => {
                            let w = 0;
                            if (i < index) w = 100;
                            else if (i === index) w = progress * 100;
                            return (
                                <div
                                    key={s.id}
                                    className="flex-1 h-full rounded-full bg-white/10 overflow-hidden"
                                >
                                    <div
                                        className="h-full rounded-full transition-[width] duration-75"
                                        style={{
                                            width: `${w}%`,
                                            background: i === index ? color : "#22c55e",
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* INTRO */}
            {!started && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6">
                    <motion.div
                        className="max-w-md w-full text-center"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <motion.div
                            className="text-[clamp(3.5rem,14vw,6rem)] font-black tracking-tighter leading-none mb-3"
                            style={{
                                background:
                                    "linear-gradient(145deg, #22c55e, #a3e635 50%, #fff)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                filter: "drop-shadow(0 0 40px rgba(34,197,94,0.5))",
                            }}
                            animate={{ scale: [0.98, 1.02, 0.98] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        >
                            SHX
                        </motion.div>
                        <p className="text-white/55 text-sm mb-1">
                            Fully coded cinematic. Zero stock footage.
                        </p>
                        <p className="text-white/30 text-[11px] font-mono mb-10">
                            ~{Math.round(totalMs / 1000)}s · {SCENES.length} acts · tap to
                            skip
                        </p>
                        <button
                            type="button"
                            onClick={start}
                            className="group relative min-h-[56px] w-full sm:w-auto px-12 rounded-2xl font-black text-sm text-black overflow-hidden active:scale-[0.98] transition-transform"
                        >
                            <span
                                className="absolute inset-0"
                                style={{
                                    background:
                                        "linear-gradient(90deg, #22c55e, #a3e635, #22c55e)",
                                    backgroundSize: "200% 100%",
                                }}
                            />
                            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20" />
                            <span className="relative flex items-center justify-center gap-2">
                                ▶ Play the ad
                            </span>
                        </button>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1 mt-5 text-[11px] text-white/35 hover:text-white"
                        >
                            Skip to exchange <ChevronRight size={12} />
                        </Link>
                    </motion.div>
                </div>
            )}

            {/* STAGE */}
            {started && (
                <div className="absolute inset-0 z-10 flex flex-col justify-center px-4 sm:px-8 pt-24 pb-28">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={scene.id}
                            className="w-full max-w-3xl mx-auto"
                            initial={{ opacity: 0, scale: 0.96, filter: "blur(12px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 1.03, filter: "blur(10px)" }}
                            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="text-center mb-5 md:mb-8">
                                <motion.div
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] sm:text-[10px] font-black uppercase tracking-[0.28em] mb-4"
                                    style={{
                                        borderColor: `${color}66`,
                                        color,
                                        boxShadow: `0 0 24px ${color}33`,
                                    }}
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <span
                                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ background: color }}
                                    />
                                    {scene.kicker}
                                </motion.div>

                                <KineticTitle text={scene.title} color={color} />

                                {scene.sub && (
                                    <motion.p
                                        className="mt-4 text-sm md:text-base text-white/55 max-w-xl mx-auto leading-relaxed"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.45 }}
                                    >
                                        {scene.sub}
                                    </motion.p>
                                )}
                            </div>

                            <div className="min-h-[200px] md:min-h-[280px] flex items-center justify-center">
                                <SceneVisual visual={scene.visual} color={color} />
                            </div>

                            {scene.bullets && (
                                <div className="mt-6 flex flex-wrap justify-center gap-2">
                                    {scene.bullets.map((b, i) => (
                                        <motion.span
                                            key={b}
                                            className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-semibold text-white/75 backdrop-blur"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.55 + i * 0.08 }}
                                        >
                                            {b}
                                        </motion.span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {/* END */}
            <AnimatePresence>
                {done && (
                    <motion.div
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6 bg-black/75 backdrop-blur-xl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="text-6xl font-black bg-gradient-to-r from-primary to-lime-300 bg-clip-text text-transparent mb-2"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                        >
                            SHX
                        </motion.div>
                        <p className="text-white/60 text-sm mb-2 text-center">
                            Trade Solana. Keep your keys. Get paid in USDC.
                        </p>
                        <p className="text-white/30 text-[11px] font-mono mb-8">
                            shx.exchange
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                            <Link
                                href="/"
                                className="flex-1 min-h-[50px] inline-flex items-center justify-center rounded-2xl font-black text-sm text-black"
                                style={{
                                    background:
                                        "linear-gradient(90deg, #22c55e, #a3e635)",
                                    boxShadow: "0 0 40px rgba(34,197,94,0.4)",
                                }}
                            >
                                Open exchange
                            </Link>
                            <Link
                                href="/pro"
                                className="flex-1 min-h-[50px] inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 font-bold text-sm"
                            >
                                Pro desk
                            </Link>
                        </div>
                        <div className="flex gap-5 mt-7">
                            <button
                                type="button"
                                onClick={replay}
                                className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white"
                            >
                                <RotateCcw size={12} /> Replay
                            </button>
                            <Link
                                href="/partners"
                                className="text-xs text-primary hover:underline"
                            >
                                Partner program
                            </Link>
                            <Link href="/ad" className="text-xs text-white/35 hover:text-white">
                                Share /ad
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* scene scrub dots */}
            {started && !done && (
                <div className="absolute bottom-[max(0.85rem,env(safe-area-inset-bottom))] inset-x-0 z-30 flex justify-center gap-1 px-4">
                    {SCENES.map((s, i) => (
                        <button
                            key={s.id}
                            type="button"
                            title={s.kicker}
                            onClick={() => {
                                setIndex(i);
                                setProgress(0);
                                setPlaying(true);
                            }}
                            className="h-1 rounded-full transition-all duration-300"
                            style={{
                                width: i === index ? 26 : 7,
                                background:
                                    i === index
                                        ? color
                                        : i < index
                                          ? "rgba(34,197,94,0.5)"
                                          : "rgba(255,255,255,0.18)",
                            }}
                        />
                    ))}
                </div>
            )}

            {/* global progress % corner */}
            {started && !done && (
                <div className="absolute bottom-[max(0.85rem,env(safe-area-inset-bottom))] right-4 z-30 text-[9px] font-mono text-white/25 tabular-nums">
                    {Math.round(globalProgress * 100)}%
                </div>
            )}
        </div>
    );
}
