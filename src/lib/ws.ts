import { API_BASE_URL } from "@/lib/api";

type Listener = () => void;

export interface RealtimeEvent {
  resource: string;
  client_id?: number | null;
  [key: string]: unknown;
}

type RawListener = (event: RealtimeEvent) => void;

const RECONNECTED_EVENT = "__reconnected__";
const MAX_BACKOFF_MS = 10_000;

class RealtimeSocket {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private rawListeners = new Set<RawListener>();
  private backoffMs = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hasConnectedBefore = false;
  private closedByUser = false;

  connect(token: string) {
    this.token = token;
    this.closedByUser = false;
    this.open();
  }

  disconnect() {
    this.closedByUser = true;
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.hasConnectedBefore = false;
  }

  subscribe(resource: string, listener: Listener): () => void {
    if (!this.listeners.has(resource)) this.listeners.set(resource, new Set());
    this.listeners.get(resource)!.add(listener);
    return () => {
      this.listeners.get(resource)?.delete(listener);
    };
  }

  /** Receives every parsed event as-is, in addition to the resource-keyed subscribers above. */
  subscribeRaw(listener: RawListener): () => void {
    this.rawListeners.add(listener);
    return () => {
      this.rawListeners.delete(listener);
    };
  }

  private open() {
    if (!this.token) return;
    const wsBase = API_BASE_URL.replace(/^http/, "ws");
    this.socket = new WebSocket(`${wsBase}/api/ws?token=${encodeURIComponent(this.token)}`);

    this.socket.onopen = () => {
      this.backoffMs = 1000;
      if (this.hasConnectedBefore) this.emit(RECONNECTED_EVENT);
      this.hasConnectedBefore = true;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.resource) {
          this.emit(data.resource);
          this.rawListeners.forEach((listener) => listener(data));
        }
      } catch {
        // ignore malformed frames
      }
    };

    this.socket.onclose = () => {
      if (this.closedByUser) return;
      this.reconnectTimer = setTimeout(() => this.open(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private emit(resource: string) {
    this.listeners.get(resource)?.forEach((listener) => listener());
  }
}

export const realtimeSocket = new RealtimeSocket();
export { RECONNECTED_EVENT };
