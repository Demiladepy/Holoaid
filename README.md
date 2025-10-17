**🩺✨ HoloAid — AI-Powered Vision Assistant**

“Turning your camera into a voice that sees.”

HoloAid is a futuristic AI-powered vision assistant that helps users understand their surroundings in real time.
It uses computer vision, speech synthesis, and intelligent narration to describe what your camera sees — creating an immersive, assistive experience that works both online and offline.

🚀 Overview

HoloAid captures live camera input, detects objects using on-device AI, and narrates them aloud — giving users an augmented sense of perception.

When connected to the internet, it can use Gemini Vision for richer scene understanding.
When offline, it seamlessly falls back to TensorFlow.js (COCO-SSD) to detect objects directly in the browser.

It’s designed for accessibility, innovation, and human-AI interaction, making it perfect for hackathons, research, and assistive technology demos.

🧠 Core Features
Feature	Description
🎥 Live Object Detection	Real-time object detection via TensorFlow.js (COCO-SSD)
🧩 AI Narration	Converts visual information into natural spoken feedback
⚡ Offline Capability	Works fully offline using on-device ML models
🌐 Online Enhancement	Optional Gemini Vision API for deeper scene understanding
🔊 Audio Feedback	Voice narration + optional sound cues for detected objects
🌙 Dark Mode	Sleek interface that adapts to light/dark themes
✨ Holographic UI	Floating glowing boxes, smooth transitions, and elegant effects
🧱 No Backend Required	Everything runs locally — no servers, no setup hassles
🧩 Architecture
🧭 Data Flow
[Camera Input]
      ↓
TensorFlow.js or Gemini Vision
      ↓
AI Object Recognition
      ↓
Text-to-Speech Narration
      ↓
User Hears Description

🧱 Frontend Stack
Function	Technology
Framework	React (Vite + TypeScript)
Styling	Tailwind CSS + Framer Motion
AI Engine	TensorFlow.js (COCO-SSD) + Gemini Vision API
Speech	Web Speech API (TTS)
Theming	next-themes (dark/light mode)
Optional	Three.js (for holographic visuals)
🗂️ Folder Structure
src/
├── assets/
├── components/
│   ├── camera/
│   │   └── CameraFeed.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── ThemeToggle.tsx
│   ├── vision/
│   │   └── VisionProcessor.ts
│   ├── tts/
│   │   └── SpeechEngine.ts
│   └── layout/
│       └── Navbar.tsx
├── hooks/
│   ├── useCamera.ts
│   ├── useSpeech.ts
│   └── useGeminiVision.ts
├── styles/
│   └── globals.css
├── App.tsx
├── main.tsx
└── index.html

⚙️ Installation & Setup
1️⃣ Clone the repository
git clone https://github.com/your-username/holoaid.git
cd holoaid

2️⃣ Install dependencies
npm install

3️⃣ Add environment variables (optional for Gemini)

Create a .env file and add your Gemini API key:

VITE_GEMINI_API_KEY=your_api_key_here

4️⃣ Run the app
npm run dev

5️⃣ Open your browser

Visit 👉 http://localhost:5173

📦 Required Packages
npm install react react-dom framer-motion tailwindcss @tensorflow/tfjs @tensorflow-models/coco-ssd
npm install next-themes lucide-react class-variance-authority clsx


Optional (for 3D visuals):

npm install three @react-three/fiber @react-three/drei

🧩 Example: Object Detection Logic
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

const detectObjects = async (video: HTMLVideoElement) => {
  const model = await cocoSsd.load();
  const predictions = await model.detect(video);
  return predictions; // [{ class: 'person', score: 0.92, bbox: [x, y, w, h] }]
};

💬 Example: Speech Narration
const speak = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.1;
  speechSynthesis.speak(utterance);
};

🎨 Design Philosophy

“Accessibility meets futurism.”

HoloAid merges function and aesthetics — with glowing interfaces, fluid transitions, and intuitive audio feedback.
It’s designed to feel alive, like an assistant that not only works — but communicates naturally.

🧭 Future Enhancements

🗣️ Conversational AI layer (voice Q&A about objects)

📍 Spatial awareness using AR / depth sensors

🧱 Mobile app port (React Native + Expo)

🔐 User preferences saved locally

🌐 Multi-language narration support

🧑‍💻 Author

👤 Demilade Ayeku
Frontend Engineer • AI Enthusiast • Creator of HoloAid
📧 ayekudemilade43@gmail.com

🌐 Portfolio

🏁 License

MIT License © 2025 Demilade Ayeku
Feel free to use, remix, and build upon HoloAid — just give credit 💡
