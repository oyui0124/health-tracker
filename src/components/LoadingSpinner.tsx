"use client";

/**
 * 共通ローディングアニメーション
 * - size="sm": プルリフレッシュ用（上部）
 * - size="md": 画面遷移用（中央）
 */
export default function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" }) {
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const gap = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <div className={`flex items-center ${gap}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotSize} rounded-full bg-green-500`}
          style={{
            animation: "pulseScale 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
