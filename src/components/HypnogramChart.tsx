// Hypnogram Chart - Visual sleep stage timeline
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface HypnogramProps {
    predictions: Array<{
        epoch_timestamp: string;
        predicted_stage: number;
        stage_label: string;
    }>;
}

const STAGE_COLORS: Record<number, string> = {
    0: '#ff6b6b',  // Wake - red
    1: '#a855f7',  // REM - purple
    2: '#3b82f6',  // Light - blue
    3: '#22c55e',  // Deep - green
};

const STAGE_LABELS: Record<number, string> = {
    0: 'Wake',
    1: 'REM',
    2: 'Light',
    3: 'Deep',
};

const HypnogramChart: React.FC<HypnogramProps> = ({ predictions }) => {
    if (!predictions || predictions.length === 0) {
        return (
            <div style={{
                height: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666'
            }}>
                No sleep data available
            </div>
        );
    }

    // Convert stages to inverted values for display (Deep at bottom, Wake at top)
    const stageToY: Record<number, number> = {
        0: 3,  // Wake at top
        1: 2,  // REM
        2: 1,  // Light
        3: 0,  // Deep at bottom
    };

    const labels = predictions.map(p => {
        const date = new Date(p.epoch_timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    // Only show every Nth label to avoid crowding
    const labelStep = Math.max(1, Math.floor(predictions.length / 8));

    const data = {
        labels,
        datasets: [{
            data: predictions.map(p => stageToY[p.predicted_stage] ?? 0),
            borderColor: '#1DB954',
            backgroundColor: 'rgba(29, 185, 84, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
        }],
    };

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const stageNum = 3 - context.raw;  // Reverse the mapping
                        return STAGE_LABELS[stageNum] || 'Unknown';
                    }
                }
            }
        },
        scales: {
            x: {
                display: true,
                grid: { display: false },
                ticks: {
                    color: '#666',
                    font: { size: 10 },
                    maxRotation: 0,
                    callback: function (value: any, index: number) {
                        return index % labelStep === 0 ? labels[index] : '';
                    }
                }
            },
            y: {
                display: true,
                min: -0.5,
                max: 3.5,
                grid: { display: false },
                ticks: {
                    color: '#888',
                    font: { size: 10 },
                    stepSize: 1,
                    callback: function (value: number) {
                        const stageNum = 3 - value;
                        return STAGE_LABELS[stageNum] || '';
                    }
                }
            }
        },
    };

    return (
        <div style={{ height: '140px', position: 'relative' }}>
            <Line data={data} options={options} />
        </div>
    );
};

export default HypnogramChart;
