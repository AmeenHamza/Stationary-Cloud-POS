import { isEventType, type EventType } from '@pos/contracts';

/** What travels on a Redis channel and, reshaped, to subscribed sockets (API.md §7). */
export interface EventEnvelope {
  seq: string;
  type: EventType;
  schemaVersion: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export function encodeEnvelope(envelope: EventEnvelope): string {
  return JSON.stringify(envelope);
}

/** Parses a channel message; malformed or unknown messages are ignored (returns null). */
export function decodeEnvelope(message: string): EventEnvelope | null {
  try {
    const value = JSON.parse(message) as Record<string, unknown>;
    const valid =
      typeof value['seq'] === 'string' &&
      typeof value['type'] === 'string' &&
      isEventType(value['type']) &&
      typeof value['schemaVersion'] === 'number' &&
      typeof value['occurredAt'] === 'string' &&
      typeof value['payload'] === 'object' &&
      value['payload'] !== null;
    return valid ? (value as unknown as EventEnvelope) : null;
  } catch {
    return null;
  }
}
