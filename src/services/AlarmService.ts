import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { getSleepStageMonitor } from './SleepStageMonitor';

export class AlarmService {
  // Smart alarm state
  private smartAlarmActive: boolean = false;
  private currentSoundChoice: number = 1;
  private hardAlarmTime: Date | null = null;

  constructor() {
    this.initializeChannels();
    this.registerActions();
  }

  async registerActions() {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'ALARM_ACTIONS',
          actions: [
            {
              id: 'stop_alarm',
              title: 'STOP ALARM',
              foreground: true, // Opens the app when pressed
              destructive: true // Shows in red (on iOS/some Androids)
            }
          ]
        }
      ]
    });
  }

  // 1. Setup Channels for Android 8+
  // We create different channels for different behaviors
  async initializeChannels() {
    // Channel for Song 1
    await LocalNotifications.createChannel({
      id: 'alarm_channel_song_1_v2',
      name: 'Alarm - Song 1',
      importance: 5,
      visibility: 1,
      sound: 'alarm',
      vibration: true
    });

    // Channel for Song 2
    await LocalNotifications.createChannel({
      id: 'alarm_channel_song_2_v2',
      name: 'Alarm - Song 2',
      description: 'Wake up to Song 2',
      importance: 5,
      visibility: 1,
      sound: 'alarm2',
      vibration: true
    });

    // Channel for Song 3 (Birds)
    await LocalNotifications.createChannel({
      id: 'alarm_channel_song_3_v2',
      name: 'Alarm - Song 3',
      description: 'Wake up to Birds',
      importance: 5,
      visibility: 1,
      sound: 'alarm3', // Assuming 'alarm3.wav/mp3' exists in res/raw, otherwise fallbacks to default
      vibration: true
    });

  }

  // Helper to get channel ID based on sound choice
  private getChannelId(soundChoice: number): string {
    switch (soundChoice) {
      case 2: return 'alarm_channel_song_2_v2';
      case 3: return 'alarm_channel_song_3_v2';
      default: return 'alarm_channel_song_1_v2';
    }
  }

  // 2. Schedule the Alarm (basic, non-smart)
  // soundChoice: 1 (Song 1), 2 (Song 2), 3 (Birds)
  async setAlarm(triggerDate: Date, soundChoice: number) {
    await this.initializeChannels();

    const selectedChannelId = this.getChannelId(soundChoice);

    const options: ScheduleOptions = {
      notifications: [{
        id: 1,
        title: 'Wake Up!',
        body: 'Time to get up!',
        actionTypeId: 'ALARM_ACTIONS',
        schedule: {
          at: triggerDate,
          allowWhileIdle: true
        },
        channelId: selectedChannelId,
        smallIcon: 'ic_stat_alarm',
        ongoing: true,

      }]
    };

    try {
      await LocalNotifications.schedule(options);
      console.log(`Alarm set for ${triggerDate} on channel ${selectedChannelId}`);
      return true;
    } catch (e) {
      console.error('Error scheduling alarm', e);
      return false;
    }
  }

  /**
   * Set a smart alarm that wakes you at an optimal sleep stage.
   * 
   * @param wakeTime - The latest time you want to wake up (hard alarm)
   * @param windowMinutes - How many minutes before wakeTime to start checking
   * @param soundChoice - Which alarm sound to use (1, 2, or 3)
   * @param deviceId - The ring device ID for fetching predictions
   * @param onSmartWake - Callback when smart wake triggers (optional)
   * @returns true if alarm was set successfully
   */
  async setSmartAlarm(
    wakeTime: Date,
    windowMinutes: number,
    soundChoice: number,
    deviceId: string,
    onSmartWake?: (stageLabel: string) => void
  ): Promise<boolean> {
    await this.initializeChannels();

    // Calculate window start time
    const windowStartTime = new Date(wakeTime.getTime() - windowMinutes * 60 * 1000);
    const now = new Date();

    console.log(`[SmartAlarm] Setting smart alarm:`);
    console.log(`  - Window starts: ${windowStartTime.toLocaleTimeString()}`);
    console.log(`  - Hard alarm: ${wakeTime.toLocaleTimeString()}`);
    console.log(`  - Device: ${deviceId}`);

    // Always schedule a hard alarm at wakeTime as fallback
    const hardAlarmSet = await this.setAlarm(wakeTime, soundChoice);
    if (!hardAlarmSet) {
      return false;
    }

    // Store state for smart alarm
    this.smartAlarmActive = true;
    this.currentSoundChoice = soundChoice;
    this.hardAlarmTime = wakeTime;

    // If window is 0 or already past window start, just use hard alarm
    if (windowMinutes === 0) {
      console.log('[SmartAlarm] Window is 0, using hard alarm only');
      return true;
    }

    // Calculate when to start monitoring
    const msUntilWindowStart = windowStartTime.getTime() - now.getTime();

    if (msUntilWindowStart <= 0) {
      // Window already started, begin monitoring immediately
      console.log('[SmartAlarm] Window already started, beginning monitoring');
      this.startSleepStageMonitoring(deviceId, wakeTime, onSmartWake);
    } else {
      // Schedule monitoring to start at window start time
      console.log(`[SmartAlarm] Will start monitoring in ${Math.round(msUntilWindowStart / 60000)} minutes`);
      setTimeout(() => {
        if (this.smartAlarmActive) {
          console.log('[SmartAlarm] Window started, beginning monitoring');
          this.startSleepStageMonitoring(deviceId, wakeTime, onSmartWake);
        }
      }, msUntilWindowStart);
    }

    return true;
  }

  /**
   * Start monitoring sleep stages and trigger alarm on optimal stage.
   */
  private startSleepStageMonitoring(
    deviceId: string,
    windowEndTime: Date,
    onSmartWake?: (stageLabel: string) => void
  ): void {
    const monitor = getSleepStageMonitor();

    monitor.startMonitoring(deviceId, windowEndTime, {
      onOptimalWake: async (stage, stageLabel) => {
        console.log(`[SmartAlarm] Optimal wake stage detected: ${stageLabel}`);

        // Cancel the scheduled hard alarm
        await this.cancelAll();

        // Trigger alarm immediately
        await this.triggerImmediateAlarm(stageLabel);

        // Call the callback if provided
        if (onSmartWake) {
          onSmartWake(stageLabel);
        }

        this.smartAlarmActive = false;
      },
      onStageUpdate: (stage, stageLabel) => {
        console.log(`[SmartAlarm] Current sleep stage: ${stageLabel}`);
      },
      onError: (error) => {
        console.error(`[SmartAlarm] Monitor error: ${error}`);
        // Keep going, hard alarm is still scheduled as fallback
      }
    });
  }

  /**
   * Trigger an alarm immediately (used when optimal sleep stage detected).
   */
  async triggerImmediateAlarm(stageLabel: string = 'Light'): Promise<boolean> {
    await this.initializeChannels();

    const selectedChannelId = this.getChannelId(this.currentSoundChoice);

    // Schedule for 2 seconds from now (immediate)
    const triggerDate = new Date(Date.now() + 2000);

    const options: ScheduleOptions = {
      notifications: [{
        id: 2, // Different ID from hard alarm
        title: '☀️ Optimal Wake Time!',
        body: `You're in ${stageLabel} sleep - perfect time to wake up!`,
        actionTypeId: 'ALARM_ACTIONS',
        schedule: {
          at: triggerDate,
          allowWhileIdle: true
        },
        channelId: selectedChannelId,
        smallIcon: 'ic_stat_alarm',
        ongoing: true,
      }]
    };

    try {
      await LocalNotifications.schedule(options);
      console.log(`[SmartAlarm] Immediate alarm triggered for ${stageLabel} sleep`);
      return true;
    } catch (e) {
      console.error('Error triggering immediate alarm', e);
      return false;
    }
  }

  // 3. Cancel all alarms
  async cancelAll() {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    // Also stop sleep stage monitoring
    const monitor = getSleepStageMonitor();
    monitor.stop();
    this.smartAlarmActive = false;
  }

  /**
   * Check if smart alarm is currently active.
   */
  isSmartAlarmActive(): boolean {
    return this.smartAlarmActive;
  }

  async requestPermissions() {
    const result = await LocalNotifications.requestPermissions();
    if (result.display === 'granted') {
      return true
    }
  }

}
