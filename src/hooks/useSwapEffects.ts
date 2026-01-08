"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

export function useSwapEffects() {
    // Success sound effect
    const playSuccessSound = useCallback(() => {
        try {
            // Create a simple success tone using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // First tone (higher)
            const oscillator1 = audioContext.createOscillator();
            const gainNode1 = audioContext.createGain();
            oscillator1.connect(gainNode1);
            gainNode1.connect(audioContext.destination);
            oscillator1.frequency.value = 880; // A5
            oscillator1.type = "sine";
            gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator1.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + 0.3);

            // Second tone (even higher, delayed)
            setTimeout(() => {
                const oscillator2 = audioContext.createOscillator();
                const gainNode2 = audioContext.createGain();
                oscillator2.connect(gainNode2);
                gainNode2.connect(audioContext.destination);
                oscillator2.frequency.value = 1320; // E6
                oscillator2.type = "sine";
                gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                oscillator2.start(audioContext.currentTime);
                oscillator2.stop(audioContext.currentTime + 0.4);
            }, 100);
        } catch (e) {
            console.log("Audio not supported");
        }
    }, []);

    // Confetti explosion
    const triggerConfetti = useCallback(() => {
        const count = 200;
        const defaults = {
            origin: { y: 0.7 },
            zIndex: 9999,
        };

        function fire(particleRatio: number, opts: confetti.Options) {
            confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio),
            });
        }

        // Green and gold themed confetti
        fire(0.25, {
            spread: 26,
            startVelocity: 55,
            colors: ["#22c55e", "#84cc16", "#eab308"],
        });
        fire(0.2, {
            spread: 60,
            colors: ["#22c55e", "#10b981", "#fbbf24"],
        });
        fire(0.35, {
            spread: 100,
            decay: 0.91,
            scalar: 0.8,
            colors: ["#a3e635", "#4ade80", "#fde047"],
        });
        fire(0.1, {
            spread: 120,
            startVelocity: 25,
            decay: 0.92,
            scalar: 1.2,
            colors: ["#22c55e", "#84cc16"],
        });
        fire(0.1, {
            spread: 120,
            startVelocity: 45,
            colors: ["#facc15", "#a3e635"],
        });
    }, []);

    // Combined success effect
    const onSwapSuccess = useCallback(() => {
        playSuccessSound();
        triggerConfetti();
    }, [playSuccessSound, triggerConfetti]);

    return { playSuccessSound, triggerConfetti, onSwapSuccess };
}
