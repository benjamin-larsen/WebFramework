import { enableRenderTiming } from './render/index.js'

export const plugins = new Set();

const globalPluginContext = Object.freeze({
  enableRenderTiming
})

export function usePlugin(plugin) {
  if (plugins.has(plugin)) throw Error("Plugin already exists");
  plugins.add(plugin)
  plugin(globalPluginContext)
}