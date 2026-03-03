function norm(value: string): string {
  return value.toLowerCase().replace(/[\s\u3000]/g, '')
}

function bigrams(input: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < input.length - 1; i += 1) out.add(input.slice(i, i + 2))
  return out
}

export function calcSimilarity(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const sa = bigrams(na)
  const sb = bigrams(nb)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter += 1
  return (2 * inter) / (sa.size + sb.size)
}

export function resolveSimilarIngredient(
  name: string,
  candidates: string[],
  threshold = 0.82,
): { matchedName: string, score: number } | null {
  let best: { matchedName: string, score: number } | null = null
  for (const c of candidates) {
    const score = calcSimilarity(name, c)
    if (!best || score > best.score) best = { matchedName: c, score }
  }
  if (!best || best.score < threshold) return null
  return best
}
