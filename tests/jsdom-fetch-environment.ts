import { builtinEnvironments, type Environment } from 'vitest/environments'

// Keep the AbortSignal and Request implementations in the same Node realm.
// jsdom's signal is incompatible with Node 24's native fetch/Request.
export default {
  name: 'jsdom-native-fetch',
  transformMode: 'web',
  async setup(global, options) {
    const { AbortController, AbortSignal } = global
    const environment = await builtinEnvironments.jsdom.setup(global, options)
    global.AbortController = AbortController
    global.AbortSignal = AbortSignal
    return environment
  },
} satisfies Environment
