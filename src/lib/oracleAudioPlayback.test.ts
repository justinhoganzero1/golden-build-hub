import { describe, expect, it } from "vitest";
import { PrefetchedSpeech } from "./oracleAudioPlayback";

function slowResponse(parts: string[]) {
  let i = 0;
  const enc = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async pull(c) {
      await new Promise(r => setTimeout(r, 5));
      if (i < parts.length) c.enqueue(enc.encode(parts[i++])); else c.close();
    },
  }));
}

async function readAll(r: Response) {
  return new TextDecoder().decode(new Uint8Array(await r.arrayBuffer()));
}

describe("PrefetchedSpeech", () => {
  it("plays from what has arrived and keeps streaming the rest", async () => {
    const pre = new PrefetchedSpeech(Promise.resolve(slowResponse(["ab", "cd", "ef"])));
    expect(await pre.ready).toBe(true);
    expect(await readAll(pre.toResponse())).toBe("abcdef");
    expect(pre.complete).toBe(true);
  });
  it("hands over the whole clip once fully downloaded", async () => {
    const pre = new PrefetchedSpeech(Promise.resolve(slowResponse(["one", "two"])));
    await pre.ready;
    await readAll(pre.toResponse());
    expect(pre.blob().size).toBe(6);
  });
  it("reports a failed request so Oracle asks again live", async () => {
    const pre = new PrefetchedSpeech(Promise.resolve(null));
    expect(await pre.ready).toBe(false);
    expect(pre.complete).toBe(false);
  });
});
