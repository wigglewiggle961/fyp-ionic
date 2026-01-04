// Sleep API Service - Fetches session data and insights from backend
import { API_BASE as BASE_URL } from '../config/api';

const API_BASE = `${BASE_URL}/api/v1`;

export interface Session {
    session_id: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    prediction_count: number;
}

export interface SleepSummary {
    total_duration_min: number;
    wake_min: number;
    rem_min: number;
    light_min: number;
    deep_min: number;
    sleep_efficiency: number;
    sleep_score: number;
    prediction_count: number;
}

export interface Prediction {
    epoch_timestamp: string;
    predicted_stage: number;
    stage_label: string;
    confidence: number;
    hr_mean: number;
    hr_min: number;
    hr_max: number;
    movement_level: number;
    // Engineered features
    hr_volatility_pure?: number;
    rem_index?: number;
    deep_index?: number;
    dist_from_min?: number;
    time_from_onset?: number;
    // SHAP per-prediction contributions
    shap_contributions?: Record<string, number>;
}

export interface FeatureExplanation {
    key: string;
    name: string;
    desc: string;
    category: string;
}

export interface SessionDetail {
    status: string;
    session_id: string;
    summary: SleepSummary;
    predictions: Prediction[];
    feature_explanations: FeatureExplanation[];
}

export const SleepAPI = {
    async getSessions(deviceId: string): Promise<Session[]> {
        try {
            const res = await fetch(`${API_BASE}/sessions/${deviceId}`);
            const data = await res.json();
            return data.sessions || [];
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
            return [];
        }
    },

    async getSessionDetail(deviceId: string, sessionId: string): Promise<SessionDetail | null> {
        try {
            const res = await fetch(`${API_BASE}/sessions/${deviceId}/${sessionId}`);
            const data = await res.json();
            if (data.status === 'ok') {
                return data;
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch session detail:', error);
            return null;
        }
    },

    async getFeatureExplanations(): Promise<FeatureExplanation[]> {
        try {
            const res = await fetch(`${API_BASE}/features`);
            const data = await res.json();
            return data.features || [];
        } catch (error) {
            console.error('Failed to fetch features:', error);
            return [];
        }
    },

    async getLatestPrediction(deviceId: string): Promise<Prediction | null> {
        try {
            const res = await fetch(`${API_BASE}/predictions/${deviceId}/latest`);
            const data = await res.json();
            return data.prediction || null;
        } catch (error) {
            console.error('Failed to fetch latest prediction:', error);
            return null;
        }
    },

    // Demo mode controls
    async startDemo(deviceId: string): Promise<boolean> {
        try {
            const res = await fetch(`${API_BASE}/demo/start/${deviceId}`, { method: 'POST' });
            const data = await res.json();
            return data.status === 'ok';
        } catch (error) {
            console.error('Failed to start demo:', error);
            return false;
        }
    },

    async stopDemo(deviceId: string): Promise<boolean> {
        try {
            const res = await fetch(`${API_BASE}/demo/stop/${deviceId}`, { method: 'POST' });
            const data = await res.json();
            return data.status === 'ok';
        } catch (error) {
            console.error('Failed to stop demo:', error);
            return false;
        }
    },

    async getDemoStatus(deviceId: string): Promise<boolean> {
        try {
            const res = await fetch(`${API_BASE}/demo/status/${deviceId}`);
            const data = await res.json();
            return data.demo_running || false;
        } catch (error) {
            console.error('Failed to get demo status:', error);
            return false;
        }
    }
};
