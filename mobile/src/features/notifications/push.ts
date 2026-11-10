import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

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

/** Resultado del último intento de registro, para avisar al usuario si algo falla. */
export type PushStatus = 'idle' | 'ok' | 'denied' | 'unsupported' | 'error';

export const usePushStatus = create<{ status: PushStatus }>(() => ({ status: 'idle' }));

const setStatus = (status: PushStatus) => usePushStatus.setState({ status });

let registeredToken: string | null = null;

type TokenResult = { token: string } | { failure: Exclude<PushStatus, 'idle' | 'ok'> };

async function obtainExpoToken(): Promise<TokenResult> {
  // Las push remotas solo funcionan en dispositivo físico.
  if (!Device.isDevice) return { failure: 'unsupported' };

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
  if (status !== 'granted') return { failure: 'denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { failure: 'error' };
  return { token: (await Notifications.getExpoPushTokenAsync({ projectId })).data };
}

/** Pide permiso, obtiene el token de Expo y lo registra en el backend. No lanza: el push es opcional. */
export async function registerForPush(): Promise<void> {
  try {
    const result = await obtainExpoToken();
    if ('failure' in result) {
      setStatus(result.failure);
      return;
    }
    const { token } = result;
    await request('/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    registeredToken = token;
    setStatus('ok');
  } catch (err) {
    console.warn('No se pudo registrar el push', err);
    setStatus('error');
  }
}

/** Borra el token del backend; llamar ANTES de cerrar la sesión. */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  setStatus('idle');
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
