import React, { useState, useEffect, useMemo } from 'react';
import {
  IonContent, IonPage, IonCard, IonGrid, IonRow, IonCol,
  IonIcon, IonHeader, IonToolbar, IonTitle, IonSelect, IonSelectOption,
  IonSpinner, IonRefresher, IonRefresherContent
} from '@ionic/react';
import { moon, sparkles, analytics, trendingUp } from 'ionicons/icons';
import { useRingData } from '../services/RingDataProvider';
import { SleepAPI, Session, SessionDetail, FeatureExplanation } from '../services/SleepAPI';
import HypnogramChart from '../components/HypnogramChart';
import SleepStageDonut, { StageLabels } from '../components/SleepStageDonut';
import PredictionExplainer from '../components/PredictionExplainer';

const Home: React.FC = () => {
  const { deviceId } = useRingData();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Load sessions when device is connected
  useEffect(() => {
    if (deviceId) {
      loadSessions();
    }
  }, [deviceId]);

  // Load session detail when selection changes
  useEffect(() => {
    if (deviceId && selectedSessionId) {
      loadSessionDetail(selectedSessionId);
    }
  }, [selectedSessionId]);

  const loadSessions = async () => {
    if (!deviceId) return;
    setLoading(true);
    const data = await SleepAPI.getSessions(deviceId);
    setSessions(data);
    if (data.length > 0 && !selectedSessionId) {
      setSelectedSessionId(data[0].session_id);
    }
    setLoading(false);
  };

  const loadSessionDetail = async (sessionId: string) => {
    if (!deviceId) return;
    setLoading(true);
    const detail = await SleepAPI.getSessionDetail(deviceId, sessionId);
    setSessionDetail(detail);
    setLoading(false);
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadSessions();
    if (selectedSessionId) {
      await loadSessionDetail(selectedSessionId);
    }
    event.detail.complete();
  };

  const formatSessionLabel = (session: Session) => {
    const start = new Date(session.start_time);
    return start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const summary = sessionDetail?.summary;
  // Sleep Efficiency coloring: >90 excellent, >80 good, <80 needs work
  const efficiency = summary?.sleep_efficiency || 0;
  const scoreColor = efficiency >= 90 ? '#1DB954' : efficiency >= 85 ? '#ffc107' : '#ff6b6b';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{
          '--background': '#121212',
          '--color': '#fff',
          '--padding-top': 'calc(40px + var(--ion-safe-area-top))',
          '--min-height': 'calc(56px + 40px + var(--ion-safe-area-top))'
        }}>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': '#121212' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          {/* Session Selector */}
          {sessions.length > 0 && (
            <IonCard style={{
              background: '#1a1a1a',
              borderRadius: 12,
              margin: '0 0 16px',
              padding: '8px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <IonIcon icon={moon} style={{ color: '#1DB954', fontSize: 20 }} />
                <IonSelect
                  value={selectedSessionId}
                  onIonChange={e => setSelectedSessionId(e.detail.value)}
                  interface="action-sheet"
                  style={{ flex: 1, color: '#fff' }}
                  placeholder="Select Session"
                >
                  {sessions.map(s => (
                    <IonSelectOption key={s.session_id} value={s.session_id}>
                      {formatSessionLabel(s)} ({s.duration_hours}h)
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>
            </IonCard>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <IonSpinner color="primary" />
            </div>
          )}

          {!loading && !deviceId && (
            <IonCard style={{
              background: 'linear-gradient(135deg, #1e1e1e 0%, #252525 100%)',
              padding: 24,
              borderRadius: 24,
              textAlign: 'center'
            }}>
              <IonIcon icon={moon} style={{ fontSize: 48, color: '#1DB954', marginBottom: 16 }} />
              <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Connect Your Ring</h2>
              <p style={{ color: '#888', margin: 0 }}>
                Go to the Recovery tab to connect your ring and start tracking sleep.
              </p>
            </IonCard>
          )}

          {!loading && sessionDetail && summary && (
            <>
              {/* Sleep Score Card */}
              <IonCard style={{
                background: 'linear-gradient(135deg, #1e1e1e 0%, #252525 100%)',
                padding: 24,
                borderRadius: 24,
                margin: '0 0 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{
                      color: '#888',
                      textTransform: 'uppercase',
                      fontSize: 12,
                      letterSpacing: '1px'
                    }}>Sleep Efficiency</div>
                    <div style={{ fontSize: 56, fontWeight: 'bold', color: scoreColor }}>
                      {summary.sleep_efficiency}%
                    </div>
                    <div style={{ color: '#ccc', fontSize: 14 }}>
                      {summary.sleep_efficiency >= 90 ? 'High' : summary.sleep_efficiency >= 85 ? 'Normal' : 'Low'}
                    </div>
                  </div>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    background: scoreColor,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    {/* Pie chart icon represents efficiency better */}
                    <IonIcon icon={analytics} style={{ fontSize: 32, color: '#000' }} />
                  </div>
                </div>

                <div style={{
                  marginTop: 20,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    background: '#333',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: 16,
                    fontSize: 13
                  }}>
                    {Math.floor(summary.total_duration_min / 60)}h {Math.round(summary.total_duration_min % 60)}m Total
                  </span>
                  <span style={{
                    background: '#333',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: 16,
                    fontSize: 13
                  }}>
                    {Math.floor((summary.rem_min + summary.deep_min) / 60)}h {(summary.rem_min + summary.deep_min) % 60}m Restorative
                  </span>
                </div>
              </IonCard>

              {/* Sleep Stage Breakdown */}
              <IonCard style={{
                background: '#1a1a1a',
                padding: 20,
                borderRadius: 20,
                margin: '0 0 16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 16
                }}>
                  <IonIcon icon={analytics} style={{ color: '#1DB954', marginRight: 8 }} />
                  <span style={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14
                  }}>Sleep Stages</span>
                </div>

                <SleepStageDonut
                  wake={summary.wake_min}
                  rem={summary.rem_min}
                  light={summary.light_min}
                  deep={summary.deep_min}
                />
                <StageLabels
                  wake={summary.wake_min}
                  rem={summary.rem_min}
                  light={summary.light_min}
                  deep={summary.deep_min}
                />
                <div style={{
                  marginTop: 12,
                  fontSize: 10,
                  color: '#555',
                  textAlign: 'center',
                  fontStyle: 'italic'
                }}>
                  Recorded time from {summary.prediction_count} data points
                </div>
              </IonCard>

              {/* Hypnogram */}
              <IonCard style={{
                background: '#1a1a1a',
                padding: 20,
                borderRadius: 20,
                margin: '0 0 16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 16
                }}>
                  <IonIcon icon={trendingUp} style={{ color: '#1DB954', marginRight: 8 }} />
                  <span style={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14
                  }}>Sleep Timeline</span>
                </div>

                <HypnogramChart predictions={sessionDetail.predictions} />
              </IonCard>

              {/* Feature Explainability - uses aggregated SHAP from all predictions */}
              {(() => {
                // Aggregate SHAP contributions from all predictions
                const aggregatedShap: Record<string, number> = {};
                let shapCount = 0;
                sessionDetail.predictions.forEach((p, idx) => {
                  let contributions = p.shap_contributions;

                  // Handle case where it arrives as a string (JSON)
                  if (typeof contributions === 'string') {
                    try {
                      contributions = JSON.parse(contributions);
                    } catch (e) {
                      console.error('Failed to parse SHAP JSON:', e);
                      contributions = {};
                    }
                  }

                  if (contributions && typeof contributions === 'object') {
                    shapCount++;
                    Object.entries(contributions).forEach(([key, val]) => {
                      // Ensure val is a number
                      const numVal = typeof val === 'number' ? val : parseFloat(val as string);
                      if (!isNaN(numVal)) {
                        aggregatedShap[key] = (aggregatedShap[key] || 0) + numVal;
                      }
                    });
                  }
                });
                // Average the values
                if (shapCount > 0) {
                  Object.keys(aggregatedShap).forEach(k => {
                    aggregatedShap[k] = aggregatedShap[k] / shapCount;
                  });
                }

                // Build feature dictionary from session data
                const featureDict: Record<string, any> = {};
                sessionDetail.feature_explanations?.forEach(f => {
                  featureDict[f.key] = f;
                });

                // Sort and take top 5
                const top5 = Object.entries(aggregatedShap)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

                return Object.keys(top5).length > 0 ? (
                  <IonCard style={{
                    background: '#1a1a1a',
                    padding: 20,
                    borderRadius: 20,
                    margin: '0 0 16px'
                  }}>
                    <PredictionExplainer
                      stageLabel="Session Analysis"
                      shapContributions={top5}
                      featureDict={featureDict}
                    />
                  </IonCard>
                ) : null;
              })()}

              {/* Stats Grid */}
              <IonGrid style={{ padding: 0, margin: '0 0 16px' }}>
                <IonRow>
                  <IonCol size="6">
                    <IonCard style={{
                      margin: 0,
                      padding: 16,
                      background: '#1a1a1a',
                      borderRadius: 16
                    }}>
                      <div style={{
                        color: '#22c55e',
                        fontSize: 24,
                        fontWeight: 'bold'
                      }}>
                        {Math.round(summary.deep_min)}m
                      </div>
                      <div style={{ color: '#888', fontSize: 12 }}>Deep Sleep</div>
                    </IonCard>
                  </IonCol>
                  <IonCol size="6">
                    <IonCard style={{
                      margin: 0,
                      padding: 16,
                      background: '#1a1a1a',
                      borderRadius: 16
                    }}>
                      <div style={{
                        color: '#a855f7',
                        fontSize: 24,
                        fontWeight: 'bold'
                      }}>
                        {Math.round(summary.rem_min)}m
                      </div>
                      <div style={{ color: '#888', fontSize: 12 }}>REM Sleep</div>
                    </IonCard>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </>
          )}

          {!loading && deviceId && sessions.length === 0 && (
            <IonCard style={{
              background: '#1a1a1a',
              padding: 24,
              borderRadius: 20,
              textAlign: 'center'
            }}>
              <IonIcon icon={moon} style={{ fontSize: 48, color: '#666', marginBottom: 16 }} />
              <h3 style={{ color: '#fff', margin: '0 0 8px' }}>No Sleep Data Yet</h3>
              <p style={{ color: '#888', margin: 0, fontSize: 14 }}>
                Start monitoring your sleep from the Recovery tab to see insights here.
              </p>
            </IonCard>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;