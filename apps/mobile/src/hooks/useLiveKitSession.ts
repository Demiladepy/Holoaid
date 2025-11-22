import { useCallback, useMemo, useState } from 'react';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {}) as {
  apiBaseUrl?: string;
  livekitRoom?: string;
};

const API_BASE_URL = trimTrailingSlash(extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000');
const DEFAULT_ROOM = extra?.livekitRoom || process.env.EXPO_PUBLIC_LIVEKIT_ROOM || 'vision-nav-room';

type SessionStatus = 'idle' | 'connecting' | 'ready' | 'error';

type StartSessionInput = {
  room?: string;
  displayName?: string;
};

export const useLiveKitSession = (identity: string) => {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const room = useMemo(() => DEFAULT_ROOM, []);

  const startSession = useCallback(
    async ({ room: customRoom, displayName }: StartSessionInput = {}) => {
      setStatus('connecting');
      setError(null);
      const targetRoom = customRoom || room;

      const response = await fetch(`${API_BASE_URL}/api/livekit/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ room: targetRoom, identity, name: displayName ?? identity })
      });

      if (!response.ok) {
        const message = await response.text();
        setStatus('error');
        setError(message || 'Unable to request LiveKit token');
        throw new Error(message);
      }

      const payload = (await response.json()) as { token: string };
      setToken(payload.token);
      setStatus('ready');
    },
    [identity, room]
  );

  const stopSession = useCallback(() => {
    setToken(null);
    setStatus('idle');
  }, []);

  return {
    token,
    status,
    error,
    room,
    startSession,
    stopSession
  };
};

function trimTrailingSlash(value: string): string {
  if (!value) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
