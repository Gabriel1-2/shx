/**
 * Minimal chrome for the cinematic ad — parent layout still mounts,
 * but the ad is fixed fullscreen z-200 and covers header/nav.
 */
export default function AdLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-black overflow-hidden">{children}</div>
    );
}
