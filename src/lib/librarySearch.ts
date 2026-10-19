export function matchesLibrarySearch(title: string | null | undefined, query: string, source = "") {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const haystack = normalize(`${title || ""} ${source}`);
  return query.trim().split(/\s+/).every(word => haystack.includes(normalize(word)));
}