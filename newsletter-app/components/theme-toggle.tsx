'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = window.localStorage.getItem('chevere-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      window.localStorage.setItem('chevere-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      window.localStorage.setItem('chevere-theme', 'light');
    }
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={isDark ? 'Use light mode' : 'Use dark mode'}
      title={isDark ? 'Use light mode' : 'Use dark mode'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
