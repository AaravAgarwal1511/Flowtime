import { getSettings } from "@/lib/db";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();

  return (
    <SettingsClient
      settings={{
        workdayStartMin: s.workdayStartMin,
        workdayEndMin: s.workdayEndMin,
        workdays: s.workdays,
        defaultBufferMin: s.defaultBufferMin,
        lockHorizonHours: s.lockHorizonHours,
        planHorizonDays: s.planHorizonDays,
        minTaskDurationForBuffer: s.minTaskDurationForBuffer,
        minGapBetweenTaskChunks: s.minGapBetweenTaskChunks,
      }}
    />
  );
}
