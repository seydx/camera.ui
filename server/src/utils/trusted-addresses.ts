import { BlockList, isIP } from 'node:net';

export function trustEntry(value: unknown): string | undefined {
  const entry = typeof value === 'string' ? value.trim() : '';
  const [address, prefix, rest] = entry.split('/');
  const family = address.includes('%') ? 0 : isIP(address);
  const bits = prefix === undefined ? 1 : /^\d+$/.test(prefix) ? +prefix : 0;
  return family && rest === undefined && bits >= 1 && bits <= (family === 4 ? 32 : 128) ? entry : undefined;
}

export function addressList(entries: readonly string[]): BlockList {
  const list = new BlockList();
  for (const entry of entries) {
    const [address, prefix] = entry.split('/');
    const family = isIP(address) === 6 ? 'ipv6' : 'ipv4';
    if (prefix === undefined) list.addAddress(address, family);
    else list.addSubnet(address, +prefix, family);
  }
  return list;
}

export function listsAddress(list: BlockList, address: string | undefined): boolean {
  const family = address ? isIP(address) : 0;
  return family !== 0 && list.check(address!, family === 6 ? 'ipv6' : 'ipv4');
}

export function listsLoopback(list: BlockList): boolean {
  return list.check('127.0.0.1', 'ipv4') || list.check('::1', 'ipv6');
}
