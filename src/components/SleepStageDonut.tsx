// Sleep Stage Breakdown - Donut/pie chart showing sleep composition
import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StageBreakdownProps {
    wake: number;
    rem: number;
    light: number;
    deep: number;
}

const SleepStageDonut: React.FC<StageBreakdownProps> = ({ wake, rem, light, deep }) => {
    const total = wake + rem + light + deep;

    if (total === 0) {
        return (
            <div style={{ textAlign: 'center', color: '#666', padding: 20 }}>
                No data
            </div>
        );
    }

    const data = {
        labels: ['Wake', 'REM', 'Light', 'Deep'],
        datasets: [{
            data: [wake, rem, light, deep],
            backgroundColor: [
                '#ff6b6b',  // Wake - coral red
                '#a855f7',  // REM - purple
                '#3b82f6',  // Light - blue
                '#22c55e',  // Deep - green
            ],
            borderColor: '#1a1a1a',
            borderWidth: 2,
        }],
    };

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const mins = context.raw;
                        const pct = total > 0 ? Math.round((mins / total) * 100) : 0;
                        const hrs = Math.floor(mins / 60);
                        const m = Math.round(mins % 60);
                        return `${context.label}: ${hrs}h ${m}m (${pct}%)`;
                    }
                }
            }
        }
    };

    // Center text
    const sleepMins = rem + light + deep;
    const hrs = Math.floor(sleepMins / 60);
    const mins = Math.round(sleepMins % 60);

    return (
        <div style={{ position: 'relative', height: 180, width: '100%' }}>
            <Doughnut data={data} options={options} />
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none'
            }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>
                    {hrs}h {mins}m
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>SLEEP</div>
            </div>
        </div>
    );
};

// Legend row
export const StageLabels: React.FC<StageBreakdownProps> = ({ wake, rem, light, deep }) => {
    const stages = [
        { label: 'Wake', mins: wake, color: '#ff6b6b' },
        { label: 'REM', mins: rem, color: '#a855f7' },
        { label: 'Light', mins: light, color: '#3b82f6' },
        { label: 'Deep', mins: deep, color: '#22c55e' },
    ];

    return (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 }}>
            {stages.map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: s.color, margin: '0 auto 4px'
                    }} />
                    <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>
                        {Math.round(s.mins)}m
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SleepStageDonut;
