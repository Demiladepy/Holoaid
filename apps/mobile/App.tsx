import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import MapView, { LongPressEvent, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  registerGlobals,
  useTracks
} from '@livekit/react-native';
import { Track } from 'livekit-client';

import { AssistiveButton } from './src/components/AssistiveButton';
import { InfoCard } from './src/components/InfoCard';
import { StatusChip } from './src/components/StatusChip';
import { useAccessibleLocation } from './src/hooks/useAccessibleLocation';
import { useNavigationDecisions, describeNavigationCommand, type NavigationDecision } from './src/hooks/useNavigationDecisions';
import { useRouteGuidance } from './src/hooks/useRouteGuidance';
import { useLiveKitSession } from './src/hooks/useLiveKitSession';
import { palette } from './src/theme/colors';
import { speak, stopSpeech } from './src/utils/voiceAssistant';

type GuidanceMode = 'idle' | 'listening' | 'navigating';

type ExtraConfig = {
  livekitUrl?: string;
  apiBaseUrl?: string;
};

try {
  registerGlobals();
} catch {
  // no-op: registerGlobals might throw on unsupported platforms (web)
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FALLBACK_REGION: Region = {
  latitude: 37.7937,
  longitude: -122.3965,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01
};

export default function App() {
  const mapRef = useRef<MapView | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(FALLBACK_REGION);
  const [destination, setDestination] = useState<Region | null>(null);
  const [mode, setMode] = useState<GuidanceMode>('idle');
  const [isStreamingRequested, setStreamingRequested] = useState(false);
  const { status, coords, heading, errorMessage, requestPermission } = useAccessibleLocation();
  const identityRef = useRef(`walker-${Math.random().toString(36).slice(2, 10)}`);
  const extra = (Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {}) as ExtraConfig;
  const livekitUrl = extra?.livekitUrl || process.env.EXPO_PUBLIC_LIVEKIT_URL || '';
  const API_BASE_URL = trimTrailingSlash(extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || '');
  const {
    token: liveKitToken,
    status: liveKitStatus,
    error: liveKitError,
    startSession,
    stopSession,
    room
  } = useLiveKitSession(identityRef.current);
  const shouldConnect = isStreamingRequested && liveKitStatus === 'ready' && Boolean(liveKitToken && livekitUrl);
  const { decision: navigationDecision } = useNavigationDecisions({ room, enabled: shouldConnect });
  const [hasVisionUpdates, setHasVisionUpdates] = useState(false);
  const lastDecisionSequence = useRef<number | null>(null);
  const { guidance: routeGuidance } = useRouteGuidance({
    room,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    enabled: Boolean(destination && coords),
    mode: 'walking'
  });
  const lastRouteInstruction = useRef<string | null>(null);

  const persistDestination = useCallback(
    async (region: Region) => {
      if (!API_BASE_URL || !room) return;
      try {
        await fetch(`${API_BASE_URL}/api/navigation/destination`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            room,
            latitude: region.latitude,
            longitude: region.longitude,
            label: 'Pinned destination',
            requested_by: identityRef.current
          })
        });
      } catch (err) {
        console.warn('[navigation] Failed to sync destination', err);
      }
    },
    [room]
  );

  const destinationDistance = useMemo(() => {
    if (!coords || !destination) return null;
    return haversineDistance(coords.latitude, coords.longitude, destination.latitude, destination.longitude);
  }, [coords, destination]);

  const statusMessage = useMemo(() => {
    if (errorMessage) return errorMessage;
    if (status === 'denied') return 'Location permission denied. Tap to retry.';
    if (status === 'requesting') return 'Requesting location securely…';
    if (status === 'ready' && destinationDistance) {
      const rounded = Math.max(destinationDistance, 1).toFixed(0);
      return `Destination is ${rounded} meters away.`;
    }
    if (status === 'ready') return 'Location lock acquired. Long press map to drop a destination pin.';
    return 'Initializing sensors…';
  }, [destinationDistance, errorMessage, status]);

  const statusTone = useMemo<'neutral' | 'warning' | 'success'>(() => {
    if (status === 'ready') return 'success';
    if (status === 'denied' || status === 'error') return 'warning';
    return 'neutral';
  }, [status]);

  const visionWorkerStatus = useMemo(() => {
    if (!shouldConnect) {
      return { label: 'Vision worker idle', tone: 'neutral' as const };
    }
    if (!hasVisionUpdates) {
      return { label: 'Waiting for vision worker…', tone: 'warning' as const };
    }
    return { label: 'Vision worker online', tone: 'success' as const };
  }, [shouldConnect, hasVisionUpdates]);

  const streamingStatus = useMemo(() => {
    if (!shouldConnect) {
      return { label: 'Remote guardian offline', tone: 'neutral' as const };
    }
    return { label: 'Remote guardian connected', tone: 'success' as const };
  }, [shouldConnect]);

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    if (liveKitError) {
      Alert.alert('LiveKit error', liveKitError);
      setStreamingRequested(false);
    }
  }, [liveKitError]);

  useEffect(() => {
    if (!shouldConnect) {
      lastDecisionSequence.current = null;
      setHasVisionUpdates(false);
    }
  }, [shouldConnect]);

  useEffect(() => {
    if (!navigationDecision) return;
    if (lastDecisionSequence.current === navigationDecision.sequence) return;
    lastDecisionSequence.current = navigationDecision.sequence;
    setHasVisionUpdates(true);
    const spoken = navigationDecision.message ?? describeNavigationCommand(navigationDecision.command);
    speak(spoken);
  }, [navigationDecision]);

  useEffect(() => {
    if (!routeGuidance || mode !== 'navigating') return;
    if (lastRouteInstruction.current === routeGuidance.instruction) return;
    lastRouteInstruction.current = routeGuidance.instruction;
    const spoken = `${routeGuidance.instruction}. Continue for ${routeGuidance.distanceText}.`;
    speak(spoken);
  }, [routeGuidance, mode]);

  useEffect(() => {
    if (!coords) return;

    const nextRegion: Region = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008
    };

    setMapRegion(nextRegion);
    mapRef.current?.animateCamera(
      {
        center: { latitude: nextRegion.latitude, longitude: nextRegion.longitude },
        pitch: 0,
        zoom: 17,
        heading: heading ?? 0
      },
      { duration: 600 }
    );
  }, [coords, heading]);

  const handleMapLongPress = (event: LongPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const pinnedRegion: Region = {
      latitude,
      longitude,
      latitudeDelta: 0.003,
      longitudeDelta: 0.003
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDestination(pinnedRegion);
    setMode('navigating');
    speak('Destination pinned. Guidance locked in. Use announce to hear distance updates.');
    void persistDestination(pinnedRegion);
  };

  const handleAnnounceSurroundings = () => {
    if (!coords) {
      speak('Still searching for your location. Stay still or move to open space.');
      return;
    }

    const locationMessage = `You are at latitude ${coords.latitude.toFixed(4)} and longitude ${coords.longitude.toFixed(4)}.`;
    if (!destination) {
      speak(`${locationMessage} Long press the map to choose where you want to go.`);
      return;
    }

    const distance = destinationDistance ?? 0;
    const direction = describeDirection(coords.latitude, coords.longitude, destination.latitude, destination.longitude);
    const spokenDistance = distance > 1000 ? `${(distance / 1000).toFixed(2)} kilometers` : `${distance.toFixed(0)} meters`;
    speak(`${locationMessage} Destination is ${spokenDistance} away towards the ${direction}.`);
  };

  const handleDestinationPrompt = () => {
    setMode('listening');
    speak('Long press anywhere on the map to place your destination pin.');
  };

  const handleStartGuidance = () => {
    if (!destination) {
      speak('Set a destination by long pressing the map first.');
      return;
    }

    setMode('navigating');
    speak('Guidance mode engaged. Follow the vibration and voice updates while moving forward carefully.');
  };

  const handleRecenter = () => {
    stopSpeech();
    if (!coords) {
      requestPermission();
      return;
    }

    const nextRegion: Region = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008
    };

    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 400);
  };

  const handleToggleStreaming = async () => {
    if (isStreamingRequested) {
      stopSession();
      setStreamingRequested(false);
      speak('Remote guardian disconnected.');
      return;
    }

    try {
      await startSession({ displayName: `Explorer ${identityRef.current}` });
      setStreamingRequested(true);
      speak('Remote guardian connected. Streaming has started.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start remote guardian stream';
      Alert.alert('LiveKit connection failed', message);
    }
  };

  const streamingLabel = streamingStatus.label;

  const content = (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          initialRegion={FALLBACK_REGION}
          region={mapRegion}
          onRegionChangeComplete={(region) => setMapRegion(region)}
          onLongPress={handleMapLongPress}
          showsUserLocation
          showsCompass
          showsScale
          accessibilityLabel="Live map view"
        >
          {destination ? (
            <Marker
              coordinate={destination}
              pinColor={palette.accent}
              title="Destination"
              description="Pinned guidance target"
            />
          ) : null}
        </MapView>

        <View style={styles.topOverlay}>
          <View style={styles.statusStack}>
            <StatusChip label={statusMessage} tone={statusTone} />
            <StatusChip label={visionWorkerStatus.label} tone={visionWorkerStatus.tone} />
          </View>
          <Text style={styles.modeLabel}>{describeMode(mode)}</Text>
        </View>

        {shouldConnect ? <RoomView /> : null}

        <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter} accessibilityLabel="Recenter on my position">
          <MaterialIcons name="my-location" size={22} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSheet}>
        <InfoCard title="Navigation Hub" caption="Long press map to set destination">
          <Text style={styles.infoText}>{statusMessage}</Text>
          {destinationDistance ? (
            <Text style={styles.infoText}>
              Distance: <Text style={styles.infoEmphasis}>{destinationDistance.toFixed(0)} m</Text>
            </Text>
          ) : null}
          <Text style={styles.infoText}>
            Vision: <Text style={styles.infoEmphasis}>{visionWorkerStatus.label}</Text>
          </Text>
          <Text style={styles.infoText}>
            Stream: <Text style={styles.infoEmphasis}>{streamingLabel}</Text>
          </Text>
          {navigationDecision ? (
            <Text style={styles.infoText}>
              Instruction: <Text style={styles.infoEmphasis}>{formatNavigationDecision(navigationDecision)}</Text>
            </Text>
          ) : null}
          {routeGuidance ? (
            <Text style={styles.infoText}>
              Route: <Text style={styles.infoEmphasis}>{routeGuidance.instruction}</Text>
            </Text>
          ) : null}
        </InfoCard>

        <AssistiveButton
          label="Announce surroundings"
          description="Hear your current coordinates and destination direction"
          icon={<MaterialIcons name="campaign" size={24} color={palette.textPrimary} />}
          onPress={handleAnnounceSurroundings}
        />

        <AssistiveButton
          label="Set destination"
          description="Long press the map after this prompt"
          icon={<MaterialIcons name="add-location-alt" size={24} color={palette.textPrimary} />}
          onPress={handleDestinationPrompt}
          tone="secondary"
        />

        <AssistiveButton
          label="Start guidance"
          description="Receive continuous cues while moving"
          icon={<MaterialIcons name="assistant-navigation" size={24} color={palette.textPrimary} />}
          onPress={handleStartGuidance}
          disabled={!destination}
        />

        <AssistiveButton
          label={shouldConnect ? 'Stop remote guardian stream' : 'Start remote guardian stream'}
          description="Share your camera with a remote supervisor for obstacle alerts"
          icon={<MaterialIcons name="personal-video" size={24} color={palette.textPrimary} />}
          onPress={handleToggleStreaming}
          tone="secondary"
        />
      </View>
    </SafeAreaView>
  );

  if (!livekitUrl) {
    return content;
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={liveKitToken ?? ''}
      connect={shouldConnect}
      audio
      video
      options={{ adaptiveStream: { pixelDensity: 'screen' } }}
    >
      {content}
    </LiveKitRoom>
  );
}

const RoomView = () => {
  const tracks = useTracks([Track.Source.Camera]);

  const renderTrack = ({ item }: { item: typeof tracks[number] }) => {
    if (isTrackReference(item)) {
      return <VideoTrack trackRef={item} style={styles.participantView} />;
    }
    return <View style={[styles.participantView, styles.participantPlaceholder]} />;
  };

  return (
    <View style={styles.streamPreview} pointerEvents="none">
      <FlatList
        data={tracks}
        keyExtractor={(item, index) => {
          const ref = item as any;
          const identifier = ref?.publicationSid ?? ref?.trackSid ?? ref?.participant?.identity ?? `participant-${index}`;
          return String(identifier);
        }}
        renderItem={renderTrack}
        horizontal
        showsHorizontalScrollIndicator={false}
        ListEmptyComponent={<View style={[styles.participantView, styles.participantPlaceholder]} />}
      />
    </View>
  );
};

function describeMode(mode: GuidanceMode) {
  switch (mode) {
    case 'listening':
      return 'Pin placement mode active';
    case 'navigating':
      return 'Guiding you safely';
    default:
      return 'Standing by';
  }
}

function formatNavigationDecision(decision: NavigationDecision | null) {
  if (!decision) return '';
  return decision.message ?? describeNavigationCommand(decision.command);
}

function describeDirection(lat1: number, lon1: number, lat2: number, lon2: number) {
  const bearing = calculateBearing(lat1, lon1, lat2, lon2);
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const index = Math.round(bearing / 45) % directions.length;
  return directions[index];
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function trimTrailingSlash(value: string): string {
  if (!value) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  mapWrapper: {
    flex: 1
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 24,
    left: 20,
    right: 20,
    zIndex: 10,
    gap: 12
  },
  statusStack: {
    gap: 8
  },
  modeLabel: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  recenterButton: {
    position: 'absolute',
    bottom: Dimensions.get('window').height * 0.3,
    right: 18,
    padding: 12,
    borderRadius: 999,
    backgroundColor: '#111827ee'
  },
  bottomSheet: {
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20
  },
  streamPreview: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 24,
    right: 16
  },
  participantView: {
    width: 160,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    marginLeft: 8,
    overflow: 'hidden'
  },
  participantPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  infoText: {
    color: palette.textSecondary,
    fontSize: 14,
    marginBottom: 4
  },
  infoEmphasis: {
    color: palette.textPrimary,
    fontWeight: '700'
  }
});
