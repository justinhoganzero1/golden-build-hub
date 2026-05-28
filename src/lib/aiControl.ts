// Lightweight user-controlled flag: "AI Full Control"
// When ON, the Oracle is allowed to act on behalf of the user
// (drafting/sending messages, signing things up, browsing accounts, etc).
// When OFF, every external action requires manual confirmation.
const KEY = "oracle-ai-full-control";

export const getAIFullControl = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
};

export const setAIFullControl = (on: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("oracle-ai-control-changed", { detail: { on } }));
};
