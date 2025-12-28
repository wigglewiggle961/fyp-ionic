import React, { useState } from 'react';
import {
    IonContent, IonPage, IonHeader, IonToolbar, IonTitle,
    IonIcon, IonButton,
    IonToggle, IonItem, IonLabel, IonButtons
} from '@ionic/react';
import {
    heart, bluetooth,
    playCircleOutline, stopCircleOutline, listOutline,
    waterOutline
} from 'ionicons/icons';
import './SleepPage.css';
import { useRingData } from '../services/RingDataProvider';
import HeartRateChart from '../components/HeartRateChart';

const SleepPage: React.FC = () => {
    const {
        scanAndConnect, startDataCollection, stopDataCollection,
        startPeriodicCollection, isCollecting, data,
        error, deviceId
    } = useRingData();

    const [isScientific, setIsScientific] = useState(false);

    // Get latest reading or defaults
    const latest = data.length > 0 ? data[data.length - 1] : null;
    const currentHr = latest?.hr || '--';
    const currentSpo2 = latest?.spo2 || '--';

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
                    {isCollecting && (
                        <>
                            <span style={{ margin: '0 8px', color: '#333' }}>|</span>
                            <span className="status-text" style={{ color: '#1DB954' }}>Collecting</span>
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
                        <IonIcon icon={heart} className={`heart-icon-large ${isCollecting ? 'pulse-animation' : ''}`} />
                        <div>
                            <span className="metric-value-large">{currentHr}</span>
                            <span className="metric-unit">BPM</span>
                        </div>
                    </div>

                    {/* CHART SECTION */}
                    <div style={{ height: '120px', margin: '20px -10px' }}>
                        <HeartRateChart dataPoints={data} />
                    </div>

                    <div className="secondary-metrics-row">
                        <div className="sec-metric">
                            <span className="sec-label">SpO2</span>
                            <span className="sec-value" style={{ color: '#50c8ff' }}>{currentSpo2}%</span>
                        </div>
                        <div className="sec-metric">
                            <span className="sec-label">Motion</span>
                            <span className="sec-value">{isMoving ? 'Active' : 'Resting'}</span>
                        </div>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="actions-container">
                    <IonButton
                        expand="block"
                        className={`control-btn connect-btn ${deviceId ? 'connected-state' : ''}`}
                        onClick={scanAndConnect}
                        disabled={!!deviceId}
                    >
                        {deviceId ? 'Device Linked' : 'Scan & Connect Ring'}
                    </IonButton>

                    <div className="action-btn-row" style={{ marginTop: 12 }}>
                        <IonButton
                            className="control-btn"
                            color="light"
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
                            color="dark"
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
                        onClick={stopDataCollection}
                        disabled={!isCollecting}
                        style={{ marginTop: 0 }}
                    >
                        <IonIcon icon={stopCircleOutline} style={{ marginRight: 8 }} />
                        Stop Session
                    </IonButton>
                </div>

                {/* FEED SECTION */}
                <div className="feed-header">Recent Data Points</div>

                <div className="data-feed-list">
                    {data.slice(-5).reverse().map((entry: any, i) => (
                        <div key={i} className="feed-item">
                            {!isScientific ? (
                                <>
                                    <div>
                                        <div className="feed-time">
                                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#444' }}>ID: {entry.seq || i}</div>
                                    </div>
                                    <div className="feed-values">
                                        <div className="feed-val">
                                            <IonIcon icon={heart} style={{ color: '#ff4b4b', fontSize: 12 }} />
                                            {entry.hr}
                                        </div>
                                        <div className="feed-val">
                                            <IonIcon icon={waterOutline} style={{ color: '#50c8ff', fontSize: 12 }} />
                                            {entry.spo2}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <pre style={{ fontSize: 10, color: '#0f0', margin: 0, overflow: 'hidden' }}>
                                    {JSON.stringify(entry, null, 0).substring(0, 40)}...
                                </pre>
                            )}
                        </div>
                    ))}

                    {data.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#333', padding: 20 }}>
                            <p style={{ fontSize: 13 }}>No data collected yet</p>
                        </div>
                    )}
                </div>

            </IonContent>
        </IonPage>
    );
};

export default SleepPage;
