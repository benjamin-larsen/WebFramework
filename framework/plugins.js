import { enableRenderTiming } from './render/index.js';
import { getCurrentInstance } from './effect.js';

export const plugins = new Set();

const globalPluginContext = Object.freeze({ enableRenderTiming });

export function usePlugin(plugin, ...args) {
  if (getCurrentInstance()) throw Error("Can't use plugin within Component.");
  if (plugins.has(plugin)) throw Error('Plugin already exists');
  plugins.add(plugin);
  plugin(globalPluginContext, ...args);
}
