"use client";

import { useRef, useState, useCallback } from "react";

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export default function PullToRefresh({ onRefresh, children, className = "", style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const THRESHOLD = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop <= 0) {
      const dampened = Math.min(diff * 0.4, 100);
      setPullDistance(dampened);
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-y-auto no-scrollbar ${className}`}
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        <div
          className={`w-5 h-5 rounded-full border-2 border-gray-200 border-t-green-500 ${refreshing ? "animate-spin" : ""}`}
          style={{
            opacity: refreshing ? 1 : progress,
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
