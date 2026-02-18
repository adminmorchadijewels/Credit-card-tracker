import { useEffect, useRef } from "react";
import { useStore } from "@/data/store";
import { supabase } from "@/integrations/supabase/client";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LS_KEY = "fintrack_last_backup_ts";

export function useBackup() {
  const { cards, payments } = useStore();
  // Keep a ref so the interval callback always has the latest data
  const dataRef = useRef({ cards, payments });
  dataRef.current = { cards, payments };

  useEffect(() => {
    const runBackup = async () => {
      const { cards: c, payments: p } = dataRef.current;
      // Skip if there's nothing to backup yet
      if (c.length === 0 && p.length === 0) return;

      const lastTs = Number(localStorage.getItem(LS_KEY) || "0");
      if (Date.now() - lastTs < INTERVAL_MS) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("backups" as never).insert({
        user_id: user.id,
        cards_count: c.length,
        payments_count: p.length,
        snapshot: { cards: c, payments: p },
      });

      if (!error) {
        localStorage.setItem(LS_KEY, String(Date.now()));
        console.info("[FinTrack] Auto-backup saved successfully.");
      } else {
        console.warn("[FinTrack] Auto-backup failed:", error.message);
      }
    };

    // Run once on mount (will respect the 24-hour gate)
    runBackup();

    // Then check again every hour so we catch the window as soon as 24h passes
    const timer = setInterval(runBackup, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []); // intentionally empty – dataRef keeps the latest values
}
