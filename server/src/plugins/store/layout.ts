const LAYOUT_VERSION_KEY = '__v';
// v2 keys sensors by persistent sensor id, older camera-keyed trees can't be mapped
const LAYOUT_VERSION = 2;

export function upgradeStoreLayout(payload: Record<string, any>): Record<string, any> {
  if (payload[LAYOUT_VERSION_KEY] === LAYOUT_VERSION) {
    return payload;
  }

  const upgraded = { ...payload };
  delete upgraded.sensors;
  upgraded[LAYOUT_VERSION_KEY] = LAYOUT_VERSION;
  return upgraded;
}
