export {};

declare global {
  interface Window {
    __rush_ws?: WebSocket;
    __rush_ws_url?: string;
  }
}
