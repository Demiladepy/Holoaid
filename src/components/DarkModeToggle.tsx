import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

const DarkModeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="theme-toggle">…</div>;

  const current = resolvedTheme || theme || 'light';
  const isDark = current === 'dark';

  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <button
      onClick={toggle}
      aria-pressed={isDark}
      role="switch"
      aria-checked={isDark}
      className="theme-toggle flex items-center gap-3 px-3"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className={`relative w-14 h-7 rounded-full transition-colors ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
        <motion.div
          className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm"
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
          style={{ left: isDark ? 'calc(100% - 1.5rem)' : '0.25rem' }}
        />
      </div>
      <span className="hidden sm:inline text-sm">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
};

export default DarkModeToggle;
