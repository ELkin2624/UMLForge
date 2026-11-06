import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { request } from '@/shared/api/client';

/** Mientras la app está abierta, muestra el aviso como banner. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

async function obtainExpoToken(): Promise<string | null> {
  // Las push remotas solo funcionan en dispositivo físico.
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos',
      // eslint-disable-next-line import/namespace -- el enum se reexporta con `export *`
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Pide permiso, obtiene el token de Expo y lo registra en el backend. No lanza: el push es opcional. */
export async function registerForPush(): Promise<void> {
  try {
    const token = await obtainExpoToken();
    if (!token) return;
    await request('/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    registeredToken = token;
  } catch (err) {
    console.warn('No se pudo registrar el push', err);
  }
}

/** Borra el token del backend; llamar ANTES de cerrar la sesión. */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await request('/notifications/devices/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  } catch {
    // Si falla, el backend lo reasigna al próximo usuario que inicie sesión en este dispositivo.
  }
}
