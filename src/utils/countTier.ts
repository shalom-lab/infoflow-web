/** Map image count → CSS tier class for cover/detail badges. */
export function countTierClass(n: number): string {
  if (n <= 1) return 'count-tier-1'
  if (n <= 3) return 'count-tier-2'
  if (n <= 6) return 'count-tier-3'
  if (n <= 11) return 'count-tier-4'
  return 'count-tier-5'
}
