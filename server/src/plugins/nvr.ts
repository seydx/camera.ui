import { PluginsService } from '../api/services/plugins.service.js';
import { NamespaceManager } from '../rpc/namespaces.js';

export const NVR_PLUGIN_NAMES = ['@camera.ui/camera-ui-nvr'];

export function isNvrPluginName(pluginName: string): boolean {
  return NVR_PLUGIN_NAMES.includes(pluginName);
}

export function nvrRpcNamespace(): string | undefined {
  const plugins = new PluginsService();

  for (const name of NVR_PLUGIN_NAMES) {
    const plugin = plugins.getPluginByName(name);
    if (plugin?.worker.isRunning()) {
      return NamespaceManager.pluginNamespaces(plugin.id).pluginChildRpc;
    }
  }

  return undefined;
}
