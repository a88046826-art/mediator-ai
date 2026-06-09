export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('mediator-device-id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('mediator-device-id', id);
  }
  return id;
}
