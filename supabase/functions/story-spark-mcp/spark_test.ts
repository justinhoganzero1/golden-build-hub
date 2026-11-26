import { assert, assertEquals } from "jsr:@std/assert";
import { storySpark, FOOTER } from "./spark.ts";
Deno.test("story spark names the character and links to oraclelunar.com", () => {
  const t = storySpark("mystery", "Mara");
  assert(t.includes("Mara")); assert(t.includes(FOOTER)); assert(t.includes("https://oraclelunar.com"));
});
Deno.test("same input gives same spark", () => assertEquals(storySpark("sci-fi", "Jo"), storySpark("sci-fi", "Jo")));
