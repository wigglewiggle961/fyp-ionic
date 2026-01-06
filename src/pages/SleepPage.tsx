import React, { useState, useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import {
    IonContent, IonPage, IonHeader, IonToolbar, IonTitle,
    IonIcon, IonButton,
    IonToggle, IonItem, IonLabel, IonButtons,
    IonCard, IonGrid, IonRow, IonCol, IonText, IonChip
} from '@ionic/react';
import {
    heart, bluetooth,
    playCircleOutline, stopCircleOutline, listOutline,
    waterOutline, pulse, speedometer, analytics, flashOutline
} from 'ionicons/icons';
import './SleepPage.css';
import { useRingData } from '../services/RingDataProvider';
import { SleepAPI } from '../services/SleepAPI';
import HeartRateChart from '../components/HeartRateChart';
import PPGWaveformChart from '../components/PPGWaveformChart';

const SleepPage: React.FC = () => {
    // Keep screen on while this page is active
    useEffect(() => {
        const keepOn = async () => {
            try {
                await KeepAwake.keepAwake();
                console.log('Screen keep-awake enabled');
            } catch (error) {
                console.error('Error enabling keep-awake:', error);
            }
        };
        keepOn();

        return () => {
            const allowSleep = async () => {
                try {
                    await KeepAwake.allowSleep();
                    console.log('Screen keep-awake disabled');
                } catch (error) {
                    console.error('Error disabling keep-awake:', error);
                }
            };
            allowSleep();
        };
    }, []);

    const {
        scanAndConnect, startDataCollection, stopDataCollection,
        startPeriodicCollection, stopPeriodicCollection, disconnectDevice,
        isCollecting, isPeriodicRunning, currentHR, hrHistory, ppgHistory, data,
        error, deviceId
    } = useRingData();

    const [isScientific, setIsScientific] = useState(false);
    const [isDemoRunning, setIsDemoRunning] = useState(false);

    // Toggle demo mode
    const toggleDemoMode = async () => {
        if (!deviceId) return;

        if (isDemoRunning) {
            await SleepAPI.stopDemo(deviceId);
            setIsDemoRunning(false);
        } else {
            const success = await SleepAPI.startDemo(deviceId);
            setIsDemoRunning(success);
        }
    };

    // Get latest reading or defaults
    const latest = data.length > 0 ? data[data.length - 1] : null;
    // Use currentHR from the HR calculator for live display
    const displayHR = currentHR || latest?.hr || '--';

    // Find last known SpO2 from recent data (SpO2 packets arrive less frequently)
    const lastKnownSpo2 = (() => {
        for (let i = data.length - 1; i >= Math.max(0, data.length - 10); i--) {
            if (data[i]?.spo2) return Math.round(data[i].spo2);
        }
        return '--';
    })();

    // Simple activity heuristic
    const isMoving = latest ? (Math.abs(latest.accX) > 1.2 || Math.abs(latest.accY) > 1.2) : false;

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar className="sleep-header-toolbar">
                    <IonTitle>Recovery</IonTitle>
                    <IonButtons slot="end">
                        <IonItem lines="none" style={{ '--background': 'transparent', '--color': '#fff', '--min-height': '32px' }}>
                            <IonLabel style={{ fontSize: '0.6rem', color: '#666', marginRight: 8, letterSpacing: '1px' }}>
                                DEV
                            </IonLabel>
                            <IonToggle
                                checked={isScientific}
                                onIonChange={e => setIsScientific(e.detail.checked)}
                                mode="ios"
                                style={{ transform: 'scale(0.7)' }}
                            />
                        </IonItem>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen className="sleep-page-content">

                {/* CONNECTION GRID STRIP */}
                <div className="connection-status-strip">
                    <div className={`status-dot ${deviceId ? 'connected' : ''}`} />
                    <span className="status-text">{deviceId ? 'Ring Connected' : 'Disconnected'}</span>
                    {(isCollecting || isPeriodicRunning) && (
                        <>
                            <span style={{ margin: '0 8px', color: '#333' }}>|</span>
                            <span className="status-text" style={{ color: '#1DB954' }}>
                                {isPeriodicRunning ? 'Monitoring' : 'Collecting'}
                            </span>
                        </>
                    )}
                    {isDemoRunning && (
                        <>
                            <span style={{ margin: '0 8px', color: '#333' }}>|</span>
                            <span className="status-text" style={{ color: '#ff9500' }}>
                                🎬 DEMO
                            </span>
                        </>
                    )}
                </div>

                {error && (
                    <div style={{ textAlign: 'center', color: '#ff4d4d', background: 'rgba(255,75,75,0.1)', padding: 10, margin: '0 16px 16px', borderRadius: 12, fontSize: 13 }}>
                        {error}
                    </div>
                )}

                {/* HERO VITALS CARD */}
                <div className="vitals-hero-card">
                    <div className="vitals-header">
                        <span className="vitals-title">Live Vitals</span>
                        <IonIcon icon={bluetooth} color={deviceId ? "success" : "medium"} />
                    </div>

                    <div className="main-metric-container">
                        <IonIcon icon={heart} className={`heart-icon-large ${isCollecting || isPeriodicRunning ? 'pulse-animation' : ''}`} />
                        <div>
                            <span className="metric-value-large">{displayHR}</span>
                            <span className="metric-unit">BPM</span>
                        </div>
                    </div>

                    {/* CHART SECTION */}
                    <div style={{ height: '120px', margin: '20px -10px' }}>
                        <HeartRateChart dataPoints={hrHistory} />
                    </div>

                    <div className="secondary-metrics-row">
                        <div className="sec-metric">
                            <span className="sec-label">SpO2</span>
                            <span className="sec-value" style={{ color: '#50c8ff' }}>{lastKnownSpo2}</span>
                        </div>
                        <div className="sec-metric">
                            <span className="sec-label">Motion</span>
                            <span className="sec-value">{isMoving ? 'Active' : 'Resting'}</span>
                        </div>
                    </div>

                    {/* PPG WAVEFORM SECTION */}
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>PPG Waveform</span>
                            <span style={{ fontSize: 10, color: '#555' }}>{ppgHistory.length} samples</span>
                        </div>
                        <div style={{ height: '80px', margin: '0 -10px' }}>
                            <PPGWaveformChart dataPoints={ppgHistory} />
                        </div>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="actions-container">
                    {deviceId ? (
                        <IonButton
                            expand="block"
                            className="control-btn connect-btn connected-state"
                            onClick={async () => {
                                if (isPeriodicRunning) await stopPeriodicCollection();
                                if (isCollecting) await stopDataCollection();
                                await disconnectDevice();
                            }}
                        >
                            Device Linked
                        </IonButton>
                    ) : (
                        <IonButton
                            expand="block"
                            className="control-btn connect-btn"
                            onClick={scanAndConnect}
                        >
                            Scan & Connect Ring
                        </IonButton>
                    )}

                    <div className="action-btn-row" style={{ marginTop: 12 }}>
                        <IonButton
                            className="control-btn"
                            fill="outline"
                            onClick={() => startDataCollection(60, 'walking')}
                            disabled={!deviceId || isCollecting}
                            style={{ flex: 1, border: 'none' }}
                        >
                            <IonIcon icon={playCircleOutline} style={{ marginRight: 8 }} />
                            Test 60s
                        </IonButton>

                        <IonButton
                            className="control-btn"
                            fill="outline"
                            style={{ flex: 1, '--border-color': 'rgba(255,255,255,0.2)', '--color': '#fff' }}
                            onClick={() => startPeriodicCollection(1, 10, 'walking', false)}
                            disabled={!deviceId || isCollecting}
                        >
                            <IonIcon icon={listOutline} style={{ marginRight: 8 }} />
                            Monitor
                        </IonButton>
                    </div>

                    <IonButton
                        expand="block"
                        color="danger"
                        className="control-btn"
                        onClick={async () => {
                            // Stop both periodic collection and current collection
                            if (isPeriodicRunning) {
                                await stopPeriodicCollection();
                            }
                            if (isCollecting) {
                                await stopDataCollection();
                            }
                        }}
                        disabled={!isCollecting && !isPeriodicRunning}
                        style={{ marginTop: 0 }}
                    >
                        <IonIcon icon={stopCircleOutline} style={{ marginRight: 8 }} />
                        Stop Session
                    </IonButton>

                    {/* Demo Mode Button - for FYP presentations */}
                    <IonButton
                        expand="block"
                        className="control-btn"
                        color={isDemoRunning ? 'warning' : 'tertiary'}
                        onClick={toggleDemoMode}
                        disabled={!deviceId}
                        style={{ marginTop: 8 }}
                    >
                        <IonIcon icon={flashOutline} style={{ marginRight: 8 }} />
                        {isDemoRunning ? '🎬 Stop Demo Mode' : '🎬 Demo Mode'}
                    </IonButton>
                </div>

                {/* FEED SECTION */}
                <div className="feed-header">Recent Data Points</div>

                <div className="data-feed-list">
                    {data.slice(-5).reverse().map((entry: any, i) => (
                        <IonCard key={i} style={{ margin: '8px 0', background: 'rgba(30,30,30,0.9)', borderRadius: 12 }}>
                            {/* --- MODE A: WELLNESS COMPANION --- */}
                            {!isScientific && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                                        <div style={{ fontSize: 28, color: '#ff4b4b' }}>
                                            <IonIcon icon={heart} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: '#888' }}>Heart Rate</div>
                                            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>
                                                {entry.hr || '--'} <span style={{ fontSize: 14, color: '#555' }}>BPM</span>
                                            </div>
                                        </div>
                                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                            <IonText color="medium" style={{ fontSize: 12 }}>
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </IonText>
                                        </div>
                                    </div>

                                    <IonGrid style={{ padding: '8px 16px 12px' }}>
                                        <IonRow>
                                            <IonCol size="6">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <IonIcon icon={pulse} style={{ color: '#50c8ff', fontSize: 16 }} />
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#888' }}>SpO2</div>
                                                        <div style={{ fontWeight: 600, color: '#fff' }}>{entry.spo2 ? Math.round(entry.spo2) : '--'}</div>
                                                    </div>
                                                </div>
                                            </IonCol>
                                            <IonCol size="6">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <IonIcon icon={speedometer} style={{ color: '#888', fontSize: 16 }} />
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#888' }}>Motion</div>
                                                        <div style={{ fontWeight: 600, color: '#fff' }}>
                                                            {(Math.abs(entry.accX || 0) > 1.2 || Math.abs(entry.accY || 0) > 1.2) ? 'Active' : 'Steady'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </IonCol>
                                        </IonRow>
                                    </IonGrid>
                                </>
                            )}

                            {/* --- MODE B: SCIENTIFIC INSTRUMENT --- */}
                            {isScientific && (
                                <div style={{ padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div>
                                            <IonIcon icon={analytics} style={{ marginRight: 8, color: '#00d9ff' }} />
                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff' }}>DATA_POINT</span>
                                        </div>
                                        <span style={{ fontFamily: 'monospace', color: '#666', fontSize: 12 }}>
                                            {new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0]}
                                        </span>
                                    </div>

                                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                                            <span style={{ color: '#888' }}>HR_CALC</span>
                                            <span style={{ color: '#0f0' }}>{entry.hr || 'NULL'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                                            <span style={{ color: '#888' }}>PPG_RAW</span>
                                            <span style={{ color: '#0f0' }}>{entry.ppg || 'NULL'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                                            <span style={{ color: '#888' }}>OXYGEN</span>
                                            <span style={{ color: '#0f0' }}>{entry.spo2 ? Math.round(entry.spo2) : 'NULL'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                                            <span style={{ color: '#888' }}>ACCEL_X</span>
                                            <span style={{ color: '#0f0' }}>{entry.accX?.toFixed(4) || '0.0000'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                                            <span style={{ color: '#888' }}>ACCEL_Y</span>
                                            <span style={{ color: '#0f0' }}>{entry.accY?.toFixed(4) || '0.0000'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                            <span style={{ color: '#888' }}>ACCEL_Z</span>
                                            <span style={{ color: '#0f0' }}>{entry.accZ?.toFixed(4) || '0.0000'}</span>
                                        </div>
                                    </div>

                                    <div style={{ background: '#000', padding: 10, marginTop: 8, borderRadius: 4, overflowX: 'auto' }}>
                                        <pre style={{ color: '#00ff00', fontSize: 9, margin: 0 }}>
                                            {JSON.stringify(entry, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </IonCard>
                    ))}

                    {data.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#555', padding: 20 }}>
                            <p style={{ fontSize: 13 }}>No data collected yet</p>
                        </div>
                    )}
                </div>

            </IonContent>
        </IonPage>
    );
};

export default SleepPage;
