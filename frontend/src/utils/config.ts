export function getWebSocketUrl(): string {
  // Angular doesn't use import.meta.env
  // Fallback to dynamic URL based on current hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8080/ws-chess`;
}
