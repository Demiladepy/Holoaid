import { useCallback, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {}) as {
  apiBaseUrl?: string;
};

const API_BASE_URL = trimTrailingSlash(extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || '');

export type RouteGuidance = {
  summary?: string | null;
  instruction: string;
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
  fetchedAt: string;
};

export type RouteGuidanceOptions = {
  room?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  mode?: string;
};

export const useRouteGuidance = ({
  room,
  latitude,
  longitude,
  enabled = false,
  pollIntervalMs = 5000,
  mode
}: RouteGuidanceOptions) => {
  const [guidance, setGuidance] = useState<RouteGuidance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const canPoll = useMemo(() => Boolean(API_BASE_URL && room && enabled && latitude != null && longitude != null), [enabled, room, latitude, longitude]);

  const fetchGuidance = useCallback(async () => {
    if (!API_BASE_URL || !room || latitude == null || longitude == null) {
      return;
    }
    try {
      setIsPolling(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/navigation/directions/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room,
          latitude,
          longitude,
          mode
        })
      });
      if (!response.ok) {
        const message = (await response.text()) || 'Unable to fetch route guidance';
        throw new Error(message);
      }
      const payload = (await response.json()) as ApiRouteGuidance;
      setGuidance(normalizeRouteGuidance(payload));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Route guidance failed';
      setError(message);
    } finally {
      setIsPolling(false);
    }
  }, [room, latitude, longitude, mode]);

  useEffect(() => {
    if (!canPoll) {
      setGuidance(null);
      return;
    }
    fetchGuidance();
    const interval = setInterval(fetchGuidance, pollIntervalMs);
    return () => clearInterval(interval);
  }, [canPoll, fetchGuidance, pollIntervalMs]);

  return {
    guidance,
    error,
    isPolling,
    ready: canPoll
  } as const;
};

type ApiRouteGuidance = {
  summary?: string | null;
  total_distance_meters: number;
  total_duration_seconds: number;
  next_step: {
    instruction: string;
    distance_meters: number;
    distance_text: string;
    duration_seconds: number;
    duration_text: string;
    travel_mode: string;
  };
  destination_latitude: number;
  destination_longitude: number;
  fetched_at: string;
};

function normalizeRouteGuidance(payload: ApiRouteGuidance): RouteGuidance {
  return {
    summary: payload.summary,
    instruction: payload.next_step.instruction,
    distanceText: payload.next_step.distance_text,
    distanceMeters: payload.next_step.distance_meters,
    durationText: payload.next_step.duration_text,
    durationSeconds: payload.next_step.duration_seconds,
    fetchedAt: payload.fetched_at
  };
}

function trimTrailingSlash(value: string): string {
  if (!value) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
