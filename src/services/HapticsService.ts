import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Service to handle haptic feedback for the silent alarm option.
 * Provides continuous vibration until stopped.
 */
class HapticsService {
    private vibrationInterval: ReturnType<typeof setInterval> | null = null;
    private isVibrating: boolean = false;

    /**
     * Start continuous vibration pattern for silent alarm.
     * Uses a repeating pattern of heavy impact haptics.
     */
    async startContinuousVibration(): Promise<void> {
        if (this.isVibrating) {
            console.log('[HapticsService] Already vibrating');
            return;
        }

        console.log('[HapticsService] Starting continuous vibration');
        this.isVibrating = true;

        // Initial vibration
        await this.performVibration();

        // Repeat vibration every 1.5 seconds to simulate continuous alarm
        this.vibrationInterval = setInterval(async () => {
            if (this.isVibrating) {
                await this.performVibration();
            }
        }, 1500);
    }

    /**
     * Perform a single vibration burst (3 quick heavy impacts)
     */
    private async performVibration(): Promise<void> {
        try {
            // Pattern: 3 quick heavy impacts
            await Haptics.impact({ style: ImpactStyle.Heavy });
            await this.delay(100);
            await Haptics.impact({ style: ImpactStyle.Heavy });
            await this.delay(100);
            await Haptics.impact({ style: ImpactStyle.Heavy });
            await this.delay(200);
            await Haptics.impact({ style: ImpactStyle.Heavy });
            await this.delay(100);
            await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
            console.error('[HapticsService] Vibration error:', e);
        }
    }

    /**
     * Stop continuous vibration.
     */
    stop(): void {
        console.log('[HapticsService] Stopping vibration');
        this.isVibrating = false;

        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }
    }

    /**
     * Check if vibration is currently active.
     */
    isActive(): boolean {
        return this.isVibrating;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
let hapticsServiceInstance: HapticsService | null = null;

export function getHapticsService(): HapticsService {
    if (!hapticsServiceInstance) {
        hapticsServiceInstance = new HapticsService();
    }
    return hapticsServiceInstance;
}

export { HapticsService };
