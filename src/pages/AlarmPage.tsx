import React, { useState, useEffect, useCallback } from 'react';
import {
    IonContent, IonPage, IonCard, IonHeader, IonToolbar, IonTitle,
    IonItem, IonLabel, IonButton, IonDatetime,
    useIonToast, IonIcon, IonRange, IonModal, IonButtons, IonList,
    IonChip, IonBadge, useIonViewWillEnter
} from '@ionic/react';
import {
    alarmOutline, musicalNotesOutline, hourglassOutline,
    checkmarkCircle, closeOutline, timeOutline,
    bluetoothOutline, warningOutline, moonOutline
} from 'ionicons/icons';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlarmService } from '../services/AlarmService';
import { useRingData } from '../services/RingDataProvider';
import './AlarmPage.css';

const alarmService = new AlarmService();

const AlarmPage: React.FC = () => {
    const [alarmTime, setAlarmTime] = useState<string>(new Date().toISOString());
    const [alarmSound, setAlarmSound] = useState<number>(1);
    const [wakeUpWindow, setWakeUpWindow] = useState<number>(30); // Default 30 min window
    const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
    const [isAlarmActive, setIsAlarmActive] = useState(false);
    const [showToast] = useIonToast();

    // Get device ID from ring data context
    const { deviceId } = useRingData();

    // Check alarm status - syncs button with actual pending notifications
    const checkAlarmStatus = useCallback(async () => {
        try {
            const pending = await LocalNotifications.getPending();
            setIsAlarmActive(pending.notifications.length > 0);
        } catch (e) {
            console.error('Failed to check pending notifications:', e);
        }
    }, []);

    // Check on mount
    useEffect(() => {
        checkAlarmStatus();
    }, [checkAlarmStatus]);

    // Check every time page becomes visible (Ionic tab switching)
    useIonViewWillEnter(() => {
        checkAlarmStatus();
    });

    // Helper to format time for display (e.g. "07:30")
    const formatTimeDisplay = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const getAmPm = (isoString: string) => {
        const date = new Date(isoString);
        return date.getHours() >= 12 ? 'PM' : 'AM';
    };

    // Calculate window start time for display
    const getWindowStartTime = () => {
        const wakeTime = new Date(alarmTime);
        const windowStart = new Date(wakeTime.getTime() - wakeUpWindow * 60 * 1000);
        return windowStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleSetAlarm = async () => {
        const hasPermission = await alarmService.requestPermissions();
        if (!hasPermission) {
            showToast({ message: 'Permission required!', duration: 2000, color: 'warning' });
            return;
        }

        const pickerDate = new Date(alarmTime);
        let scheduleDate = new Date();
        scheduleDate.setHours(pickerDate.getHours());
        scheduleDate.setMinutes(pickerDate.getMinutes());
        scheduleDate.setSeconds(0);

        const now = new Date();

        // TODO: Improve alarm time validation
        // Current logic: if time passed today, schedule for tomorrow.
        // Should also consider the wake-up window:
        // - If alarm is 7:00 AM with 30 min window, the window starts at 6:30 AM
        // - If current time is 6:45 AM, we're INSIDE the window - should we:
        //   a) Reject the alarm entirely?
        //   b) Start monitoring immediately for remaining window time?
        //   c) Schedule for tomorrow?
        // Also: don't allow setting alarm if the WINDOW START time has already passed today.

        // If time already passed today, schedule for tomorrow
        if (scheduleDate.getTime() < now.getTime()) {
            scheduleDate.setDate(scheduleDate.getDate() + 1);
        }

        // Use smart alarm if device is connected and window > 0
        if (deviceId && wakeUpWindow > 0) {
            const success = await alarmService.setSmartAlarm(
                scheduleDate,
                wakeUpWindow,
                alarmSound,
                deviceId,
                (stageLabel) => {
                    // Callback when smart wake triggers
                    showToast({
                        message: `☀️ Waking you during ${stageLabel} sleep!`,
                        duration: 5000,
                        color: 'success',
                        position: 'top'
                    });
                }
            );

            if (success) {
                setIsAlarmActive(true);
                showToast({
                    message: `Smart Alarm set! We'll wake you between ${getWindowStartTime()} - ${scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} during Light/REM sleep.`,
                    duration: 4000,
                    color: 'success',
                    position: 'top',
                    icon: checkmarkCircle
                });
            }
        } else {
            // Fallback to regular alarm if no device or no window
            const success = await alarmService.setAlarm(scheduleDate, alarmSound);

            if (success) {
                setIsAlarmActive(true);
                const message = !deviceId
                    ? `Alarm set for ${scheduleDate.toLocaleTimeString()}. Connect ring for smart wake!`
                    : `Alarm set for ${scheduleDate.toLocaleTimeString()}.`;
                showToast({
                    message,
                    duration: 3000,
                    color: 'success',
                    position: 'top',
                    icon: checkmarkCircle
                });
            }
        }
    };

    const handleCancelAlarm = async () => {
        await alarmService.cancelAll();
        setIsAlarmActive(false);
        showToast({
            message: 'Alarm cancelled',
            duration: 2000,
            color: 'medium',
            position: 'top'
        });
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar className="alarm-header-toolbar">
                    <IonTitle>Sleep Schedule</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen className="alarm-page-content">

                {/* Connection Status */}
                <div style={{ padding: '10px 24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {deviceId ? (
                        <IonChip color="success" style={{ '--background': 'rgba(29, 185, 84, 0.15)' }}>
                            <IonIcon icon={bluetoothOutline} />
                            <IonLabel>Ring Connected</IonLabel>
                        </IonChip>
                    ) : (
                        <IonChip color="warning" style={{ '--background': 'rgba(255, 196, 9, 0.15)' }}>
                            <IonIcon icon={warningOutline} />
                            <IonLabel>Ring Not Connected</IonLabel>
                        </IonChip>
                    )}
                    {isAlarmActive && (
                        <IonChip color="primary" style={{ '--background': 'rgba(88, 166, 255, 0.15)' }}>
                            <IonIcon icon={moonOutline} />
                            <IonLabel>Alarm Active</IonLabel>
                        </IonChip>
                    )}
                </div>

                {/* HERO CARD */}
                <div
                    className="alarm-hero-card"
                    onClick={() => !isAlarmActive && setIsTimeModalOpen(true)}
                    style={{ opacity: isAlarmActive ? 0.7 : 1, cursor: isAlarmActive ? 'not-allowed' : 'pointer' }}
                >
                    <div className="alarm-title">Wake Up Time</div>

                    <div className="alarm-time-display">
                        {formatTimeDisplay(alarmTime)}
                        <span className="alarm-time-ampm">{getAmPm(alarmTime)}</span>
                    </div>

                    <div className="window-chip">
                        <IonIcon icon={hourglassOutline} style={{ marginRight: 6 }} />
                        <span>{wakeUpWindow} min window</span>
                    </div>

                    <div style={{ marginTop: 15, fontSize: '12px', color: '#666' }}>
                        {isAlarmActive ? 'Cancel alarm to change time' : 'Tap to change time'}
                    </div>
                </div>

                {/* CONTROLS SECTION */}
                <div style={{ padding: '0 24px' }}>

                    {/* Window Slider */}
                    <div className="alarm-controls">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span className="control-label" style={{ marginBottom: 0 }}>Smart Wake-Up Window</span>
                            <span style={{ color: '#fff', fontWeight: 'bold' }}>{wakeUpWindow} min</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: 20, lineHeight: '1.4' }}>
                            {wakeUpWindow > 0 ? (
                                <>
                                    We'll wake you gently between
                                    <span style={{ color: '#1DB954' }}> {getWindowStartTime()} </span>
                                    and your alarm time when you're in Light or REM sleep.
                                </>
                            ) : (
                                <>
                                    Smart wake disabled. Alarm will fire at the exact time.
                                </>
                            )}
                        </p>

                        <IonRange
                            min={0} max={60} step={5}
                            value={wakeUpWindow}
                            onIonChange={e => setWakeUpWindow(e.detail.value as number)}
                            disabled={isAlarmActive}
                        >
                            <IonIcon slot="start" size="small" icon={timeOutline} color="medium" />
                            <IonIcon slot="end" size="small" icon={alarmOutline} color="medium" />
                        </IonRange>
                    </div>

                    {/* Sound Selector */}
                    <div className="sound-selector-row">
                        <span className="control-label">Alarm Sound</span>

                        {[
                            { id: 1, name: 'Snowy (Default)' },
                            { id: 2, name: 'Energize' },
                            { id: 3, name: 'Morning Birds' }
                        ].map(sound => (
                            <div
                                key={sound.id}
                                className={`sound-item ${alarmSound === sound.id ? 'active' : ''}`}
                                onClick={() => !isAlarmActive && setAlarmSound(sound.id)}
                                style={{ opacity: isAlarmActive ? 0.5 : 1 }}
                            >
                                <IonIcon icon={musicalNotesOutline} style={{ color: alarmSound === sound.id ? '#1DB954' : '#666', marginRight: 12 }} />
                                <span style={{ flex: 1, color: alarmSound === sound.id ? '#fff' : '#aaa', fontWeight: alarmSound === sound.id ? 500 : 400 }}>
                                    {sound.name}
                                </span>
                                {alarmSound === sound.id && <IonIcon icon={checkmarkCircle} color="success" />}
                            </div>
                        ))}
                    </div>

                </div>

                {isAlarmActive ? (
                    <IonButton
                        expand="block"
                        className="set-alarm-btn"
                        color="danger"
                        onClick={handleCancelAlarm}
                    >
                        CANCEL ALARM
                    </IonButton>
                ) : (
                    <IonButton
                        expand="block"
                        className="set-alarm-btn"
                        onClick={handleSetAlarm}
                    >
                        {deviceId && wakeUpWindow > 0 ? 'ENABLE SMART ALARM' : 'ENABLE ALARM'}
                    </IonButton>
                )}

                {/* TIME PICKER MODAL */}
                <IonModal isOpen={isTimeModalOpen} onDidDismiss={() => setIsTimeModalOpen(false)} breakpoints={[0, 0.5, 0.8]} initialBreakpoint={0.5} style={{ '--border-radius': '24px' }}>
                    <IonHeader className="ion-no-border">
                        <IonToolbar style={{ '--background': '#1e1e1e', '--color': '#fff' }}>
                            <IonTitle>Set Time</IonTitle>
                            <IonButtons slot="end">
                                <IonButton onClick={() => setIsTimeModalOpen(false)}>
                                    <IonIcon icon={closeOutline} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding" style={{ '--background': '#1e1e1e' }}>
                        <IonDatetime
                            presentation="time"
                            value={alarmTime}
                            onIonChange={e => setAlarmTime(e.detail.value! as string)}
                            style={{ margin: '0 auto', background: '#1e1e1e' }}
                        />
                    </IonContent>
                </IonModal>

            </IonContent>
        </IonPage>
    );
};

export default AlarmPage;

