import { fetchViableNetworkAddresses } from '@camera.ui/common/network';
import { DNSPacket } from '@homebridge/ciao/lib/coder/DNSPacket.js';
import { Question } from '@homebridge/ciao/lib/coder/Question.js';
import { createSocket } from 'node:dgram';
import { isIPv4 } from 'node:net';

import type { PacketType, QType, RType } from '@homebridge/ciao/lib/coder/DNSPacket.js';
import type { ARecord } from '@homebridge/ciao/lib/coder/records/ARecord.js';
import type { PTRRecord } from '@homebridge/ciao/lib/coder/records/PTRRecord.js';
import type { SRVRecord } from '@homebridge/ciao/lib/coder/records/SRVRecord.js';
import type { TXTRecord } from '@homebridge/ciao/lib/coder/records/TXTRecord.js';
import type { ResourceRecord } from '@homebridge/ciao/lib/coder/ResourceRecord.js';

export interface AnnouncedServer {
  id?: string;
  port: number;
  addresses: string[];
}

export interface BrowseResult {
  servers: AnnouncedServer[];
  failure?: string;
}

const SERVICE_TYPE = '_camera-ui._tcp.local.';
const MDNS_GROUP = '224.0.0.251';
const MDNS_PORT = 5353;
const QUERY_REPEAT_MS = 1000;
const QUERY_PTR = 12 as QType;
const RESPONSE = 1 as PacketType;
const TYPE = { A: 1 as RType, PTR: 12 as RType, TXT: 16 as RType, SRV: 33 as RType };

export function browseCameraUi(timeoutMs: number): Promise<BrowseResult> {
  return new Promise((resolve) => {
    const records: ResourceRecord[] = [];
    const socket = createSocket({ type: 'udp4', reuseAddr: true });
    let timer: NodeJS.Timeout | undefined;
    let repeat: NodeJS.Timeout | undefined;
    let done = false;
    let sent = false;
    let failure: string | undefined;

    const failed = (error: NodeJS.ErrnoException): void => {
      failure = error.code ?? error.message;
    };

    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(repeat);
      socket.close();
      resolve({ servers: announcedServers(records), failure: sent ? undefined : (failure ?? 'ENONET') });
    };

    const joined = (address: string): boolean => {
      try {
        socket.addMembership(MDNS_GROUP, address);
        return true;
      } catch {
        return false;
      }
    };

    socket.once('error', (error) => {
      failed(error);
      finish();
    });
    socket.on('message', (message, rinfo) => {
      try {
        const packet = DNSPacket.decode(rinfo, message);
        if (packet.type === RESPONSE) records.push(...packet.answers.values(), ...packet.additionals.values());
      } catch {
        // not a packet ciao can read
      }
    });

    socket.bind(MDNS_PORT, () => {
      const query = DNSPacket.createDNSQueryPacket({ questions: [new Question(SERVICE_TYPE, QUERY_PTR)] }).encode();
      const interfaces = fetchViableNetworkAddresses()
        .map((viable) => viable.address)
        .filter((address) => isIPv4(address) && joined(address));

      const send = (index: number): void => {
        const address = interfaces[index];
        if (done || !address) return;
        try {
          socket.setMulticastInterface(address);
        } catch (error) {
          failed(error);
          send(index + 1);
          return;
        }
        // the interface applies when the send leaves, the next send waits for this one
        socket.send(query, MDNS_PORT, MDNS_GROUP, (error) => {
          if (error) failed(error);
          else sent = true;
          send(index + 1);
        });
      };

      send(0);
      repeat = setTimeout(() => send(0), QUERY_REPEAT_MS);
      timer = setTimeout(finish, timeoutMs);
    });
  });
}

export function announcedServers(records: ResourceRecord[]): AnnouncedServer[] {
  const named = (type: RType, name: string): ResourceRecord[] => records.filter((record) => record.type === type && sameName(record.name, name));
  const instances = new Set(named(TYPE.PTR, SERVICE_TYPE).map((record) => (record as PTRRecord).ptrName.toLowerCase()));

  const servers: AnnouncedServer[] = [];
  for (const instance of instances) {
    const srv = named(TYPE.SRV, instance)[0] as SRVRecord | undefined;
    if (!srv) continue;

    const txt = named(TYPE.TXT, instance).flatMap((record) => (record as TXTRecord).txt.map((entry) => entry.toString('utf-8')));
    const id = txt.find((entry) => entry.startsWith('id=') && entry.length > 3)?.slice(3);
    const addresses = new Set(named(TYPE.A, srv.hostname).map((record) => (record as ARecord).ipAddress));
    servers.push({ id, port: srv.port, addresses: [...addresses] });
  }
  return servers;
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
