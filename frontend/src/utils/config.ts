export function getWebSocketUrl(): string {
  if (import.meta.env['VITE_WS_URL']) {
    return import.meta.env['VITE_WS_URL'];
  }

  // Fallback to dynamic URL based on current hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8080/ws-chess`;
}
