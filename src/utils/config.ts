export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws-chess`;
}

export const AI_CONFIG = {
  // Настройки AI вынесены локально (используется Gemini API, как и в остальном проекте)
  API_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  API_MODEL: 'gemini-2.5-flash',
};
