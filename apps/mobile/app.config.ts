import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'Vision Navigation';
const APP_SLUG = 'vision-navigation';
const ANDROID_PACKAGE = 'com.enoch015.visionnavigation';
const IOS_BUNDLE = 'com.enoch015.visionnavigation';
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '959e3ccb-0026-4658-a12f-0f8d275bb5bd';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://fictional-guacamole-wr7x9vvw96jphvj66-8000.app.github.dev/';
const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? 'AIzaSyDZEhNSz-qC6eMLY6z7c1TI-jWOvf0UczI';
const DEFAULT_ROOM = process.env.EXPO_PUBLIC_LIVEKIT_ROOM ?? 'vision-nav-room';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: 'visionnav',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: false,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#030712'
  },
  updates: {
    url: 'https://u.expo.dev/959e3ccb-0026-4658-a12f-0f8d275bb5bd'
  },
  runtimeVersion: {
    policy: 'appVersion'
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: IOS_BUNDLE,
    config: {
      googleMapsApiKey: GOOGLE_MAPS_API_KEY
    },
    infoPlist: {
      NSCameraUsageDescription: 'Vision Navigation uses the camera to stream video for remote supervision.',
      NSMicrophoneUsageDescription: 'Microphone access is required to share ambient audio cues with your guide.'
    }
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#030712'
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'FOREGROUND_SERVICE',
      'CAMERA',
      'RECORD_AUDIO'
    ],
    config: {
      googleMaps: {
        apiKey: GOOGLE_MAPS_API_KEY
      }
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    newArchEnabled: false
  },
  web: {
    favicon: './assets/favicon.png'
  },
  experiments: {
    typedRoutes: false
  },
  extra: {
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    apiBaseUrl: API_BASE_URL,
    livekitUrl: LIVEKIT_URL,
    livekitRoom: DEFAULT_ROOM,
    eas: {
      projectId: EAS_PROJECT_ID
    }
  }
});