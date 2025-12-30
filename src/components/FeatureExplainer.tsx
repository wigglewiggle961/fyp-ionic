// Feature Importance Display with Info Icons
import React, { useState } from 'react';
import { IonIcon, IonModal, IonButton, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons } from '@ionic/react';
import { informationCircleOutline, closeOutline } from 'ionicons/icons';

interface Feature {
    key: string;
    importance: number;
    name: string;
    desc: string;
}

interface FeatureExplainerProps {
    features: Feature[];
    title?: string;
}

const FeatureExplainer: React.FC<FeatureExplainerProps> = ({ features, title = "Why This Prediction?" }) => {
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [showModal, setShowModal] = useState(false);

    if (!features || features.length === 0) return null;

    const maxImportance = Math.max(...features.map(f => f.importance));

    return (
        <div style={{ marginTop: 16 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 12
            }}>
                <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff'
                }}>{title}</span>
                <IonIcon
                    icon={informationCircleOutline}
                    style={{ marginLeft: 8, color: '#1DB954', cursor: 'pointer' }}
                    onClick={() => {
                        setSelectedFeature(null);
                        setShowModal(true);
                    }}
                />
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 12,
                padding: 12
            }}>
                {features.slice(0, 5).map((f, i) => (
                    <div
                        key={f.key}
                        style={{
                            marginBottom: i < 4 ? 10 : 0,
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            setSelectedFeature(f);
                            setShowModal(true);
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 4
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#ccc' }}>{f.name}</span>
                                <IonIcon
                                    icon={informationCircleOutline}
                                    style={{ fontSize: 12, marginLeft: 4, color: '#666' }}
                                />
                            </div>
                            <span style={{ fontSize: 11, color: '#888' }}>
                                {Math.round(f.importance * 100)}%
                            </span>
                        </div>
                        <div style={{
                            height: 6,
                            background: '#333',
                            borderRadius: 3,
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${(f.importance / maxImportance) * 100}%`,
                                background: `linear-gradient(90deg, #1DB954 0%, #22c55e 100%)`,
                                borderRadius: 3,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Info Modal */}
            <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
                <IonHeader>
                    <IonToolbar style={{ '--background': '#1a1a1a' }}>
                        <IonTitle style={{ color: '#fff' }}>
                            {selectedFeature ? selectedFeature.name : 'Feature Explanations'}
                        </IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={() => setShowModal(false)}>
                                <IonIcon icon={closeOutline} style={{ color: '#fff' }} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding" style={{ '--background': '#121212' }}>
                    {selectedFeature ? (
                        <div>
                            <div style={{
                                background: '#1a1a1a',
                                borderRadius: 16,
                                padding: 20,
                                marginBottom: 20
                            }}>
                                <div style={{
                                    fontSize: 24,
                                    fontWeight: 'bold',
                                    color: '#1DB954',
                                    marginBottom: 8
                                }}>
                                    {Math.round(selectedFeature.importance * 100)}%
                                </div>
                                <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                                    Model Importance
                                </div>
                                <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>
                                    {selectedFeature.desc}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: '#888', marginBottom: 20 }}>
                                These features are what the AI model uses to determine your sleep stage.
                                Higher importance means that feature has more influence on the prediction.
                            </p>
                            {features.map(f => (
                                <div
                                    key={f.key}
                                    style={{
                                        background: '#1a1a1a',
                                        borderRadius: 12,
                                        padding: 16,
                                        marginBottom: 12
                                    }}
                                    onClick={() => setSelectedFeature(f)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 600, color: '#fff' }}>{f.name}</span>
                                        <span style={{ color: '#1DB954' }}>
                                            {Math.round(f.importance * 100)}%
                                        </span>
                                    </div>
                                    <p style={{
                                        color: '#888',
                                        fontSize: 13,
                                        marginTop: 8,
                                        marginBottom: 0
                                    }}>
                                        {f.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </IonContent>
            </IonModal>
        </div>
    );
};

export default FeatureExplainer;
