import { pathExists, remove } from 'fs-extra/esm';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Worker } from 'node:worker_threads';

const requireDependency = createRequire(import.meta.url);

const EXTRACT_SOURCE = `
const { workerData } = require('node:worker_threads');
const AdmZip = require(workerData.admZip);
new AdmZip(workerData.bundlePath).extractAllTo(workerData.bundleDir, true);
`;

export async function checkBundledPlugin(packageDir: string): Promise<string | undefined> {
  const bundleRootPath = join(packageDir, 'bundle.zip');
  const bundlePath = join(packageDir, 'bundle', 'bundle.zip');

  if (await pathExists(bundleRootPath)) {
    return bundleRootPath;
  }

  if (await pathExists(bundlePath)) {
    return bundlePath;
  }
}

export async function extractBundledPlugin(packageDir: string, bundlePath?: string): Promise<void> {
  bundlePath = bundlePath ?? (await checkBundledPlugin(packageDir));
  if (!bundlePath) {
    return;
  }

  await extractInThread(bundlePath, dirname(bundlePath));
  await remove(bundlePath);
}

function extractInThread(bundlePath: string, bundleDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(EXTRACT_SOURCE, { eval: true, workerData: { admZip: requireDependency.resolve('adm-zip'), bundlePath, bundleDir } });
    worker.once('error', reject);
    worker.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Extracting ${bundlePath} ended with code ${code}`))));
  });
}
