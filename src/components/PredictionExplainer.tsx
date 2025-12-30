// Per-Prediction SHAP Explainer - Shows feature contributions for a specific epoch
import React from 'react';
import { IonIcon, IonModal, IonButton, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons } from '@ionic/react';
import { informationCircleOutline, closeOutline } from 'ionicons/icons';
import { FeatureExplanation } from '../services/SleepAPI';

interface ShapContributions {
    [key: string]: number;
}

interface PredictionExplainerProps {
    stageLabel: string;
    shapContributions?: ShapContributions | null;
    featureDict: { [key: string]: FeatureExplanation };
}

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
    movement: '#3b82f6',    // Blue
    heartrate: '#ef4444',   // Red
    hrv: '#a855f7',         // Purple
    context: '#f59e0b',     // Amber
    stage: '#22c55e',       // Green
    interaction: '#06b6d4', // Cyan
};

const PredictionExplainer: React.FC<PredictionExplainerProps> = ({
    stageLabel,
    shapContributions,
    featureDict
}) => {
    const [showModal, setShowModal] = React.useState(false);
    const [selectedFeature, setSelectedFeature] = React.useState<string | null>(null);
    const [showAllFeatures, setShowAllFeatures] = React.useState(false);

    if (!shapContributions || Object.keys(shapContributions).length === 0) {
        return null;
    }

    // Sort contributions by value (highest first)
    const sortedContribs = Object.entries(shapContributions)
        .sort(([, a], [, b]) => b - a);

    const maxValue = sortedContribs[0]?.[1] || 1;

    const handleFeatureClick = (key: string) => {
        setSelectedFeature(key);
        setShowModal(true);
    };

    const selected = selectedFeature ? featureDict[selectedFeature] : null;

    // Build a fallback feature for unknown keys
    const getFeatureInfo = (key: string) => {
        if (featureDict[key]) return featureDict[key];
        // Fallback: make the key readable
        return {
            key,
            name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            desc: `This feature (${key}) contributes to the sleep stage prediction.`,
            category: 'unknown'
        };
    };

    return (
        <div style={{ marginTop: 12 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 8
            }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                    Why "{stageLabel}"?
                </span>
                <IonIcon
                    icon={informationCircleOutline}
                    style={{ marginLeft: 6, color: '#1DB954', fontSize: 14, cursor: 'pointer' }}
                    onClick={() => setShowAllFeatures(true)}
                />
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 10,
                padding: 10
            }}>
                {sortedContribs.map(([key, value]) => {
                    const feature = featureDict[key];
                    const name = feature?.name || key;
                    const category = feature?.category || 'unknown';
                    const color = CATEGORY_COLORS[category] || '#666';

                    return (
                        <div
                            key={key}
                            onClick={() => handleFeatureClick(key)}
                            style={{
                                marginBottom: 6,
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 3
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{
                                        width: 6, height: 6, borderRadius: 3,
                                        backgroundColor: color
                                    }} />
                                    <span style={{ fontSize: 11, color: '#ccc' }}>{name}</span>
                                </div>
                                <IonIcon
                                    icon={informationCircleOutline}
                                    style={{ fontSize: 12, color: '#555' }}
                                />
                            </div>
                            <div style={{
                                height: 4,
                                background: '#2a2a2a',
                                borderRadius: 2,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${(value / maxValue) * 100}%`,
                                    background: color,
                                    borderRadius: 2,
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Feature Detail Modal */}
            <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
                <IonHeader>
                    <IonToolbar style={{ '--background': '#1a1a1a' }}>
                        <IonTitle style={{ color: '#fff', fontSize: 16 }}>
                            {selected?.name || 'Feature Info'}
                        </IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={() => setShowModal(false)}>
                                <IonIcon icon={closeOutline} style={{ color: '#fff' }} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding" style={{ '--background': '#121212' }}>
                    {selected && (
                        <div style={{
                            background: '#1a1a1a',
                            borderRadius: 16,
                            padding: 20
                        }}>
                            <div style={{
                                display: 'inline-block',
                                background: CATEGORY_COLORS[selected.category] || '#666',
                                color: '#000',
                                fontSize: 10,
                                fontWeight: 'bold',
                                padding: '4px 8px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                marginBottom: 12
                            }}>
                                {selected.category}
                            </div>

                            <h2 style={{ color: '#fff', margin: '0 0 12px' }}>
                                {selected.name}
                            </h2>

                            <p style={{
                                color: '#ccc',
                                lineHeight: 1.6,
                                margin: 0,
                                fontSize: 15
                            }}>
                                {selected.desc}
                            </p>

                            {selectedFeature && shapContributions[selectedFeature] !== undefined && (
                                <div style={{
                                    marginTop: 20,
                                    padding: 16,
                                    background: '#252525',
                                    borderRadius: 12
                                }}>
                                    <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
                                        Contribution to this prediction
                                    </div>
                                    <div style={{
                                        fontSize: 24,
                                        fontWeight: 'bold',
                                        color: CATEGORY_COLORS[selected.category] || '#1DB954'
                                    }}>
                                        {shapContributions[selectedFeature].toFixed(4)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </IonContent>
            </IonModal>

            {/* All Features Modal */}
            <IonModal isOpen={showAllFeatures} onDidDismiss={() => setShowAllFeatures(false)}>
                <IonHeader>
                    <IonToolbar style={{ '--background': '#1a1a1a' }}>
                        <IonTitle style={{ color: '#fff' }}>All Features</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={() => setShowAllFeatures(false)}>
                                <IonIcon icon={closeOutline} style={{ color: '#fff' }} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding" style={{ '--background': '#121212' }}>
                    <div style={{ padding: '0 8px' }}>
                        <p style={{ color: '#888', marginBottom: 20 }}>
                            These are the features the AI uses to analyze your sleep stages.
                            Tap any feature to learn more.
                        </p>
                        {Object.values(featureDict).map(f => (
                            <div
                                key={f.key}
                                style={{
                                    background: '#1a1a1a',
                                    borderRadius: 12,
                                    padding: 16,
                                    marginBottom: 12
                                }}
                                onClick={() => {
                                    setShowAllFeatures(false);
                                    handleFeatureClick(f.key);
                                }}
                            >
                                <div style={{
                                    display: 'inline-block',
                                    background: CATEGORY_COLORS[f.category] || '#666',
                                    color: '#000',
                                    fontSize: 9,
                                    fontWeight: 'bold',
                                    padding: '2px 6px',
                                    borderRadius: 3,
                                    textTransform: 'uppercase',
                                    marginBottom: 6
                                }}>
                                    {f.category}
                                </div>
                                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{f.name}</div>
                                <div style={{ fontSize: 13, color: '#888' }}>{f.desc}</div>
                            </div>
                        ))}
                    </div>
                </IonContent>
            </IonModal>
        </div>
    );
};

export default PredictionExplainer;
