export const ENVIRONMENT_COOLDOWN_MS = 5_000

export function cooldownSecondsRemaining(cooldownUntil: number, now: number): number {
  return Math.max(0, Math.ceil((cooldownUntil - now) / 1_000))
}