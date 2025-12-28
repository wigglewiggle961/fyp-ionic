import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';

export class AlarmService {

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

  // 2. Schedule the Alarm
  // soundChoice: 1 (Song 1), 2 (Song 2), 3 (Birds)
  async setAlarm(triggerDate: Date, soundChoice: number) {
    await this.initializeChannels();

    // Determine which channel to use based on user choice
    let selectedChannelId = 'alarm_channel_song_1_v2';

    if (soundChoice === 1) {
      selectedChannelId = 'alarm_channel_song_1_v2';
    } else if (soundChoice === 2) {
      selectedChannelId = 'alarm_channel_song_2_v2';
    } else if (soundChoice === 3) {
      selectedChannelId = 'alarm_channel_song_3_v2';
    }

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

  // 3. Cancel all alarms
  async cancelAll() {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
  }

  async requestPermissions() {
    const result = await LocalNotifications.requestPermissions();
    if (result.display === 'granted') {
      return true
    }
  }

}