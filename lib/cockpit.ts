export interface ReadinessInput {
  objective: string;
  studioLinked: boolean;
  repositoryUrl?: string;
  openTasks: number;
  memoryCount: number;
}

export function calculateReadiness(input: ReadinessInput) {
  const checks: Array<[string, boolean]> = [
    ["Objective defined", Boolean(input.objective.trim())],
    ["Studio linked", input.studioLinked],
    ["Repository linked", Boolean(input.repositoryUrl)],
    ["Execution tasks", input.openTasks > 0],
    ["Grounded knowledge", input.memoryCount > 0],
  ];
  return {
    checks,
    score: Math.round(
      (checks.filter(([, complete]) => complete).length / checks.length) * 100,
    ),
  };
}
