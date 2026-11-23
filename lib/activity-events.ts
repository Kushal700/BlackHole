import type { Memory } from "@/lib/types";

type ActivityListener = (memories: Memory[]) => void;
const activityGlobal = globalThis as typeof globalThis & {
  __blackHoleActivityListeners?: Set<ActivityListener>;
};

function listeners() {
  activityGlobal.__blackHoleActivityListeners ||= new Set<ActivityListener>();
  return activityGlobal.__blackHoleActivityListeners;
}

export function publishSkillActivity(memories: Memory[]) {
  for (const listener of listeners()) listener(memories);
}

export function subscribeToSkillActivity(listener: ActivityListener) {
  listeners().add(listener);
  return () => listeners().delete(listener);
}
