import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type LocationStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export interface AccessibleLocationOptions {
  highAccuracy?: boolean;
  timeInterval?: number;
  distanceInterval?: number;
}

export interface AccessibleLocationResult {
  status: LocationStatus;
  coords: Location.LocationObjectCoords | null;
  heading: number | null;
  errorMessage: string | null;
  requestPermission: () => Promise<void>;
}

const defaultOptions: Required<AccessibleLocationOptions> = {
  highAccuracy: true,
  timeInterval: 4000,
  distanceInterval: 2
};

export function useAccessibleLocation(
  options?: AccessibleLocationOptions
): AccessibleLocationResult {
  const mergedOptions = useMemo(
    () => ({
      ...defaultOptions,
      ...options
    }),
    [options?.distanceInterval, options?.highAccuracy, options?.timeInterval]
  );
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  const cleanupWatcher = useCallback(() => {
    if (watcher.current) {
      watcher.current.remove();
      watcher.current = null;
    }
  }, []);

  const startWatcher = useCallback(async () => {
    cleanupWatcher();

    watcher.current = await Location.watchPositionAsync(
      {
        accuracy: mergedOptions.highAccuracy
          ? Location.Accuracy.Highest
          : Location.Accuracy.Balanced,
        timeInterval: mergedOptions.timeInterval,
        distanceInterval: mergedOptions.distanceInterval
      },
      (location) => {
        setCoords(location.coords);
        setHeading(location.coords.heading ?? null);
        setStatus('ready');
      }
    );
  }, [cleanupWatcher, mergedOptions.distanceInterval, mergedOptions.highAccuracy, mergedOptions.timeInterval]);

  const requestPermission = useCallback(async () => {
    try {
      setStatus('requesting');
      setErrorMessage(null);
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();

      if (permissionStatus !== Location.PermissionStatus.GRANTED) {
        setStatus('denied');
        setErrorMessage('Location access is required for navigation.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      setCoords(currentLocation.coords);
      setHeading(currentLocation.coords.heading ?? null);
      setStatus('ready');

      await startWatcher();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch location');
    }
  }, [startWatcher]);

  useEffect(() => {
    requestPermission();

    return () => {
      cleanupWatcher();
    };
  }, [cleanupWatcher, requestPermission]);

  return {
    status,
    coords,
    heading,
    errorMessage,
    requestPermission
  };
}
