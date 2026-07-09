import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '@/src/lib/api';
import { useRole } from '@/src/context/RoleProvider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type PushNotificationContextValue = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
};

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const { user } = useRole();

  useEffect(() => {
    if (!user) return; // Only register if user is logged in

    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Send token to backend
        api.notifications.registerDevice(token).catch(e => {
          console.warn('Failed to register push token with backend:', e);
        });
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // Handle deep linking based on notification data
      console.log('Notification response:', response.notification.request.content.data);
      const data = response.notification.request.content.data;
      // Depending on data, e.g. navigate using expo-router router.push(data.url)
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  return (
    <PushNotificationContext.Provider value={{ expoPushToken, notification }}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) throw new Error("usePushNotifications must be used within PushNotificationProvider");
  return ctx;
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    try {
      const Constants = require('expo-constants').default;
      const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
      
      if (isExpoGo) {
        console.log('Push notifications are not supported in Expo Go. Skipping token registration.');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
         console.log('Missing eas.projectId in app.json. Skipping push token registration.');
         return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Push token:', token);
    } catch (e) {
      console.warn("Could not get push token:", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
