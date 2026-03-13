"use client";

import { useState, useEffect } from "react";

type Props = {
  onClose: () => void;
};

export default function GoalModal({ onClose }: Props) {
  const [targetWeight, setTargetWeight] = useState("");
  const [dailyCalorie, setDailyCalorie] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => {
        if (d.goal) {
          setTargetWeight(String(d.goal.target_weight));
          setDailyCalorie(String(d.goal.daily_calorie_target));
          if (d.goal.height_cm) setHeightCm(String(d.goal.height_cm));
          if (d.goal.birth_date) setBirthDate(d.goal.birth_date);
          if (d.goal.gender) setGender(d.goal.gender);
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
        height_cm: heightCm ? parseFloat(heightCm) : null,
        birth_date: birthDate || null,
        gender: gender || null,
      }),
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">目標・プロフィール設定</h2>

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

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">
              基礎代謝（BMR）計算用
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  身長 (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="165"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  生年月日
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  性別
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setGender("female")}
                    className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${
                      gender === "female"
                        ? "bg-pink-500 text-white border-pink-500"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    女性
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("male")}
                    className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${
                      gender === "male"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    男性
                  </button>
                </div>
              </div>
            </div>
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
