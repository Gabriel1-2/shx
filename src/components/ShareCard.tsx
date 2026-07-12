"use client";

import { useCallback, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Share2, Download, Copy, Check, Twitter } from "lucide-react";

type ShareKind = "referral" | "stats" | "trade";

interface ShareCardProps {
    kind?: ShareKind;
    /** Prefilled stats */
    volume?: number;
    points?: number;
    tierLabel?: string;
    tradersCount?: number;
    referralCode?: string;
    className?: string;
}

/**
 * Canvas-generated share cards for Twitter / TG / download.
 */
export function ShareCard({
    kind = "referral",
    volume = 0,
    points = 0,
    tierLabel = "Base",
    tradersCount = 0,
    referralCode = "",
    className = "",
}: ShareCardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { publicKey } = useWallet();
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const walletShort = publicKey
        ? `${publicKey.toString().slice(0, 4)}…${publicKey.toString().slice(-4)}`
        : "Trader";

    const link =
        typeof window !== "undefined" && referralCode
            ? `${window.location.origin}?ref=${referralCode}`
            : "https://shx.exchange";

    const draw = useCallback(async (): Promise<string | null> => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const w = 1200;
        const h = 630;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // Background
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#050505");
        grad.addColorStop(0.5, "#0a1f12");
        grad.addColorStop(1, "#05100a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Glow orbs
        ctx.fillStyle = "rgba(34,197,94,0.15)";
        ctx.beginPath();
        ctx.arc(200, 100, 180, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(163,230,53,0.1)";
        ctx.beginPath();
        ctx.arc(1000, 500, 220, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = "rgba(34,197,94,0.35)";
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, w - 40, h - 40);

        // Brand
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 28px monospace";
        ctx.fillText("SHULEVITZ EXCHANGE", 60, 80);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 56px system-ui, sans-serif";

        if (kind === "referral") {
            ctx.fillText("Earn USDC for real volume", 60, 180);
            ctx.fillStyle = "#a3a3a3";
            ctx.font = "28px system-ui, sans-serif";
            ctx.fillText("25–35% of fees after friends trade $100+", 60, 240);
            ctx.fillStyle = "#22c55e";
            ctx.font = "bold 36px monospace";
            ctx.fillText(referralCode ? `?ref=${referralCode}` : "shx.exchange", 60, 340);
            ctx.fillStyle = "#e5e5e5";
            ctx.font = "24px system-ui, sans-serif";
            ctx.fillText("Auto-pay USDC at $5 claimable · Non-custodial", 60, 400);
        } else if (kind === "stats") {
            ctx.fillText("My SHX stats", 60, 180);
            ctx.fillStyle = "#a3a3a3";
            ctx.font = "26px monospace";
            ctx.fillText(walletShort, 60, 230);
            ctx.fillStyle = "#22c55e";
            ctx.font = "bold 48px monospace";
            ctx.fillText(`$${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} vol`, 60, 320);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 36px monospace";
            ctx.fillText(`${points.toLocaleString()} XP  ·  ${tierLabel} tier`, 60, 390);
            if (tradersCount > 0) {
                ctx.fillStyle = "#a3a3a3";
                ctx.font = "22px system-ui, sans-serif";
                ctx.fillText(`${tradersCount.toLocaleString()} wallets trading on SHX`, 60, 450);
            }
        } else {
            ctx.fillText("Trade executed on SHX", 60, 180);
            ctx.fillStyle = "#22c55e";
            ctx.font = "bold 48px monospace";
            ctx.fillText(`+$${volume.toFixed(2)} volume`, 60, 280);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 32px monospace";
            ctx.fillText(`+${points} XP`, 60, 350);
            ctx.fillStyle = "#a3a3a3";
            ctx.font = "24px system-ui, sans-serif";
            ctx.fillText("Jupiter Ultra · Self-custody · shx.exchange", 60, 420);
        }

        // Footer
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "20px monospace";
        ctx.fillText("shx.exchange  ·  Elite Solana trading", 60, 580);

        return canvas.toDataURL("image/png");
    }, [kind, volume, points, tierLabel, tradersCount, referralCode, walletShort]);

    const generate = async () => {
        setBusy(true);
        try {
            const url = await draw();
            setPreview(url);
            return url;
        } finally {
            setBusy(false);
        }
    };

    const download = async () => {
        const url = preview || (await generate());
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `shx-${kind}-${Date.now()}.png`;
        a.click();
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareNative = async () => {
        const url = preview || (await generate());
        const text =
            kind === "referral"
                ? `Trade on Shulevitz Exchange — I earn USDC when you do. ${link}`
                : kind === "stats"
                  ? `My SHX volume: $${volume.toFixed(0)} · ${points} XP · ${tierLabel}. Join: ${link}`
                  : `Just traded on SHX Exchange. $${volume.toFixed(2)} volume. ${link}`;

        if (navigator.share && url) {
            try {
                const blob = await (await fetch(url)).blob();
                const file = new File([blob], "shx.png", { type: "image/png" });
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ text, files: [file], url: link });
                    return;
                }
            } catch {
                /* fall through */
            }
        }
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tweet = () => {
        const text =
            kind === "referral"
                ? encodeURIComponent(
                      `Earn USDC for real trading volume on @shulevitz — 25–35% fee share after $100. ${link}`
                  )
                : encodeURIComponent(
                      `Trading on Shulevitz Exchange — $${volume.toFixed(0)} volume, ${points} XP. ${link}`
                  );
        window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    };

    return (
        <div className={`rounded-2xl border border-white/10 bg-black/40 overflow-hidden ${className}`}>
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Share2 size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Share card</h3>
            </div>
            <div className="p-4 space-y-3">
                <canvas ref={canvasRef} className="hidden" />
                {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={preview}
                        alt="SHX share card"
                        className="w-full rounded-xl border border-white/10"
                    />
                ) : (
                    <div className="aspect-[1200/630] w-full rounded-xl border border-dashed border-white/15 bg-white/[0.02] flex items-center justify-center text-xs text-muted-foreground">
                        Generate a viral card for Twitter / TG
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={generate}
                        disabled={busy}
                        className="py-2.5 rounded-xl bg-primary text-black text-xs font-black disabled:opacity-60"
                    >
                        {busy ? "Drawing…" : preview ? "Regenerate" : "Generate card"}
                    </button>
                    <button
                        type="button"
                        onClick={download}
                        disabled={busy}
                        className="py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                        <Download size={12} /> PNG
                    </button>
                    <button
                        type="button"
                        onClick={shareNative}
                        className="py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? "Copied" : "Share / copy"}
                    </button>
                    <button
                        type="button"
                        onClick={tweet}
                        className="py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-bold flex items-center justify-center gap-1"
                    >
                        <Twitter size={12} /> Post
                    </button>
                </div>
            </div>
        </div>
    );
}
