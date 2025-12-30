import { useState, useCallback, useEffect, useRef } from 'react';
import { BluetoothLe, BleClient } from '@capacitor-community/bluetooth-le';
import { API_BASE } from '../config/api';
import Papa from 'papaparse';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import {
  ForegroundService,
  ServiceType,
  Importance
} from '@capawesome-team/capacitor-android-foreground-service';

// RXTX Service (used for commands)
const RXTX_SERVICE_UUID = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e';
const RXTX_WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const RXTX_NOTIFY_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// MAIN Service (also receives notifications)
const MAIN_SERVICE_UUID = 'de5bf728-d711-4e47-af26-65e3012a5dc7';
const MAIN_NOTIFY_UUID = 'de5bf729-d711-4e47-af26-65e3012a5dc7';

const MERGE_WINDOW_MS = 150;

interface RingRecord {
  timestamp: number;
  label: string;
  payload: string; // Combined hex payload
  // Sensor Data
  accX: number | null;
  accY: number | null;
  accZ: number | null;
  ppg: number | null;
  ppg_max: number | null;
  ppg_min: number | null;
  ppg_diff: number | null;
  spo2: number | null;
  spo2_max: number | null;
  spo2_min: number | null;
  spo2_diff: number | null;
  hr: number | null;  // Calculated heart rate from PPG
  meta: any | null;
}

const isLikelyHexString = (s: string) => /^[0-9a-fA-F]+$/.test(s) && (s.length % 2 === 0);

const normalizeResultValueToDataView = (value: any): DataView => {
  if (typeof value !== 'string') {
    // Already ArrayBuffer / DataView / plugin-provided shape
    if ((value as any).buffer) return new DataView((value as any).buffer);
    return value as DataView;
  }

  const s = value as string;
  console.log('notification value is string; length=', s.length, 'sample=', s.slice(0, 32));

  // 1) If purely hex-looking string => parse as hex
  if (isLikelyHexString(s)) {
    const arr = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length; i += 2) {
      arr[i / 2] = parseInt(s.substr(i, 2), 16);
    }
    console.log('Parsed notification as HEX, bytes=', arr.length);
    return new DataView(arr.buffer);
  }

  // 2) Try base64 decode
  try {
    const binaryString = atob(s);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    console.log('Parsed notification as base64, bytes=', bytes.length);
    return new DataView(bytes.buffer);
  } catch (e) {
    console.warn('Base64 decode failed, falling back to hex-like cleanup:', e);
    // last-resort: clean non-hex chars and parse
    const cleaned = s.replace(/[^0-9a-fA-F]/g, '');
    const arr = new Uint8Array(Math.floor(cleaned.length / 2));
    for (let i = 0; i < arr.length * 2; i += 2) arr[i / 2] = parseInt(cleaned.substr(i, 2), 16);
    console.log('Fallback hex-parsed bytes=', arr.length);
    return new DataView(arr.buffer);
  }
};

// Command creation function (port from ring.py)
const createCommand = (hexString: string): Uint8Array => {
  const bytesArray: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytesArray.push(parseInt(hexString.substr(i, 2), 16));
  }
  // Pad to 15 bytes
  while (bytesArray.length < 15) {
    bytesArray.push(0);
  }
  // Add checksum
  const checksum = bytesArray.reduce((sum, byte) => sum + byte, 0) & 0xff;
  bytesArray.push(checksum);
  return new Uint8Array(bytesArray);
};

// Commands from ring.py
const BATTERY_CMD = createCommand('03');
const SET_UNITS_METRICS = createCommand('0a0200');
const ENABLE_RAW_SENSOR_CMD = createCommand('a104');
const DISABLE_RAW_SENSOR_CMD = createCommand('a102');

// Note: Real-time HR commands (0x69, 0x6a, 0x1e) removed - proved unreliable
// HR is now calculated by backend from PPG data

// --- Helpers for conversions and debugging ---
const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const dumpServices = async (deviceId: string) => {
  try {
    if ((BleClient as any)?.getServices) {
      const svc = await (BleClient as any).getServices(deviceId);
      console.info('BleClient.getServices result:', svc);
      return svc;
    } else if ((BluetoothLe as any)?.getServices) {
      // Some versions expose getServices on BluetoothLe
      const svc = await (BluetoothLe as any).getServices({ deviceId });
      console.info('BluetoothLe.getServices result:', svc);
      return svc;
    } else {
      console.warn('No getServices API detected in plugin; skip dump.');
      return null;
    }
  } catch (e) {
    console.error('Failed to dump services:', e);
    return null;
  }
};

const writeCommand = async (
  deviceId: string,
  service: string,
  characteristic: string,
  bytes: Uint8Array
) => {
  // Try BleClient.write (takes DataView) -> then hex string -> then base64 string
  try {
    if ((BleClient as any)?.write) {
      await (BleClient as any).write(deviceId, service, characteristic, new DataView(bytes.buffer));
      return;
    }
  } catch (e) {
    console.warn('BleClient.write failed, will fallback to plugin write:', e);
  }

  // Fallback: try hex string (this matches Android plugin hex parser)
  try {
    await BluetoothLe.write({
      deviceId,
      service,
      characteristic,
      value: bytesToHex(bytes),
    } as any);
    return;
  } catch (e) {
    console.warn('BluetoothLe.write with hex failed, will try base64 fallback:', e);
  }

  // Last resort: try base64 encoding (some platforms expect base64)
  try {
    await BluetoothLe.write({
      deviceId,
      service,
      characteristic,
      value: toBase64(bytes),
    } as any);
    return;
  } catch (e) {
    console.error('All write attempts failed:', e);
    throw e;
  }
};

const ensureForegroundServiceStarted = async (opts?: {
  id?: number;
  title?: string;
  body?: string;
  smallIcon?: string;
  notificationChannelId?: string;
}) => {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    // create notification channel (id must match update/start calls)
    await ForegroundService.createNotificationChannel({
      id: opts?.notificationChannelId ?? 'default',
      name: 'Background collection',
      description: 'Collecting BLE data in the background',
      importance: Importance.Default,
    });

    // start the foreground service with a small notification + optional serviceType
    await ForegroundService.startForegroundService({
      id: opts?.id ?? 1,
      title: opts?.title ?? 'Ring data collection',
      body: opts?.body ?? 'Collecting data in background',
      smallIcon: opts?.smallIcon ?? 'ic_stat_icon_config_sample',
      notificationChannelId: opts?.notificationChannelId ?? 'default',

      // prefer a connectedDevice type for BLE; plugin exposes ServiceType enum.
      // If your plugin version doesn't support ServiceType.ConnectedDevice,
      // remove this line or pick the closest available ServiceType.
      // serviceType: (ServiceType as any)?.ConnectedDevice ?? (ServiceType as any)?.connectedDevice,
    });
    console.info('[ForegroundService] started');
  } catch (e) {
    console.warn('[ForegroundService] failed to start', e);
  }
};

// Stop foreground service 
const ensureForegroundServiceStopped = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await ForegroundService.stopForegroundService();
    console.info('[ForegroundService] stopped');
  } catch (e) {
    console.warn('[ForegroundService] failed to stop', e);
  }
};

export const useRingDataCollector = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isPeriodicRunning, setIsPeriodicRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Batching config - smaller batches = faster HR chart updates
  const UPLOAD_BATCH_SIZE = 5;  // ~2 seconds of data at 3 samples/sec for frequent chart updates
  // API_BASE is imported from '../config/api'
  const API_TOKEN = "";
  const uploadBufferRef = useRef<any[]>([]);
  const isUploadingRef = useRef(false);

  const pendingRecordRef = useRef<RingRecord | null>(null);

  // Keep listener handles so we can remove them on stop/unmount
  const rxtxListenerRef = useRef<any>(null);
  const mainListenerRef = useRef<any>(null);

  // There seems to be multiple listener in one session
  const listenersAddedRef = useRef(false);

  const periodicTimerRef = useRef<number | null>(null); // window.setInterval id
  const periodicRunningRef = useRef(false); // is periodic scheduler active

  const collectionTimeoutRef = useRef<number | null>(null);

  // mirror React state to refs to avoid stale closures
  const isCollectingRef = useRef<boolean>(isCollecting);
  useEffect(() => { isCollectingRef.current = isCollecting; }, [isCollecting]);

  const deviceIdRef = useRef<string | null>(deviceId);
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);

  const isDeviceConnectedRef = useRef(false);

  // HR state - populated by backend calculation from PPG data
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  // HR history for charting - array of {timestamp, hr} for last N readings
  const [hrHistory, setHrHistory] = useState<Array<{ timestamp: string; hr: number }>>([]);
  // PPG history for waveform chart - array of {timestamp, ppg} for raw signal display
  const [ppgHistory, setPpgHistory] = useState<Array<{ timestamp: number; ppg: number }>>([]);


  const initialize = useCallback(async () => {
    try {
      await BluetoothLe.initialize({ androidNeverForLocation: true });
      console.log('BluetoothLe initialized');
    } catch (err) {
      setError(`Initialization error: ${String(err)}`);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const scanAndConnect = useCallback(async () => {
    try {
      console.info('Starting manual scan...');
      setError(null);

      const isEnabled = await BluetoothLe.isEnabled();
      console.info('Bluetooth enabled:', isEnabled);
      if (!isEnabled) {
        await BluetoothLe.enable();
      }

      const scanResults: any[] = [];
      await BluetoothLe.addListener('onScanResult', (result: any) => {
        console.info('Found device:', result.device);
        scanResults.push(result.device);
      });

      await BluetoothLe.requestLEScan({ allowDuplicates: false, scanMode: 2 });
      console.info('Scanning for 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await BluetoothLe.stopLEScan();
      console.info('Scan stopped. Found devices:', scanResults);

      const ring = scanResults.find((d) => d.name?.includes('R06'));
      if (!ring) throw new Error(`No R06 ring found. Found ${scanResults.length} devices total`);

      console.info('Connecting to:', ring.name, ring.deviceId);
      // Make sure scanning fully stopped before connecting
      try { await BluetoothLe.stopLEScan(); } catch (e) { /* ignore if already stopped */ }
      await new Promise(resolve => setTimeout(resolve, 200)); // short pause

      // Attempt connect (increase timeout here)
      await BluetoothLe.connect({
        deviceId: ring.deviceId,
        timeout: 20000, // 20s
      });

      BluetoothLe.addListener('onDisconnect', (info: any) => {
        if (info?.deviceId === ring.deviceId) {
          console.info('Device disconnected:', info.deviceId);
          isDeviceConnectedRef.current = false;
          listenersAddedRef.current = false;
          setIsCollecting(false);
          setDeviceId(null);
        }
      });

      isDeviceConnectedRef.current = true;
      // only now mark device as connected in state
      setDeviceId(ring.deviceId);
      console.info('Connected successfully!');
    } catch (err: any) {
      const errorMsg = `Error: ${err?.message || String(err)}`;
      setError(errorMsg);
      console.error('Full error:', err);
    }
  }, []);

  const sendBatchToServer = async (deviceIdForBatch: string | null, labelForBatch: string | null, records: any[]) => {
    if (!records || records.length === 0) return true;
    const payload = {
      device_id: deviceIdForBatch ?? deviceId ?? 'unknown',
      records: records.map(r => ({
        timestamp: new Date(r.timestamp).toISOString(),
        label: r.label,
        payload: r.payload,
        accX: r.accX ?? null,
        accY: r.accY ?? null,
        accZ: r.accZ ?? null,
        ppg: r.ppg ?? null,
        ppg_max: r.ppg_max ?? null,
        ppg_min: r.ppg_min ?? null,
        ppg_diff: r.ppg_diff,
        spo2: r.spo2 ?? null,
        spo2_max: r.spo2_max ?? null,
        spo2_min: r.spo2_min ?? null,
        spo2_diff: r.spo2_diff ?? null,
        meta: r.meta ?? null
      }))
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '<no body>');
        console.warn('Batch upload server error', res.status, txt);
        return false;
      }

      // Read HR from backend response
      const responseData = await res.json();
      if (responseData.hr && responseData.hr > 0) {
        console.log('[HR] Backend calculated HR:', responseData.hr.toFixed(1), 'BPM');
        const roundedHR = Math.round(responseData.hr);
        setCurrentHR(roundedHR);

        // Apply HR retroactively to recent data entries (so cards show BPM)
        setData(prev => {
          const updated = [...prev];
          // Update last N entries that don't have HR with the calculated value
          const entriesToUpdate = Math.min(records.length, updated.length);
          for (let i = 0; i < entriesToUpdate; i++) {
            const idx = updated.length - 1 - i;
            if (idx >= 0 && !updated[idx].hr) {
              updated[idx] = { ...updated[idx], hr: roundedHR };
            }
          }
          return updated;
        });

        // Add to HR history for chart
        setHrHistory(prev => {
          const newPoint = { timestamp: new Date().toISOString(), hr: roundedHR };
          const updated = [...prev, newPoint];
          console.log('[HR Chart] Added point, total:', updated.length, 'Latest:', roundedHR);
          // Keep last 60 points
          if (updated.length > 60) return updated.slice(-60);
          return updated;
        });
      } else {
        console.log('[HR] Backend returned HR:', responseData.hr, '(skipped)');
      }

      console.log('Batch uploaded:', records.length);
      return true;
    } catch (e) {
      console.warn("Batch upload failed:", e);
      return false;
    }
  }

  const enqueueRecord = (entry: any) => {
    uploadBufferRef.current.push(entry);
    setData(prev => {
      const next = [...prev, entry];
      if (next.length > 10) return next.slice(next.length - 10);
      return next;
    });
  };

  const flushIfNeeded = async () => {
    if (isUploadingRef.current) return;
    if (uploadBufferRef.current.length >= UPLOAD_BATCH_SIZE) {
      isUploadingRef.current = true;
      const chunk = uploadBufferRef.current.splice(0, UPLOAD_BATCH_SIZE);
      const success = await sendBatchToServer(deviceId ?? null, chunk[0]?.label ?? null, chunk);
      if (!success) {
        // Put failed chunk back to the front
        uploadBufferRef.current = chunk.concat(uploadBufferRef.current);
        console.warn('Requeued chunk after failed upload, buffer length:', uploadBufferRef.current.length);
      }
      isUploadingRef.current = false;
    }
  };

  const commitRecord = (record: RingRecord) => {
    // Note: HR is calculated by backend from PPG data
    // and returned in batch upload response - no frontend calculation needed
    enqueueRecord(record);

    // Add PPG to history for waveform display
    if (record.ppg !== null && record.ppg > 0) {
      setPpgHistory(prev => {
        const newPoint = { timestamp: record.timestamp, ppg: record.ppg! };
        const updated = [...prev, newPoint];
        // Keep last 120 points for detailed waveform
        if (updated.length > 120) return updated.slice(-120);
        return updated;
      });
    }

    flushIfNeeded().catch(console.error);
  };

  const createEmptyRecord = (timestamp: number, label: string): RingRecord => {
    return {
      timestamp,
      label,
      payload: '',
      accX: null, accY: null, accZ: null,
      ppg: null, ppg_max: null, ppg_min: null, ppg_diff: null,
      spo2: null, spo2_max: null, spo2_min: null, spo2_diff: null,
      hr: null,
      meta: null
    };
  };

  const handleNotification = (dataView: DataView, label: string) => {
    const bytes = new Uint8Array(dataView.buffer);
    if (bytes.length === 0) return;

    const now = Date.now();

    // Only process sensor packets (0xA1)
    if (bytes[0] === 0xA1) {
      const subtype = bytes[1]; // 0x01=SpO2, 0x02=PPG, 0x03=Accel

      let current = pendingRecordRef.current;

      // Logic to decide if we should flush the current record and start a new one:
      // 1. No record exists.
      // 2. The time gap between now and the record start is too large.
      // 3. The current record ALREADY has data for this subtype (data collision).

      const isTimeGap = current && (now - current.timestamp > MERGE_WINDOW_MS);
      let isDuplicateType = false;

      if (current) {
        if (subtype === 0x01 && current.spo2 !== null) isDuplicateType = true;
        if (subtype === 0x02 && current.ppg !== null) isDuplicateType = true;
        if (subtype === 0x03 && current.accX !== null) isDuplicateType = true;
      }

      if (!current || isTimeGap || isDuplicateType) {
        // If there was an old record pending, save it now
        if (current) {
          commitRecord(current);
        }
        // Start a new record
        current = createEmptyRecord(now, label);
        pendingRecordRef.current = current;
      }

      // --- Append Payload (Optional debug info) ---
      const hexPayload = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      current.payload += (current.payload ? '|' : '') + hexPayload;

      // --- Merge Data fields ---
      if (subtype === 0x01) { // SpO2
        current.spo2 = (bytes[2] << 8) | bytes[3];
        current.spo2_max = bytes[5];
        current.spo2_min = bytes[7];
        current.spo2_diff = bytes[9];
      } else if (subtype === 0x02) { // PPG
        current.ppg = (bytes[2] << 8) | bytes[3];
        current.ppg_max = (bytes[4] << 8) | bytes[5];
        current.ppg_min = (bytes[6] << 8) | bytes[7];
        current.ppg_diff = (bytes[8] << 8) | bytes[9];
      } else if (subtype === 0x03) { // Accel
        let valX = ((bytes[6] << 4) | (bytes[7] & 0x0f));
        if (valX & 0x0800) valX -= 0x1000;
        current.accX = valX;

        let valY = ((bytes[2] << 4) | (bytes[3] & 0x0f));
        if (valY & 0x0800) valY -= 0x1000;
        current.accY = valY;

        let valZ = ((bytes[4] << 4) | (bytes[5] & 0x0f));
        if (valZ & 0x0800) valZ -= 0x1000;
        current.accZ = valZ;
      }

      // Note: We do NOT commit here. We wait for the next packet or stop command to commit.
      // This allows SpO2, PPG, and Accel arriving within 150ms to populate the same object.

    } else if (bytes[0] === 0x1e) {
      // Real-time HR response packet (Command 30 / 0x1e)
      // Response: { commandId=30, heartRate=byte[1] }
      const hexDump = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('[HR 0x1E] Packet:', hexDump);

      const hrValue = bytes[1];

      if (hrValue > 0 && hrValue < 250) {
        console.log('[HR 0x1E] ✓ HR from ring:', hrValue, 'BPM');
        setCurrentHR(hrValue);

        // Update the pending record with HR if exists
        if (pendingRecordRef.current) {
          pendingRecordRef.current.hr = hrValue;
        }
      } else {
        console.log('[HR 0x1E] Value:', hrValue, '(invalid or zero)');
      }
    } else if (bytes[0] === 0x69) {
      // Data Request response (Command 105 / 0x69)
      // Based on colmi_r02_client: byte[1]=readingType, byte[2]=errorCode, byte[3]=value
      const readingType = bytes[1];
      const errorCode = bytes[2];
      const hrValue = bytes[3];

      // Always log 0x69 packets for debugging
      const hexDump = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('[HR 0x69] Packet:', hexDump, '| Type:', readingType, '| Error:', errorCode, '| Value:', hrValue);

      if (readingType === 1) { // Heart Rate reading type
        if (errorCode === 0 && hrValue > 0 && hrValue < 250) {
          console.log('[HR 0x69] ✓ Valid HR from ring:', hrValue, 'BPM');
          setCurrentHR(hrValue);

          if (pendingRecordRef.current) {
            pendingRecordRef.current.hr = hrValue;
          }
        } else if (errorCode !== 0) {
          // Error codes: 1=no finger detected, 2=measuring, etc.
          console.warn('[HR 0x69] Error code:', errorCode, '(1=no finger, 2=measuring)');
        } else if (hrValue === 0) {
          console.log('[HR 0x69] Still measuring... (value=0)');
        }
      }
    } else if (bytes[0] === 0x6a) {
      // Stop Data Request response - log full packet
      const hexDump = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('[BLE] 0x6a (stop) response:', hexDump);
    } else if (bytes[0] === 0x73) {
      // Device Notify packet (ID: 115 = 0x73)
      // When byte[1] = 0x12, byte[4] contains HR value
      const notifyType = bytes[1];
      const hexDump = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');

      console.log('[0x73] Device Notify | Type:', '0x' + notifyType.toString(16), '| Full:', hexDump);

      if (notifyType === 0x12) {
        // Real-time HR notification - HR is in byte[4]
        const hrValue = bytes[4];

        if (hrValue > 30 && hrValue < 250) {
          console.log('[0x73] ✓ HR from Device Notify:', hrValue, 'BPM');
          setCurrentHR(hrValue);

          // Update the pending record with HR if exists
          if (pendingRecordRef.current) {
            pendingRecordRef.current.hr = hrValue;
          }
        } else {
          console.log('[0x73] Type 0x12 but HR value invalid:', hrValue);
        }
      } else if (notifyType === 0x01) {
        // Type 0x01 is usually just an acknowledgment, no HR data
        console.log('[0x73] Type 0x01 = acknowledgment (no HR data)');
      } else {
        console.log('[0x73] Unknown notify type:', '0x' + notifyType.toString(16));
      }
    } else if (bytes[0] === 0x16) {
      // HR Settings response (command 22 / 0x16)
      // byte[2] = enabled (1=enabled, 2=disabled)
      // byte[3] = interval in minutes
      const enabled = bytes[2] === 1;
      const interval = bytes[3];
      console.log('[HR Settings] Periodic HR logging:', enabled ? 'ENABLED' : 'DISABLED', 'Interval:', interval, 'min');
    } else {
      // Only log if it's not a common packet
      if (bytes[0] !== 0x03 && bytes[0] !== 0x0a) { // 0x03=battery, 0x0a=units response
        const hexDump = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('[BLE] Unknown packet:', bytes[0].toString(16), 'hex:', hexDump);
      }
    }
  };

  const startDataCollection = useCallback(
    async (durationSeconds: number = 60, label: string = 'default') => {
      if (!deviceId || isCollecting) return;

      if (!isDeviceConnectedRef.current) {
        setError('Device not connected');
        return;
      }

      // Only start foreground service if not already running
      if (!periodicRunningRef.current) {
        await ensureForegroundServiceStarted({
          id: 1001,
          title: 'Ring collector',
          body: 'Collecting BLE data',
          smallIcon: 'ic_stat_icon_config_sample',
          notificationChannelId: 'ring-collector',
        });
      }

      setIsCollecting(true);
      setError(null);
      setData([]);
      pendingRecordRef.current = null;

      try {
        // small delay after connect to allow discovery to complete on some Android devices
        await new Promise((resolve) => setTimeout(resolve, 500));

        // dump services for debugging; inspect console if notifications fail
        await dumpServices(deviceId);

        // Set up notification listeners BEFORE starting notifications
        const rxtxListenerKey = `notification|${deviceId}|${RXTX_SERVICE_UUID}|${RXTX_NOTIFY_UUID}`;

        console.log('Adding listeners? alreadyAdded =', listenersAddedRef.current);

        if (!listenersAddedRef.current) {
          listenersAddedRef.current = true;

          rxtxListenerRef.current = await BluetoothLe.addListener(rxtxListenerKey, (result: any) => {
            if (!result?.value) {
              console.info('Received notification with undefined value (RXTX)');
              return;
            }

            // inside the addListener callback (both RXTX and MAIN)
            console.info('RAW notification result.value:', result.value, 'typeof:', typeof result.value);

            const dataView = normalizeResultValueToDataView(result.value);
            console.info('Normalized DataView byteLength=', dataView.byteLength);
            handleNotification(dataView, label);
          });

          const mainListenerKey = `notification|${deviceId}|${MAIN_SERVICE_UUID}|${MAIN_NOTIFY_UUID}`;
          mainListenerRef.current = await BluetoothLe.addListener(mainListenerKey, (result: any) => {
            if (!result?.value) {
              console.info('Received notification with undefined value (MAIN)');
              return;
            }
            const dataView = normalizeResultValueToDataView(result.value);
            handleNotification(dataView, label);
          });
        } else {
          console.log('Listeners alrerady added.');
        }



        // Start notifications (only after listeners registered
        console.info('Starting notifications...');
        try {
          await BluetoothLe.startNotifications({ deviceId, service: RXTX_SERVICE_UUID, characteristic: RXTX_NOTIFY_UUID });
          await BluetoothLe.startNotifications({ deviceId, service: MAIN_SERVICE_UUID, characteristic: MAIN_NOTIFY_UUID });
          console.info('Notifications started');
        } catch (e) {
          console.error('startNotifications error:', e);
          throw e;
        }

        // Send commands to RXTX service using helper that tries BleClient then hex then base64
        console.info('Sending commands...');
        await writeCommand(deviceId, RXTX_SERVICE_UUID, RXTX_WRITE_UUID, BATTERY_CMD);
        await writeCommand(deviceId, RXTX_SERVICE_UUID, RXTX_WRITE_UUID, SET_UNITS_METRICS);

        await writeCommand(deviceId, RXTX_SERVICE_UUID, RXTX_WRITE_UUID, ENABLE_RAW_SENSOR_CMD);
        console.info('Commands sent (raw sensor enabled)');

        // Note: HR is calculated by backend from PPG data - no ring HR commands needed

        // Auto-stop after duration (store timer so we can cancel if needed)
        if (collectionTimeoutRef.current) {
          clearTimeout(collectionTimeoutRef.current);
          collectionTimeoutRef.current = null;
        }

        collectionTimeoutRef.current = window.setTimeout(() => {
          // clear ref immediately to avoid double-clear races
          collectionTimeoutRef.current = null;
          stopDataCollection().catch((err) => {
            console.error('Error stopping collection from timeout', err);
          });
        }, Math.max(0, durationSeconds) * 1000);
      } catch (err) {
        setError(`Start error: ${String(err)}`);
        setIsCollecting(false);
        console.error('Full error:', err);
        // Stop the foreground service if BLE setup failed
        await ensureForegroundServiceStopped();
      }
    },
    [deviceId, isCollecting]
  );

  const stopDataCollection = useCallback(async () => {
    console.trace('stopRingDataCollection() called');

    // prevent duplicate calls from racing
    // clear any scheduled auto-stop (we're handling stop now)
    if (collectionTimeoutRef.current) {
      clearTimeout(collectionTimeoutRef.current);
      collectionTimeoutRef.current = null;
    }

    try {
      // Send disable command only if there is an active deviceId
      if (deviceId && isDeviceConnectedRef.current) {
        try {
          await writeCommand(deviceId, RXTX_SERVICE_UUID, RXTX_WRITE_UUID, DISABLE_RAW_SENSOR_CMD);
        } catch (e) {
          console.warn('Failed to write disable command (device may be disconnected):', e);
        }
      } else {
        console.info('No deviceId when stopping or the device is not connected — skipping disable command.');
      }

      if (pendingRecordRef.current) {
        commitRecord(pendingRecordRef.current);
        pendingRecordRef.current = null;
      }

      if (uploadBufferRef.current.length > 0) {
        console.log('Flushing remaining', uploadBufferRef.current.length, 'records before stop');
        while (uploadBufferRef.current.length > 0) {
          const chunk = uploadBufferRef.current.splice(0, UPLOAD_BATCH_SIZE);
          const ok = await sendBatchToServer(deviceId ?? null, chunk[0]?.label ?? null, chunk);
          if (!ok) {
            // push the chunk back and break; we don't want infinite loop
            uploadBufferRef.current.unshift(...chunk);
            console.warn('Upload chunk failed while stopping; requeued chunk');
            break;
          }
        }
      }

      await saveToCsv();



      setIsCollecting(false);
      console.info('Data collection stopped (device still connected)');
    } catch (err) {
      setError(`Stop error: ${String(err)}`);
      setIsCollecting(false);
      console.error('Stop error full:', err);
    } finally {
      // always stop the native foreground service as well
      try {
        await ensureForegroundServiceStopped();
      } catch (e) {
        console.warn('ensureForegroundServiceStopped failed in finally:', e);
      }
    }
  }, [deviceId, data]);

  const disconnectDevice = useCallback(async () => {
    console.log('disconnectDevice() called');

    try {
      // First stop any active collection
      if (isCollecting) {
        await stopDataCollection();
      }

      // Stop periodic collection if running
      if (periodicRunningRef.current || periodicTimerRef.current) {
        periodicRunningRef.current = false;
        if (periodicTimerRef.current !== null) {
          clearInterval(periodicTimerRef.current);
          periodicTimerRef.current = null;
        }
        console.log('Stopped periodic collection');
      }

      // Now disconnect the device
      if (deviceId && isDeviceConnectedRef.current) {
        try {
          await BluetoothLe.disconnect({ deviceId });
          isDeviceConnectedRef.current = false;
          listenersAddedRef.current = false; // Reset listeners flag
          console.log('Device disconnected');
        } catch (e) {
          console.warn('Disconnect failed:', e);
        }
      }

      // Clear device state
      setDeviceId(null);
      setIsCollecting(false);

      // Ensure foreground service is stopped
      await ensureForegroundServiceStopped();

    } catch (err) {
      setError(`Disconnect error: ${String(err)}`);
      console.error('Disconnect error:', err);
    }
  }, [deviceId, isCollecting, stopDataCollection]);

  const saveToCsv = async () => {
    const csv = Papa.unparse(data);
    const fileName = `ring_data_${Date.now()}.csv`;

    try {
      // Write plain UTF-8 CSV (not base64)
      await Filesystem.writeFile({
        path: fileName,
        data: csv,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      console.info('Saved CSV to Documents directory as', fileName);
      console.info('On Android you can find it at /sdcard/Documents/' + fileName + ' (or check the Files app -> Documents).');
    } catch (err) {
      setError(`CSV save error: ${String(err)}`);
    }
  };

  const startPeriodicCollection = useCallback(
    async (periodMinutes: number = 5, sampleSeconds: number = 10, label: string = 'periodic', autoConnect: boolean = false) => {
      if (periodicRunningRef.current) {
        console.info('Periodic collection already running');
        return;
      }
      periodicRunningRef.current = true;
      setIsPeriodicRunning(true);

      // Start foreground service ONCE for the entire periodic session
      await ensureForegroundServiceStarted({
        id: 1001,
        title: 'Ring periodic collector',
        body: `Sampling every ${periodMinutes} min`,
        smallIcon: 'ic_stat_icon_config_sample',
        notificationChannelId: 'ring-collector',
      });

      // Auto-connect if requested
      if (!deviceId && autoConnect) {
        try {
          await scanAndConnect();
          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          console.warn('Auto connect failed:', e);
        }
      }

      const startSample = async () => {
        if (!deviceId) {
          console.warn('No device connected – skipping periodic sample');
          return;
        }
        if (isCollecting) {
          console.warn('Collection already in progress – skipping this tick');
          return;
        }
        try {
          console.info(`Periodic: starting ${sampleSeconds}s sample (label=${label})`);
          await startDataCollection(sampleSeconds, label);
        } catch (e) {
          console.error('Periodic sample failed:', e);
        }
      };

      // Start first sample immediately
      startSample().catch(console.error);

      // Schedule periodic samples
      const periodMs = Math.max(1000, Math.floor(periodMinutes * 60 * 1000));
      periodicTimerRef.current = window.setInterval(() => {
        startSample().catch(console.error);
      }, periodMs) as unknown as number;

      console.info(`Periodic collection started: every ${periodMinutes} min, ${sampleSeconds}s samples`);
    },
    [deviceId, isCollecting, scanAndConnect, startDataCollection]
  );

  const stopPeriodicCollection = useCallback(async () => {
    if (!periodicRunningRef.current && !periodicTimerRef.current) {
      console.info('Periodic collection not running');
      return;
    }

    periodicRunningRef.current = false;
    setIsPeriodicRunning(false);
    if (periodicTimerRef.current !== null) {
      clearInterval(periodicTimerRef.current);
      periodicTimerRef.current = null;
    }

    // Stop any active collection
    if (isCollecting) {
      await stopDataCollection();
    }

    // Stop foreground service
    await ensureForegroundServiceStopped();

    console.info('Periodic collection stopped (device still connected)');
  }, [isCollecting, stopDataCollection]);

  useEffect(() => {
    return () => {
      console.log('Component unmounting - full cleanup');

      // Stop periodic timer synchronously
      if (periodicTimerRef.current !== null) {
        clearInterval(periodicTimerRef.current);
        periodicTimerRef.current = null;
      }
      periodicRunningRef.current = false;

      // Stop collection timeout
      if (collectionTimeoutRef.current) {
        clearTimeout(collectionTimeoutRef.current);
        collectionTimeoutRef.current = null;
      }

      // Disconnect device (async, don't await)
      if (deviceIdRef.current && isDeviceConnectedRef.current) {
        (async () => {
          try {
            await BluetoothLe.disconnect({ deviceId: deviceIdRef.current! });
            await ensureForegroundServiceStopped();
            console.log('Cleanup: disconnected device');
          } catch (e) {
            console.warn('Cleanup disconnect failed:', e);
          }
        })();
      }
    };
  }, []);

  return {
    initialize,
    scanAndConnect,
    startDataCollection,
    stopDataCollection,
    disconnectDevice,
    startPeriodicCollection,
    stopPeriodicCollection,
    isCollecting,
    isPeriodicRunning,
    currentHR,
    hrHistory,
    ppgHistory,
    data,
    error,
    deviceId,
  };
};
