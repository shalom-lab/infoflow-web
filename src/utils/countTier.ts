/** 张数 → 信号格点亮数（1–5）。15 张封顶：每约 3 张一格；>15 全亮。 */
export function countSignalBars(n: number): number {
  if (n <= 0) return 0
  if (n <= 3) return 1
  if (n <= 6) return 2
  if (n <= 9) return 3
  if (n <= 12) return 4
  return 5 // 13–15+
}
