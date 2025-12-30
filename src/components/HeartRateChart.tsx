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

interface HeartRateChartProps {
    dataPoints: Array<{ timestamp: string; hr: number }>;
}

const HeartRateChart: React.FC<HeartRateChartProps> = ({ dataPoints }) => {
    // Debug: log when component receives new data
    console.log('[HeartRateChart] Rendering with', dataPoints.length, 'points');

    const chartData = useMemo(() => {
        // Take last 30 points for cleaner view
        const recent = dataPoints.slice(-30);
        console.log('[HeartRateChart] Building chart data with', recent.length, 'points');

        return {
            labels: recent.map(p => new Date(p.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })),
            datasets: [
                {
                    label: 'Heart Rate',
                    data: recent.map(p => p.hr),
                    fill: true,
                    backgroundColor: (context: ScriptableContext<'line'>) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(29, 185, 84, 0.4)');
                        gradient.addColorStop(1, 'rgba(29, 185, 84, 0.0)');
                        return gradient;
                    },
                    borderColor: '#1DB954',
                    tension: 0.4,
                    pointRadius: 2, // Show small dots for each point
                    pointHoverRadius: 5,
                    borderWidth: 2,
                },
            ],
        };
    }, [dataPoints, dataPoints.length]); // Include length to detect array changes

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 300,
            easing: 'easeInOutQuart' as const,
        },
        transitions: {
            active: {
                animation: {
                    duration: 200
                }
            }
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(20, 20, 20, 0.9)',
                titleColor: '#888',
                bodyColor: '#fff',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                displayColors: false,
            },
        },
        scales: {
            x: {
                display: false, // Hide X axis labels for sparkline look
                grid: {
                    display: false
                }
            },
            y: {
                display: true,
                position: 'right' as const,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                },
                ticks: {
                    color: '#666',
                    font: {
                        size: 10
                    }
                },
                min: 40, // Reasonable resting HR floor
                suggestedMax: 120
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Line options={options} data={chartData} />
        </div>
    );
};

export default HeartRateChart;
