export function matchesLibrarySearch(title: string | null | undefined, query: string, source = "") {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const haystack = normalize(`${title || ""} ${source}`);
  return query.trim().split(/\s+/).every(word => haystack.includes(normalize(word)));
}

/** Name of a creation with file types, version numbers and copy markers removed. */
export function libraryBaseName(title: string | null | undefined) {
  return (title || "")
    .toLowerCase()
    .replace(/\.(html?|pdf|zip|webm|mp4|epub|txt|png|jpe?g|webp)$/i, "")
    .replace(/[\s_-]*(\(\d+\)|copy|final|v(ersion)?[\s_-]*\d+(\.\d+)*)$/gi, "")
    .replace(/[\s_-]*(v(ersion)?[\s_-]*\d+(\.\d+)*)$/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Keeps only the newest item per name+type; older ones are listed under it. */
export function keepNewestVersions<T extends { title?: string | null; media_type?: string | null; created_at?: string | null }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const base = libraryBaseName(item.title);
    const key = base ? `${item.media_type || ""}:${base}` : `${Math.random()}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.values()].map(group => {
    const sorted = [...group].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return { ...sorted[0], olderVersions: sorted.slice(1) } as T & { olderVersions: T[] };
  });
}
