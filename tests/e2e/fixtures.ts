import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

// Después de cada `goto` se espera a que termine la hidratación de React: un clic
// previo se pierde y el test queda intermitente.
export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = (async (url: string, options?: Parameters<typeof goto>[1]) => {
      const response = await goto(url, options);
      await page.waitForLoadState("networkidle");
      return response;
    }) as typeof page.goto;
    await provide(page);
  },
});
