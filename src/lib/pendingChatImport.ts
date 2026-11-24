/** Hands a ChatGPT/Gemini export ZIP dropped into Oracle's chat over to the import screen (same tab, memory only). */
let pending: File | null = null;
export const isChatExportFile = (f: File) => /\.zip$/i.test(f.name) || f.type.includes("zip");
export const setPendingChatImport = (f: File | null) => { pending = f; };
export const takePendingChatImport = () => { const f = pending; pending = null; return f; };
