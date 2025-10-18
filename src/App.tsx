import React from "react";
import CameraFeed from "./components/CameraFeed";
import DarkModeToggle from "./components/DarkModeToggle";
import { ThemeProvider } from "next-themes";
import { motion } from "framer-motion";

const App: React.FC = () => {
  return (
    <ThemeProvider attribute="class">
      <div className="flex flex-col items-center min-h-screen py-10 px-6 bg-gradient-to-b from-gray-50 dark:from-gray-900 dark:to-black">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-4xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 text-center"
        >
          🩺 HoloAid — Vision for Everyone
        </motion.h1>

        <DarkModeToggle />
        <CameraFeed />

        <p className="mt-6 text-center max-w-lg text-gray-600 dark:text-gray-300 leading-relaxed">
          HoloAid detects your surroundings, narrates them, and visualizes the
          world with glowing live labels — all powered by AI.
        </p>
      </div>
    </ThemeProvider>
  );
};

export default App;
