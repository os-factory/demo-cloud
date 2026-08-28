const { test, expect } = require("../helpers/fixtures");

test.describe("Frontend smoke", () => {
  test("homepage loads", async ({ page, handoffScreenshot }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Next.js Supabase Starter" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Supabase and Next.js Starter Template",
      }),
    ).toBeAttached();
    await handoffScreenshot("homepage");
  });

  test("login page loads", async ({ page, handoffScreenshot }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await handoffScreenshot("login");
  });

  test("notes page loads", async ({ page, handoffScreenshot }) => {
    await page.goto("/notes");
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All notes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bold" })).toBeVisible();
    await handoffScreenshot("notes");
  });
});
