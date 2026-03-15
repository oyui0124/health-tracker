"use client";

import { useRef, useState, useCallback } from "react";
import LoadingSpinner from "./LoadingSpinner";

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
        {refreshing ? (
          <LoadingSpinner size="sm" />
        ) : (
          <div
            style={{
              transform: `rotate(${progress * 360}deg)`,
              opacity: progress,
            }}
            className="transition-transform duration-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-green-500"
            >
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.06-.179zm-1.624-7.848a7 7 0 00-11.712 3.138.75.75 0 001.06.179 5.5 5.5 0 019.201-2.466l.312.311H10.116a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V1.854a.75.75 0 00-1.5 0v2.033l-.312-.311z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
