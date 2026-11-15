import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly interpolates a telemetry value so readouts feel instrument-like
 * rather than snapping once per tick.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  className,
  suffix,
  prefix,
  duration = 0.55,
}: {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        fromRef.current = value;
      },
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return (
    <span className={className}>
      {prefix}
      {display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
