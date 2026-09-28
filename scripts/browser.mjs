import { chromium } from "playwright";

// Polis maps draw with WebGL. Headless Chromium only offers it through its
// software renderer, which must be enabled explicitly.
export function launchBrowser(options = {}) {
  return chromium.launch({
    headless: true,
    ...options,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", ...(options.args ?? [])],
  });
}

// Places near each other share a count bubble until you zoom in. Open bubbles
// that name the place until its own marker stands alone, then choose it.
export async function clickMapPlace(page, scope, name) {
  // An empty name means any place; CSS [title^=""] would match nothing.
  const [starts, contains] = name ? [`[title^="${name}"]`, `[title*="${name}"]`] : ["[title]", "[title]"];
  for (let attempt = 0; attempt < 6; attempt++) {
    const pin = page.locator(`${scope} .civic-pin-button${starts}`).first();
    if (await pin.count()) return pin.dispatchEvent("click");
    const bubble = page.locator(`${scope} .civic-cluster-button${contains}`).first();
    if (await bubble.count()) await bubble.dispatchEvent("click");
    await page.waitForTimeout(1200);
  }
  throw new Error(`No map place named ${name} in ${scope}`);
}
