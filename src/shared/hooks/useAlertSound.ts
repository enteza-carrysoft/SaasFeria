'use client';

import { useCallback } from 'react';

export type AlertType = 'order_served' | 'account_opened' | 'account_closing' | 'generic';

interface AlertOptions {
    type?: AlertType;
    message?: string;
}

/**
 * Hook that provides in-app alert with sound + vibration.
 * Used when the app is in the foreground and push notifications are suppressed by the browser.
 */
export function useAlertSound() {
    const playSound = useCallback((type: AlertType = 'generic') => {
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            const patterns: Record<AlertType, { freq: number; duration: number }[]> = {
                order_served: [
                    { freq: 523, duration: 0.1 },  // C5
                    { freq: 659, duration: 0.1 },  // E5
                    { freq: 784, duration: 0.2 },  // G5
                ],
                account_opened: [
                    { freq: 440, duration: 0.15 },
                    { freq: 660, duration: 0.25 },
                ],
                account_closing: [
                    { freq: 880, duration: 0.1 },
                    { freq: 660, duration: 0.1 },
                    { freq: 440, duration: 0.3 },
                ],
                generic: [
                    { freq: 660, duration: 0.15 },
                    { freq: 880, duration: 0.2 },
                ],
            } as Record<AlertType, { freq: number; duration: number }[]>;

            const notes = patterns[type] ?? patterns.generic;
            let startTime = ctx.currentTime;

            notes.forEach(({ freq, duration }) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.4, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.start(startTime);
                osc.stop(startTime + duration);
                startTime += duration + 0.02;
            });
        } catch {
            // AudioContext blocked or unsupported — silent fail
        }
    }, []);

    const vibrate = useCallback((type: AlertType = 'generic') => {
        if (!('vibrate' in navigator)) return;
        const patterns: Record<AlertType, number[]> = {
            order_served: [100, 50, 100, 50, 200],
            account_opened: [200, 100, 200],
            account_closing: [300, 100, 300, 100, 300],
            generic: [150, 100, 150],
        };
        navigator.vibrate(patterns[type] ?? patterns.generic);
    }, []);

    const alert = useCallback(({ type = 'generic' }: AlertOptions = {}) => {
        playSound(type);
        vibrate(type);
    }, [playSound, vibrate]);

    return { alert };
}
