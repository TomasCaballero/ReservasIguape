import { expect, test } from "@playwright/test";

test("el portal público carga en /", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
