const encoder = new TextEncoder()
function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)) }
function unbase64(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)) }
export function randomSecret() { return base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') }
export async function digest(value: string) {
  return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
async function key(secret: string) {
  const raw = unbase64(secret)
  if (raw.length !== 32) throw new Error('Invalid encryption configuration')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function encrypt(value: string, secret: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, await key(secret), encoder.encode(value))
  return `v1.${base64(iv)}.${base64(new Uint8Array(encrypted))}`
}
export async function decrypt(value: string, secret: string, context: string) {
  const [version, iv, encrypted] = value.split('.')
  if (version !== 'v1') throw new Error('Invalid encrypted token')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: encoder.encode(context) }, await key(secret), unbase64(encrypted))
  return new TextDecoder().decode(plain)
}
