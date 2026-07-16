import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

// Pagine legali: i testi DEFINITIVI e validati vivono in content/legal/*.md
// e vengono renderizzati VERBATIM — mai riformulati nel codice.
export async function renderLegalHtml(slug: "privacy" | "termini"): Promise<string> {
  const file = path.join(process.cwd(), "content", "legal", `${slug}.md`);
  const md = await readFile(file, "utf8");
  return marked.parse(md, { async: false });
}
