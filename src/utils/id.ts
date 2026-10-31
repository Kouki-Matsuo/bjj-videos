// 一意のIDを作ります。
// crypto.randomUUID は https でしか使えないため、iPhoneから http://192.168.x.x で
// 開いたときのために代わりの作り方も用意しています。
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
