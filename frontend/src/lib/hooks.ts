import { useEffect, useState } from 'react';

/** Re-renders on an interval — used by the UTC clock and relative timestamps. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: MouseEvent | TouchEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) onOutside();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside();
    };
    document.addEventListener('pointerdown', handler);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', handler);
      document.removeEventListener('keydown', key);
    };
  }, [ref, onOutside, active]);
}
