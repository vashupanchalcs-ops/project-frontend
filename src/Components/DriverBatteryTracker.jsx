import { useEffect, useRef } from "react";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api/update-battery/";
const FALLBACK_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export default function DriverBatteryTracker({ ambulanceId }) {
  const lastLevelRef = useRef(null);
  const batteryManagerRef = useRef(null);

  useEffect(() => {
    const parsedId = Number(ambulanceId);
    if (!Number.isFinite(parsedId) || parsedId <= 0) return undefined;
    if (!("getBattery" in navigator)) return undefined;

    let isMounted = true;
    let fallbackTimer = null;

    const sendBattery = async (level) => {
      if (typeof level !== "number") return;
      const batteryPercentage = Math.round(level * 100);
      try {
        await axios.post(API_URL, {
          ambulance_id: parsedId,
          battery_percentage: batteryPercentage,
        });
      } catch {
        // Silent tracker: do not interrupt driver UI.
      }
    };

    const handleLevelChange = async () => {
      const manager = batteryManagerRef.current;
      if (!manager || !isMounted) return;
      const currentLevel = manager.level;
      const previousLevel = lastLevelRef.current;

      if (previousLevel === null) {
        lastLevelRef.current = currentLevel;
        return;
      }

      if (currentLevel < previousLevel) {
        await sendBattery(currentLevel);
      }

      lastLevelRef.current = currentLevel;
    };

    (async () => {
      try {
        const manager = await navigator.getBattery();
        if (!isMounted) return;

        batteryManagerRef.current = manager;
        lastLevelRef.current = manager.level;

        // Initial sync on mount so backend has a fresh value.
        await sendBattery(manager.level);
        manager.addEventListener("levelchange", handleLevelChange);

        // Fallback sync every 5 minutes even if event does not fire.
        fallbackTimer = setInterval(() => {
          const currentManager = batteryManagerRef.current;
          if (!currentManager) return;
          sendBattery(currentManager.level);
        }, FALLBACK_SYNC_INTERVAL_MS);
      } catch {
        // Browser may block Battery Status API; fail silently.
      }
    })();

    return () => {
      isMounted = false;
      if (fallbackTimer) clearInterval(fallbackTimer);
      const manager = batteryManagerRef.current;
      if (manager) {
        manager.removeEventListener("levelchange", handleLevelChange);
      }
    };
  }, [ambulanceId]);

  return null;
}
