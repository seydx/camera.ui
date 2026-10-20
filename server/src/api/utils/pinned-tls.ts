import { X509Certificate } from 'node:crypto';
import { isIP } from 'node:net';
import { connect } from 'node:tls';

import { certificateFingerprint } from '../../services/config/move.js';

import type { DetailedPeerCertificate, TLSSocket } from 'node:tls';

export class PinMismatchError extends Error {}

export function connectPinned(host: string, port: number, fingerprint: string, timeoutMs: number): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, servername: isIP(host) ? undefined : host, rejectUnauthorized: false });
    const fail = (error: Error): void => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeoutMs, () => fail(new Error(`${host}:${port} did not answer`)));
    socket.once('error', fail);
    socket.once('secureConnect', () => {
      socket.setTimeout(0);
      socket.off('error', fail);
      if (presentsPinned(socket, fingerprint)) resolve(socket);
      else fail(new PinMismatchError(`${host}:${port} is not the server that created this code`));
    });
  });
}

function presentsPinned(socket: TLSSocket, fingerprint: string): boolean {
  const chain = socket.getPeerCertificate(true);
  if (!chain?.raw) return false;
  if (certificateFingerprint(chain.raw) === fingerprint) return true;

  const leaf = new X509Certificate(chain.raw);
  const seen = new Set<DetailedPeerCertificate>([chain]);
  for (let cert = chain.issuerCertificate; cert && !seen.has(cert); cert = cert.issuerCertificate) {
    seen.add(cert);
    if (certificateFingerprint(cert.raw) !== fingerprint) continue;

    const ca = new X509Certificate(cert.raw);
    return leaf.checkIssued(ca) && leaf.verify(ca.publicKey);
  }
  return false;
}
