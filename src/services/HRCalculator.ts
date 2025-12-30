/**
 * HRCalculator - Real-time heart rate calculation from PPG data
 * 
 * Optimized for low-frequency PPG summary data from wearable rings
 * that send ~1-3 samples per second (not raw 25Hz waveform).
 */

export interface HRResult {
    bpm: number;
    confidence: 'high' | 'medium' | 'low' | 'none';
    peakCount: number;
    bufferSize: number;
}

/**
 * Calculate heart rate from PPG values.
 * Uses zero-crossing detection on the signal derivative,
 * which works better for low-frequency sampled data.
 * 
 * @param ppgValues Array of PPG sensor readings
 * @param samplingRateHz Approximate sampling rate (samples per second)
 * @returns Heart rate result with BPM and confidence
 */
export function calculateHR(ppgValues: number[], samplingRateHz: number = 3): HRResult {
    const noResult: HRResult = { bpm: 0, confidence: 'none', peakCount: 0, bufferSize: ppgValues.length };

    // Filter out zero values (invalid readings) from the buffer
    const validValues = ppgValues.filter(v => v > 0);

    // Need at least 5 seconds of valid data for any estimate
    const minSamples = Math.floor(samplingRateHz * 5);
    if (validValues.length < minSamples) {
        console.log('[HRCalc] Not enough valid samples:', validValues.length, 'need:', minSamples);
        return { ...noResult, bufferSize: validValues.length };
    }

    // Remove DC offset (center around 0)
    const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const centered = validValues.map(v => v - mean);

    // Check for flat signal
    const variance = centered.reduce((sum, v) => sum + v * v, 0) / centered.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 10) { // Very low variation
        console.log('[HRCalc] Signal too flat, stdDev:', stdDev);
        return { ...noResult, bufferSize: ppgValues.length };
    }

    // Log PPG stats
    const minVal = Math.min(...validValues);
    const maxVal = Math.max(...validValues);
    console.log('[HRCalc] PPG Stats - ValidSamples:', validValues.length, 'Min:', minVal, 'Max:', maxVal, 'Range:', maxVal - minVal, 'StdDev:', stdDev.toFixed(1));

    // Apply simple smoothing (3-point moving average)
    const smoothed = movingAverageFilter(centered, 3);

    // Method 1: Zero-crossing detection on smoothed signal
    // Count how many times the signal crosses zero (from negative to positive)
    const zeroCrossings = countZeroCrossingsUp(smoothed);

    // Each heart beat causes the PPG to go up and down, so crossings ≈ beats
    const durationSeconds = validValues.length / samplingRateHz;
    const bpmFromCrossings = (zeroCrossings / durationSeconds) * 60;

    // Method 2: Peak detection for validation
    const peaks = findPeaksSimple(smoothed, samplingRateHz);
    const bpmFromPeaks = peaks.length > 1
        ? ((peaks.length - 1) / durationSeconds) * 60
        : 0;

    // Use the more reliable estimate
    let bpm = 0;
    let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';

    // Log calculation results
    console.log('[HRCalc] Duration:', durationSeconds.toFixed(1), 's, ZeroCrossings:', zeroCrossings, 'Peaks:', peaks.length);
    console.log('[HRCalc] BPM from crossings:', bpmFromCrossings.toFixed(0), 'BPM from peaks:', bpmFromPeaks.toFixed(0));

    // Validate readings are in physiological range (40-180 BPM)
    const isValidCrossing = bpmFromCrossings >= 40 && bpmFromCrossings <= 180;
    const isValidPeaks = bpmFromPeaks >= 40 && bpmFromPeaks <= 180;

    if (isValidCrossing && isValidPeaks) {
        // Both methods agree roughly
        const diff = Math.abs(bpmFromCrossings - bpmFromPeaks);
        if (diff < 20) {
            bpm = Math.round((bpmFromCrossings + bpmFromPeaks) / 2);
            confidence = diff < 10 ? 'high' : 'medium';
        } else {
            // Use peak-based if available, otherwise crossings
            bpm = Math.round(bpmFromPeaks > 0 ? bpmFromPeaks : bpmFromCrossings);
            confidence = 'low';
        }
    } else if (isValidPeaks) {
        bpm = Math.round(bpmFromPeaks);
        confidence = peaks.length >= 5 ? 'medium' : 'low';
    } else if (isValidCrossing) {
        bpm = Math.round(bpmFromCrossings);
        confidence = zeroCrossings >= 5 ? 'medium' : 'low';
    }

    return {
        bpm,
        confidence,
        peakCount: peaks.length,
        bufferSize: validValues.length
    };
}

/**
 * Count zero crossings from negative to positive
 */
function countZeroCrossingsUp(signal: number[]): number {
    let count = 0;
    for (let i = 1; i < signal.length; i++) {
        if (signal[i - 1] < 0 && signal[i] >= 0) {
            count++;
        }
    }
    return count;
}

/**
 * Simple moving average filter
 */
function movingAverageFilter(signal: number[], windowSize: number): number[] {
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < signal.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - halfWindow); j <= Math.min(signal.length - 1, i + halfWindow); j++) {
            sum += signal[j];
            count++;
        }
        result.push(sum / count);
    }

    return result;
}

/**
 * Simple peak detection - finds local maxima with minimum distance
 */
function findPeaksSimple(signal: number[], samplingRateHz: number): number[] {
    const peaks: number[] = [];

    // Minimum distance between peaks: for 180 BPM = 0.33 seconds
    const minDistance = Math.max(1, Math.floor(samplingRateHz * 0.33));

    // Calculate threshold as mean + 0.3 * std
    const maxVal = Math.max(...signal);
    const minVal = Math.min(...signal);
    const range = maxVal - minVal;
    const threshold = minVal + range * 0.4; // 40% above minimum

    for (let i = 1; i < signal.length - 1; i++) {
        // Local maximum above threshold
        if (signal[i] > threshold &&
            signal[i] >= signal[i - 1] &&
            signal[i] >= signal[i + 1]) {

            // Check minimum distance from last peak
            if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
                peaks.push(i);
            }
        }
    }

    return peaks;
}

/**
 * HR Calculator class for continuous monitoring
 * Maintains a sliding window of PPG values
 */
export class HRCalculator {
    private buffer: number[] = [];
    private readonly maxBufferSize: number;
    private readonly samplingRateHz: number;
    private lastHR: number = 0;

    constructor(windowSeconds: number = 30, samplingRateHz: number = 3) {
        this.samplingRateHz = samplingRateHz;
        this.maxBufferSize = windowSeconds * samplingRateHz;
    }

    /**
     * Add a new PPG value and get updated HR
     */
    addSample(ppgValue: number): HRResult {
        this.buffer.push(ppgValue);

        // Keep buffer at max size
        while (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        const result = calculateHR(this.buffer, this.samplingRateHz);

        // Smooth the output - don't jump around too much
        if (result.bpm > 0) {
            if (this.lastHR === 0) {
                this.lastHR = result.bpm;
            } else {
                // Exponential smoothing
                this.lastHR = Math.round(this.lastHR * 0.7 + result.bpm * 0.3);
            }
            return { ...result, bpm: this.lastHR };
        }

        return result;
    }

    /**
     * Add multiple samples at once
     */
    addSamples(ppgValues: number[]): HRResult {
        for (const v of ppgValues) {
            this.buffer.push(v);
        }

        // Trim to max size
        while (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        return calculateHR(this.buffer, this.samplingRateHz);
    }

    /**
     * Get current HR without adding new samples
     */
    getCurrentHR(): HRResult {
        return calculateHR(this.buffer, this.samplingRateHz);
    }

    /**
     * Clear the buffer
     */
    reset(): void {
        this.buffer = [];
        this.lastHR = 0;
    }

    /**
     * Get buffer size
     */
    getBufferSize(): number {
        return this.buffer.length;
    }
}
