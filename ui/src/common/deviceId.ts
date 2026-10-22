import { uuidv4 } from '@camera.ui/common/utils';

import { isCapacitor } from '@/connection/index.js';

const PUSH_ID_KEY = 'cui.device.pushId';
const WEB_PUSH_ID_KEY = 'cameraui:web-push-id';

export async function getPushDeviceId(): Promise<string> {
  if (isCapacitor) {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() === 'android') {
      const { Device } = await import('@capacitor/device');
      return (await Device.getId()).identifier;
    }
    return keychainId(PUSH_ID_KEY);
  }
  let id = localStorage.getItem(WEB_PUSH_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(WEB_PUSH_ID_KEY, id);
  }
  return id;
}

export async function keychainId(key: string, initial = uuidv4()): Promise<string> {
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  const existing = await SecureStorage.get(key);
  if (typeof existing === 'string' && existing) return existing;
  await SecureStorage.set(key, initial);
  return initial;
}
