import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    ScriptableContext
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
);

interface PPGWaveformChartProps {
    dataPoints: Array<{ timestamp: number; ppg: number }>;
}

const PPGWaveformChart: React.FC<PPGWaveformChartProps> = ({ dataPoints }) => {
    console.log('[PPGWaveformChart] Rendering with', dataPoints.length, 'points');

    const chartData = useMemo(() => {
        // Take last 60 points for detailed waveform view
        const recent = dataPoints.slice(-60);

        return {
            labels: recent.map((_, i) => i.toString()),
            datasets: [
                {
                    label: 'PPG',
                    data: recent.map(p => p.ppg),
                    fill: true,
                    backgroundColor: (context: ScriptableContext<'line'>) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 150);
                        gradient.addColorStop(0, 'rgba(255, 75, 75, 0.4)');
                        gradient.addColorStop(1, 'rgba(255, 75, 75, 0.0)');
                        return gradient;
                    },
                    borderColor: '#ff4b4b',
                    tension: 0.3, // Smooth curve
                    pointRadius: 0, // No points - just the line for waveform
                    borderWidth: 1.5,
                },
            ],
        };
    }, [dataPoints, dataPoints.length]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 100, // Fast animation for real-time feel
            easing: 'linear' as const,
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                enabled: false, // Disable tooltip for waveform
            },
        },
        scales: {
            x: {
                display: false,
                grid: {
                    display: false
                }
            },
            y: {
                display: false,
                grid: {
                    display: false
                },
            },
        },
        interaction: {
            intersect: false,
            mode: 'index' as const,
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Line options={options} data={chartData} />
        </div>
    );
};

export default PPGWaveformChart;
