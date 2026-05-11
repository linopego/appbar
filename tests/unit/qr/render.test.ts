import { describe, expect, it, beforeAll } from "vitest";
import { renderQrDataUrl, renderQrSvg } from "@/lib/qr/render";

beforeAll(() => {
  process.env["NEXT_PUBLIC_APP_URL"] = "https://example.com";
});

describe("renderQrSvg", () => {
  it("produce un SVG valido", async () => {
    const svg = await renderQrSvg("test-token-abc");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
  });
});

describe("renderQrDataUrl", () => {
  it("produce un data URL PNG base64", async () => {
    const url = await renderQrDataUrl("test-token-abc");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("rispetta i parametri size e margin", async () => {
    const url = await renderQrDataUrl("test-token", { size: 256, margin: 4 });
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  });
});
