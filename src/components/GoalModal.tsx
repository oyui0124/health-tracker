"use client";

import { useState, useEffect } from "react";

type Props = {
  onClose: () => void;
};

export default function GoalModal({ onClose }: Props) {
  const [targetWeight, setTargetWeight] = useState("");
  const [dailyCalorie, setDailyCalorie] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => {
        if (d.goal) {
          setTargetWeight(String(d.goal.target_weight));
          setDailyCalorie(String(d.goal.daily_calorie_target));
        }
      });
  }, []);

  const handleSave = async () => {
    if (!targetWeight || !dailyCalorie) return;
    setSaving(true);

    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_weight: parseFloat(targetWeight),
        daily_calorie_target: parseInt(dailyCalorie),
      }),
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold mb-4">目標設定</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              目標体重 (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="60.0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">
              1日の目標カロリー (kcal)
            </label>
            <input
              type="number"
              value={dailyCalorie}
              onChange={(e) => setDailyCalorie(e.target.value)}
              placeholder="1800"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!targetWeight || !dailyCalorie || saving}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-medium disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
