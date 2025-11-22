import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

export class SpeechPlaybackAbortedError extends Error {
  constructor(message = 'Server speech playback aborted') {
    super(message);
    this.name = 'SpeechPlaybackAbortedError';
  }
}

const extra = (Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {}) as {
  apiBaseUrl?: string;
};

const API_BASE_URL = trimTrailingSlash(extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || '');

type AudioPlayer = {
  play: () => void | Promise<void>;
  pause: () => void;
  playing: boolean;
  currentTime: number;
};

let currentPlayer: AudioPlayer | null = null;
let currentFileUri: string | null = null;
let playbackWatcher: NodeJS.Timeout | null = null;
let playbackDeferred: { resolve: () => void; reject: (error: Error) => void } | null = null;

export async function speakViaServer(text: string) {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL.');
  }

  await stopServerSpeech();

  const response = await fetch(`${API_BASE_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to fetch server speech');
  }

  const payload = (await response.json()) as { audio_content: string; audio_mime: string };
  const extension = mimeToExtension(payload.audio_mime);
  const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.${extension}`;

  await FileSystem.writeAsStringAsync(fileUri, payload.audio_content, {
    encoding: FileSystem.EncodingType.Base64
  });

  currentFileUri = fileUri;

  const { createAudioPlayer } = await import('expo-audio');
  const player = createAudioPlayer(fileUri) as AudioPlayer;
  currentPlayer = player;

  return new Promise<void>((resolve, reject) => {
    playbackDeferred = { resolve, reject };
    startWatcher(player);

    try {
      const maybePromise = player.play();
      if (maybePromise instanceof Promise) {
        maybePromise.catch((error) => settlePlayback(toError(error)));
      }
    } catch (error) {
      settlePlayback(toError(error));
    }
  });
}

export async function stopServerSpeech(reason = 'Server speech stopped') {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
    } catch {
      // ignore pause errors
    }
  }

  await settlePlayback(new SpeechPlaybackAbortedError(reason));
}

function startWatcher(player: AudioPlayer) {
  clearWatcher();
  playbackWatcher = setInterval(() => {
    if (player.playing === false && player.currentTime > 0) {
      settlePlayback();
    }
  }, 120);
}

function clearWatcher() {
  if (playbackWatcher) {
    clearInterval(playbackWatcher);
    playbackWatcher = null;
  }
}

async function settlePlayback(error?: Error) {
  const deferred = playbackDeferred;
  playbackDeferred = null;
  clearWatcher();

  if (error && deferred) {
    deferred.reject(error);
  } else if (deferred) {
    deferred.resolve();
  }

  await cleanup();
}

async function cleanup() {
  currentPlayer = null;
  if (currentFileUri) {
    await FileSystem.deleteAsync(currentFileUri, { idempotent: true }).catch(() => undefined);
    currentFileUri = null;
  }
}

function toError(value: unknown) {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error('Unknown playback error');
}

function trimTrailingSlash(value: string): string {
  if (!value) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function mimeToExtension(mime: string) {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'mp3';
}