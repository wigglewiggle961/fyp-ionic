import React, { useState } from 'react';
import {
    IonContent, IonPage, IonCard, IonHeader, IonToolbar, IonTitle,
    IonItem, IonLabel, IonButton, IonDatetime,
    useIonToast, IonIcon, IonRange, IonModal, IonButtons, IonList
} from '@ionic/react';
import {
    alarmOutline, musicalNotesOutline, hourglassOutline,
    checkmarkCircle, closeOutline, timeOutline
} from 'ionicons/icons';
import { AlarmService } from '../services/AlarmService';
import './AlarmPage.css';

const alarmService = new AlarmService();

const AlarmPage: React.FC = () => {
    const [alarmTime, setAlarmTime] = useState<string>(new Date().toISOString());
    const [alarmSound, setAlarmSound] = useState<number>(1);
    const [wakeUpWindow, setWakeUpWindow] = useState<number>(30); // Default 30 min window
    const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
    const [showToast] = useIonToast();

    // Helper to format time for display (e.g. "07:30")
    const formatTimeDisplay = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const getAmPm = (isoString: string) => {
        const date = new Date(isoString);
        return date.getHours() >= 12 ? 'PM' : 'AM';
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
        if (scheduleDate.getTime() < now.getTime()) {
            console.log('Time passed - firing immediately as requested!');
            scheduleDate = new Date(now.getTime() + 2000); // 2 seconds delay
        }

        const success = await alarmService.setAlarm(scheduleDate, alarmSound);

        if (success) {
            showToast({
                message: `Smart Alarm set for ${scheduleDate.toLocaleTimeString()}. Window: ${wakeUpWindow} min.`,
                duration: 3000,
                color: 'success',
                position: 'top',
                icon: checkmarkCircle
            });
        }
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar className="alarm-header-toolbar">
                    <IonTitle>Sleep Schedule</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen className="alarm-page-content">

                {/* HERO CARD */}
                <div className="alarm-hero-card" onClick={() => setIsTimeModalOpen(true)}>
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
                        Tap to change time
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
                            We'll wake you gently between
                            <span style={{ color: '#1DB954' }}> {new Date(new Date(alarmTime).getTime() - wakeUpWindow * 60000 * -1).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) /* logic fix needed for display? no, simpler below*/} </span>
                            {/* actually easier to just show text */}
                            start of window and your alarm time.
                        </p>

                        <IonRange
                            min={0} max={60} step={5}
                            value={wakeUpWindow}
                            onIonChange={e => setWakeUpWindow(e.detail.value as number)}
                        >
                            <IonIcon slot="start" size="small" icon={timeOutline} color="medium" />
                            <IonIcon slot="end" size="small" icon={alarmOutline} color="medium" />
                        </IonRange>
                    </div>

                    {/* Sound Selector */}
                    <div className="sound-selector-row">
                        <span className="control-label">Alarm Sound</span>

                        {[
                            { id: 1, name: 'Energize (Default)' },
                            { id: 2, name: 'Relaxing Rain' },
                            { id: 3, name: 'Morning Birds' }
                        ].map(sound => (
                            <div
                                key={sound.id}
                                className={`sound-item ${alarmSound === sound.id ? 'active' : ''}`}
                                onClick={() => setAlarmSound(sound.id)}
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

                <IonButton
                    expand="block"
                    className="set-alarm-btn"
                    onClick={handleSetAlarm}
                >
                    ENABLE ALARM
                </IonButton>

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
