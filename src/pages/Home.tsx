import React from 'react';
import {
  IonContent, IonPage, IonCard, IonGrid, IonRow, IonCol,
  IonIcon, IonHeader, IonToolbar, IonTitle
} from '@ionic/react';
import { moon, batteryHalf, time, rainy } from 'ionicons/icons';

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': '#121212', '--color': '#fff', '--padding-top': 'calc(40px + var(--ion-safe-area-top))', '--min-height': 'calc(56px + 40px + var(--ion-safe-area-top))' }}>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding">
        <h1 style={{ color: '#fff', marginLeft: 10, fontWeight: 300 }}>Good Morning, <br /><span style={{ fontWeight: 700 }}>Eric</span></h1>

        {/* Main Sleep Score Card */}
        <IonCard style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #252525 100%)', padding: '24px', borderRadius: '24px', margin: '16px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px' }}>Sleep Score</div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#1DB954' }}>85</div>
              <div style={{ color: '#ccc', fontSize: '14px' }}>Optimal</div>
            </div>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: '#1DB954', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <IonIcon icon={moon} style={{ fontSize: '32px', color: '#000' }} />
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            <span className="status-badge" style={{ background: '#333', color: '#fff' }}>7h 12m Sleep</span>
            <span className="status-badge" style={{ background: '#333', color: '#fff' }}>94% Eff</span>
          </div>
        </IonCard>

        <IonGrid style={{ padding: '0 8px' }}>
          <IonRow>
            <IonCol size="6">
              <IonCard style={{ margin: 0, padding: 16, background: '#1e1e1e', borderRadius: 16, height: '100%' }}>
                <IonIcon icon={batteryHalf} style={{ color: '#50c8ff', fontSize: 24 }} />
                <div style={{ marginTop: 10, color: '#888', fontSize: 12 }}>Readiness</div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>High</div>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard style={{ margin: 0, padding: 16, background: '#1e1e1e', borderRadius: 16, height: '100%' }}>
                <IonIcon icon={rainy} style={{ color: '#fff', fontSize: 24 }} />
                <div style={{ marginTop: 10, color: '#888', fontSize: 12 }}>Weather</div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>22°C</div>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        <div style={{ padding: '20px 10px' }}>
          <h3 style={{ color: '#fff', fontSize: 18 }}>Tonight</h3>
          <IonCard style={{ margin: '10px 0', padding: 16, background: '#1e1e1e', borderRadius: 16, display: 'flex', alignItems: 'center' }}>
            <IonIcon icon={time} style={{ color: '#ffd534', fontSize: 24, marginRight: 16 }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>Bedtime Window</div>
              <div style={{ color: '#888', fontSize: 12 }}>10:45 PM - 11:30 PM</div>
            </div>
          </IonCard>
        </div>

      </IonContent>
    </IonPage>
  );
};

export default Home;