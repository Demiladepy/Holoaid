const audioMap: Record<string, string> = {
  person: "/sounds/person.mp3",
  car: "/sounds/car.mp3",
  dog: "/sounds/dog.mp3",
};

export const playAudioCue = (label: string): void => {
  const soundPath = audioMap[label];
  if (!soundPath) return; // ✅ Prevent playing undefined sounds

  const audio = new Audio(soundPath);
  audio.volume = 0.4;

  // Catch play errors (e.g., browser autoplay policy)
  audio.play().catch(() => {});
};

export const speak = (text: string): void => {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis not supported in this browser.");
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 1; // You can adjust speed (0.1–10)
  utter.pitch = 1; // Normal tone
  speechSynthesis.speak(utter);
};
