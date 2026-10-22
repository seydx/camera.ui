import { uuidv4 } from '@camera.ui/common/utils';

import { keychainId } from '@/common/deviceId.js';
import { isCapacitor } from '@/connection/runtime.js';

const DEVICE_ID_KEY = 'cui_device_id';
const SESSION_ID_KEY = 'cui.device.sessionId';

let _cachedId: string | null = null;
let _cachedName: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (_cachedId) return _cachedId;

  if (isCapacitor) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const { Device } = await import('@capacitor/device');
      const { identifier } = await Device.getId();
      // identifierForVendor changes with a reinstall, the keychain keeps the first one
      _cachedId = Capacitor.getPlatform() === 'ios' ? await keychainId(SESSION_ID_KEY, identifier) : identifier;
      return _cachedId;
    } catch {
      // fall back to localStorage
    }
  }

  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    _cachedId = stored;
    return stored;
  }
  const generated = uuidv4();
  localStorage.setItem(DEVICE_ID_KEY, generated);
  _cachedId = generated;
  return generated;
}

export async function getDeviceName(): Promise<string> {
  if (_cachedName) return _cachedName;

  if (isCapacitor) {
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getInfo();
      const model = info.model ?? 'Mobile';
      const platform = info.platform ?? '';
      const os = info.osVersion ? ` (${info.platform === 'ios' ? 'iOS' : 'Android'} ${info.osVersion})` : '';
      _cachedName = platform ? `${model}${os}` : model;
      return _cachedName;
    } catch {
      _cachedName = 'Mobile device';
      return _cachedName;
    }
  }

  _cachedName = parseBrowserAndOS(navigator.userAgent);
  return _cachedName;
}

function parseBrowserAndOS(ua: string): string {
  const browser = (() => {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return 'Browser';
  })();

  const os = (() => {
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Linux/.test(ua)) return 'Linux';
    return '';
  })();

  return os ? `${browser} on ${os}` : browser;
}
