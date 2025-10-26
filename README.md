**🩺✨ HoloAid — AI-Powered Vision Assistant**

“Turning your camera into a voice that sees.”

HoloAid is a futuristic AI-powered vision assistant that helps users understand their surroundings in real time.
It uses computer vision, speech synthesis, and intelligent narration to describe what your camera sees — creating an immersive, assistive experience that works both online and offline.

**🚀 Overview**

HoloAid captures live camera input, detects objects using on-device AI, and narrates them aloud — giving users an augmented sense of perception.

🌐 Online Mode: Uses Gemini Vision API for deeper scene understanding.

⚡ Offline Mode: Falls back to TensorFlow.js (COCO-SSD) for in-browser detection.

🧠 Designed for accessibility, innovation, and human-AI interaction — perfect for hackathons, research, and assistive tech projects.

**🧠 Core Features**

Feature	Description
🎥 Live Object Detection	Real-time detection using TensorFlow.js (COCO-SSD).
🧩 AI Narration	Converts visual data into spoken feedback.
⚡ Offline Capability	Works fully offline using local ML models.
🌐 Online Enhancement	Uses Gemini Vision for deeper scene analysis.
🔊 Audio Feedback	Voice narration + optional sound cues.
🌙 Dark Mode	Switchable via next-themes or Tailwind classes.
✨ Holographic UI	Glowing effects, smooth transitions, and fluid motion.
🧱 No Backend Needed	Everything runs locally in the browser.
🧩 System Architecture
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

**🧱 Tech Stack**

Function	Technology
Framework	React (Vite + TypeScript)
Styling	Tailwind CSS + Framer Motion
AI Engine	TensorFlow.js (COCO-SSD) + Gemini Vision API
Speech	Web Speech API (Text-to-Speech)
Theming	next-themes (Dark/Light Mode)
Optional	Three.js (for holographic 3D visuals)

**🗂️ Folder Structure**

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

**⚙️ Installation & Setup**

1️⃣ Clone the Repository
git clone https://github.com/your-username/holoaid.git
cd holoaid

2️⃣ Install Dependencies
npm install

3️⃣ (Optional) Add Gemini API Key

Create a .env file in your root directory:

VITE_GEMINI_API_KEY=your_api_key_here

4️⃣ Run the App
npm run dev

5️⃣ Open in Browser

👉 Visit http://localhost:5173

**📦 Required Packages**

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

**🎨 Design Philosophy**

“Accessibility meets futurism.”

HoloAid merges function and aesthetics — with glowing UI, smooth animations, and natural voice narration.
It’s designed to feel alive, like an assistant that not only works — but communicates intuitively.

🧭 Future Enhancements

🗣️ Conversational AI layer (voice Q&A about detected objects)

📍 Spatial awareness with AR/depth sensors

📱 Mobile app port (React Native + Expo)

🔐 Local user preferences & history

🌐 Multi-language narration support
