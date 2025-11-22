import { useCallback, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {}) as {
  apiBaseUrl?: string;
};

const API_BASE_URL = trimTrailingSlash(extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || '');

export type NavigationCommand = 'MOVE_FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'STOP';

export type NavigationDecision = {
  sequence: number;
  room: string;
  command: NavigationCommand;
  message?: string | null;
  confidence?: number | null;
  source?: string | null;
  createdAt: string;
  expiresAt: string;
};

type ApiDecision = {
  sequence: number;
  room: string;
  command: NavigationCommand;
  message?: string | null;
  confidence?: number | null;
  source?: string | null;
  created_at: string;
  expires_at: string;
};

type Options = {
  room?: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
};

export const useNavigationDecisions = ({ room, enabled = false, pollIntervalMs = 2000 }: Options) => {
  const [decision, setDecision] = useState<NavigationDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const canPoll = useMemo(() => Boolean(API_BASE_URL && room && enabled), [enabled, room]);

  const fetchLatest = useCallback(async () => {
    if (!API_BASE_URL || !room) {
      return;
    }
    try {
      setIsPolling(true);
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/navigation/decision/latest?room=${encodeURIComponent(room)}`
      );
      if (response.status === 404) {
        setDecision(null);
        return;
      }
      if (!response.ok) {
        throw new Error((await response.text()) || 'Unable to fetch navigation decision');
      }
      const payload = (await response.json()) as ApiDecision;
      setDecision(normalizeDecision(payload));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Navigation poll failed';
      setError(message);
    } finally {
      setIsPolling(false);
    }
  }, [room]);

  useEffect(() => {
    if (!canPoll) {
      setDecision(null);
      return;
    }
    fetchLatest();
    const interval = setInterval(fetchLatest, pollIntervalMs);
    return () => clearInterval(interval);
  }, [canPoll, fetchLatest, pollIntervalMs]);

  return {
    decision,
    error,
    isPolling,
    ready: canPoll
  } as const;
};

export function describeNavigationCommand(command: NavigationCommand): string {
  switch (command) {
    case 'MOVE_FORWARD':
      return 'Clear path ahead';
    case 'TURN_LEFT':
      return 'Obstacle ahead, veer left';
    case 'TURN_RIGHT':
      return 'Obstacle ahead, veer right';
    case 'STOP':
    default:
      return 'Stop immediately';
  }
}

function normalizeDecision(payload: ApiDecision): NavigationDecision {
  return {
    sequence: payload.sequence,
    room: payload.room,
    command: payload.command,
    message: payload.message,
    confidence: payload.confidence,
    source: payload.source,
    createdAt: payload.created_at,
    expiresAt: payload.expires_at
  };
}

function trimTrailingSlash(value: string): string {
  if (!value) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
