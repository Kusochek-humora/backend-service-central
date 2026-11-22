/** Все mediaId внутри произвольной структуры (content, answerContent, settings, снимок) */
export function collectMediaIds(...values: unknown[]): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [key, val] of Object.entries(v)) {
        if (key === "mediaId" && typeof val === "string") found.add(val);
        else walk(val);
      }
    }
  };
  values.forEach(walk);
  return [...found];
}
