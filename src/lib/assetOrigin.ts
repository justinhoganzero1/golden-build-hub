/**
 * Built-in app media (videos, pictures) is stored as "/__l5e/assets-v1/..."
 * paths that only exist on the hosted website. The installed Android / Google
 * TV / iPhone app runs from its own bundled copy (https://localhost or
 * capacitor://localhost), where those paths 404 — so videos never loaded.
 * Inside the installed app we fetch them from oraclelunar.com instead.
 */
export const NATIVE_ASSET_ORIGIN = "https://oraclelunar.com";

type Loc = Pick<Location, "protocol" | "hostname">;

export function isNativeShellLocation(loc?: Loc | null): boolean {
  if (!loc) return false;
  return loc.hostname === "localhost" && (loc.protocol === "https:" || loc.protocol === "capacitor:" || loc.protocol === "ionic:");
}

export function resolveAssetUrl(url: string, loc: Loc | null = typeof window !== "undefined" ? window.location : null): string {
  if (typeof url !== "string" || !url.startsWith("/__l5e/")) return url;
  return isNativeShellLocation(loc) ? `${NATIVE_ASSET_ORIGIN}${url}` : url;
}
