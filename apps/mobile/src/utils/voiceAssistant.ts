import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';

import { speakViaServer, stopServerSpeech } from './serverSpeech';

const VOICE_OPTIONS: Speech.SpeechOptions = {
  language: 'en-US',
  pitch: 1.1,
  rate: 0.95
};

const extra = (Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {}) as {
  apiBaseUrl?: string;
};

const SERVER_SPEECH_ENABLED = Boolean(extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL);
const DEFAULT_DEDUPE_WINDOW_MS = 4000;

type SpeakOptions = {
  /** Immediately play this announcement ahead of the queue. */
  priority?: 'normal' | 'high';
  /** Flush any queued phrases before enqueueing this one. */
  flushExisting?: boolean;
  /** Allow duplicates even if we recently spoke the same phrase. */
  allowDuplicates?: boolean;
  /** Override dedupe window (ms). */
  dedupeWindowMs?: number;
};

type QueueItem = {
  id: number;
  message: string;
  normalized: string;
  options: SpeakOptions;
  resolve: () => void;
  reject: (error: Error) => void;
};

class SpeechQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private currentItem: QueueItem | null = null;
  private interrupted = false;
  private lastSpoken: { normalized: string; timestamp: number } | null = null;
  private counter = 0;

  enqueue(message: string, options: SpeakOptions = {}) {
    const normalized = normalizeMessage(message);
    const dedupeWindow = options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;

    if (!options.allowDuplicates && this.shouldSkip(normalized, dedupeWindow)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const item: QueueItem = {
        id: ++this.counter,
        message,
        normalized,
        options,
        resolve,
        reject
      };

      if (options.flushExisting) {
        this.queue = [];
      }

      if (options.priority === 'high') {
        this.queue.unshift(item);
      } else {
        this.queue.push(item);
      }

      this.process();
    });
  }

  async stop() {
    this.interrupted = true;
    this.queue = [];
    this.currentItem = null;
    this.processing = false;
    this.lastSpoken = null;
    try {
      await stopServerSpeech();
    } catch {
      // ignore
    }
    Speech.stop();
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length && !this.interrupted) {
      const next = this.queue.shift()!;
      this.currentItem = next;

      try {
        await this.performSpeech(next.message);
        this.lastSpoken = { normalized: next.normalized, timestamp: Date.now() };
        next.resolve();
      } catch (error) {
        next.reject(error instanceof Error ? error : new Error('Speech playback interrupted'));
      } finally {
        this.currentItem = null;
      }
    }

    this.processing = false;
    this.interrupted = false;
  }

  private shouldSkip(normalized: string, dedupeWindow: number) {
    const now = Date.now();

    if (this.currentItem?.normalized === normalized) return true;
    if (this.queue.some((item) => item.normalized === normalized)) return true;
    if (this.lastSpoken && this.lastSpoken.normalized === normalized && now - this.lastSpoken.timestamp < dedupeWindow) {
      return true;
    }

    return false;
  }

  private async performSpeech(message: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    if (SERVER_SPEECH_ENABLED) {
      try {
        await speakViaServer(message);
        return;
      } catch (error) {
        console.warn('[voiceAssistant] Server speech failed, falling back to Expo Speech:', error);
      }
    }

    await this.performExpoSpeech(message);
  }

  private performExpoSpeech(message: string) {
    return new Promise<void>((resolve, reject) => {
      Speech.stop();
      Speech.speak(message, {
        ...VOICE_OPTIONS,
        onDone: resolve,
        onStopped: () => reject(new Error('Speech stopped')),
        onError: (error) => reject(error instanceof Error ? error : new Error(String(error)))
      });
    });
  }
}

const queue = new SpeechQueue();

export function speak(message: string, options?: SpeakOptions) {
  return queue.enqueue(message, options);
}

export function stopSpeech() {
  return queue.stop();
}

function normalizeMessage(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
