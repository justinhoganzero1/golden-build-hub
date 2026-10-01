const KEY = "oracle.goldTheme";

export const goldThemeOn = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

export const applyGoldTheme = (on: boolean) => {
  document.documentElement.classList.toggle("theme-gold", on);
};

export const setGoldTheme = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  applyGoldTheme(on);
};
