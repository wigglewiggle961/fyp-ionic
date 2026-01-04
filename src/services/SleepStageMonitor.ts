/**
 * SleepStageMonitor - Monitors sleep stages during smart alarm wake window
 * 
 * Polls the backend for the latest sleep prediction and triggers the alarm
 * when an optimal wake stage (Light or REM) is detected.
 */

import { SleepAPI } from './SleepAPI';

// Sleep stages from the model
export const SLEEP_STAGES = {
    WAKE: 0,
    LIGHT: 2,
    DEEP: 3,
    REM: 5
} as const;

// Optimal stages for waking (avoid Deep sleep)
const OPTIMAL_WAKE_STAGES = [SLEEP_STAGES.WAKE, SLEEP_STAGES.LIGHT, SLEEP_STAGES.REM];

// Polling interval in milliseconds (10 seconds for responsive detection)
const POLL_INTERVAL_MS = 10000;

export interface MonitorCallbacks {
    onOptimalWake: (stage: number, stageLabel: string) => void;
    onStageUpdate?: (stage: number, stageLabel: string) => void;
    onError?: (error: string) => void;
}

export class SleepStageMonitor {
    private pollInterval: NodeJS.Timeout | null = null;
    private deviceId: string | null = null;
    private callbacks: MonitorCallbacks | null = null;
    private isMonitoring: boolean = false;
    private windowEndTime: Date | null = null;
    private consecutiveOptimalCount: number = 0;  // Track consecutive optimal stages
    private readonly REQUIRED_CONSECUTIVE = 2;    // Require 2 consecutive Light/REM to trigger

    /**
     * Start monitoring sleep stages.
     * Will poll every 30 seconds and call onOptimalWake when Light/REM detected.
     * 
     * @param deviceId - The ring device ID
     * @param windowEndTime - The latest time to trigger alarm (hard alarm time)
     * @param callbacks - Callbacks for optimal wake detection and updates
     */
    startMonitoring(
        deviceId: string,
        windowEndTime: Date,
        callbacks: MonitorCallbacks
    ): void {
        if (this.isMonitoring) {
            console.log('[SleepStageMonitor] Already monitoring, stopping previous session');
            this.stop();
        }

        this.deviceId = deviceId;
        this.windowEndTime = windowEndTime;
        this.callbacks = callbacks;
        this.isMonitoring = true;

        console.log(`[SleepStageMonitor] Starting monitoring for device ${deviceId}`);
        console.log(`[SleepStageMonitor] Window ends at ${windowEndTime.toLocaleTimeString()}`);

        // Do an immediate check
        this.checkSleepStage();

        // Then poll every 30 seconds
        this.pollInterval = setInterval(() => {
            this.checkSleepStage();
        }, POLL_INTERVAL_MS);
    }

    /**
     * Stop monitoring sleep stages.
     */
    stop(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isMonitoring = false;
        this.deviceId = null;
        this.callbacks = null;
        this.windowEndTime = null;
        console.log('[SleepStageMonitor] Stopped monitoring');
    }

    /**
     * Check if currently monitoring.
     */
    isActive(): boolean {
        return this.isMonitoring;
    }

    /**
     * Check if a stage is optimal for waking.
     */
    private isOptimalWakeStage(stage: number): boolean {
        return OPTIMAL_WAKE_STAGES.includes(stage as typeof OPTIMAL_WAKE_STAGES[number]);
    }

    /**
     * Get human-readable stage label
     */
    private getStageLabel(stage: number): string {
        switch (stage) {
            case SLEEP_STAGES.WAKE: return 'Wake';
            case SLEEP_STAGES.LIGHT: return 'Light';
            case SLEEP_STAGES.DEEP: return 'Deep';
            case SLEEP_STAGES.REM: return 'REM';
            default: return 'Unknown';
        }
    }

    /**
     * Poll backend for latest sleep stage and check if optimal for waking.
     */
    private async checkSleepStage(): Promise<void> {
        if (!this.deviceId || !this.callbacks) {
            return;
        }

        // Check if we've passed the window end time
        if (this.windowEndTime && new Date() >= this.windowEndTime) {
            console.log('[SleepStageMonitor] Window ended, stopping monitor');
            this.stop();
            return;
        }

        try {
            const prediction = await SleepAPI.getLatestPrediction(this.deviceId);

            if (!prediction) {
                console.log('[SleepStageMonitor] No prediction available');
                return;
            }

            // Check prediction recency - only use predictions from last 2 minutes
            // This prevents triggering alarm based on old data from previous sessions
            const MAX_PREDICTION_AGE_MS = 2 * 60 * 1000; // 2 minutes

            // Backend returns UTC timestamps - ensure we parse as UTC
            let predictionTimeStr = prediction.epoch_timestamp;
            // If timestamp doesn't have Z or timezone, assume UTC
            if (!predictionTimeStr.endsWith('Z') && !predictionTimeStr.includes('+')) {
                predictionTimeStr = predictionTimeStr + 'Z';
            }
            const predictionTime = new Date(predictionTimeStr);
            const predictionAgeMs = Date.now() - predictionTime.getTime();

            if (predictionAgeMs > MAX_PREDICTION_AGE_MS) {
                console.log(`[SleepStageMonitor] Prediction too old (${Math.round(predictionAgeMs / 1000)}s), need active monitoring`);
                return;
            }

            const stage = prediction.predicted_stage;
            const stageLabel = prediction.stage_label || this.getStageLabel(stage);

            console.log(`[SleepStageMonitor] Current stage: ${stageLabel} (${stage}), age: ${Math.round(predictionAgeMs / 1000)}s`);

            // Notify about stage update if callback provided
            if (this.callbacks.onStageUpdate) {
                this.callbacks.onStageUpdate(stage, stageLabel);
            }

            // Check if this is an optimal wake stage
            if (this.isOptimalWakeStage(stage)) {
                this.consecutiveOptimalCount++;
                console.log(`[SleepStageMonitor] Optimal stage: ${stageLabel} (${this.consecutiveOptimalCount}/${this.REQUIRED_CONSECUTIVE} consecutive)`);

                // Only trigger after REQUIRED_CONSECUTIVE optimal stages in a row
                if (this.consecutiveOptimalCount >= this.REQUIRED_CONSECUTIVE) {
                    console.log(`[SleepStageMonitor] Triggering alarm after ${this.consecutiveOptimalCount} consecutive optimal stages`);
                    this.callbacks.onOptimalWake(stage, stageLabel);
                    this.stop();
                }
            } else {
                // Reset counter if we hit a non-optimal stage
                if (this.consecutiveOptimalCount > 0) {
                    console.log(`[SleepStageMonitor] Reset consecutive count (was ${this.consecutiveOptimalCount}, now in ${stageLabel})`);
                }
                this.consecutiveOptimalCount = 0;
                console.log(`[SleepStageMonitor] Not optimal for waking (${stageLabel}), waiting...`);
            }
        } catch (error) {
            console.error('[SleepStageMonitor] Error checking sleep stage:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError('Failed to check sleep stage');
            }
        }
    }
}

// Singleton instance for easy access
let _monitor: SleepStageMonitor | null = null;

export function getSleepStageMonitor(): SleepStageMonitor {
    if (!_monitor) {
        _monitor = new SleepStageMonitor();
    }
    return _monitor;
}
