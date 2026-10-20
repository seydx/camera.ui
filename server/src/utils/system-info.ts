import { PromiseTimeout } from '@camera.ui/common/utils';
import { readdirSync, readFileSync } from 'node:fs';
import * as si from 'systeminformation';

export interface SystemInfo {
  cpu: string;
  cores: number;
  memoryGb: number;
  gpu?: string;
  os: string;
  version: string;
}

export async function collectSystemInfo(version: string): Promise<SystemInfo> {
  const [cpu, memory, os, graphics] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    PromiseTimeout(si.graphics(), 5000, undefined, 'graphics lookup timed out').catch(() => undefined),
  ]);
  const gpu = graphics?.controllers.map((controller) => gpuName(controller.vendor, controller.model)).filter(Boolean);

  return {
    cpu: [cpu.manufacturer, cpu.brand].filter(Boolean).join(' '),
    cores: cpu.cores,
    memoryGb: Math.round((memory.total / 1024 ** 3) * 10) / 10,
    gpu: gpu?.length ? gpu.join(', ') : drmGpus(),
    os: [os.distro, os.release, `(${os.platform} ${os.arch})`].filter(Boolean).join(' '),
    version,
  };
}

function gpuName(vendor?: string, model?: string): string {
  const name = model?.trim() ?? '';
  const maker = vendor?.trim() ?? '';
  if (!maker || name.toLowerCase().startsWith(maker.toLowerCase())) return name || maker;
  return `${maker} ${name}`.trim();
}

function drmGpus(): string | undefined {
  const vendors: Record<string, string> = { 8086: 'Intel', '10de': 'NVIDIA', 1002: 'AMD', '1af4': 'Virtio' };

  try {
    const cards = readdirSync('/sys/class/drm').filter((entry) => /^card\d+$/.test(entry));
    const names = cards
      .map((card) => {
        const uevent = readFileSync(`/sys/class/drm/${card}/device/uevent`, 'utf8');
        const driver = /DRIVER=(.+)/.exec(uevent)?.[1];
        const pciId = /PCI_ID=([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})/.exec(uevent);
        if (!pciId) return undefined;
        return [vendors[pciId[1].toLowerCase()] ?? pciId[1], driver, `[${pciId[1]}:${pciId[2]}]`].filter(Boolean).join(' ');
      })
      .filter((name): name is string => Boolean(name));

    return names.length ? [...new Set(names)].join(', ') : undefined;
  } catch {
    return undefined;
  }
}
