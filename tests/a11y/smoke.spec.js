const { test, expect } = require("../helpers/fixtures");

async function blockingAxeViolations(page) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run();
  });
  return results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

test("homepage passes axe critical/serious checks", async ({
  page,
  handoffScreenshot,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Next.js Supabase Starter" }),
  ).toBeVisible();
  await handoffScreenshot("a11y-homepage");
  expect(await blockingAxeViolations(page)).toEqual([]);
});

test("login page passes axe critical/serious checks", async ({
  page,
  handoffScreenshot,
}) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  await handoffScreenshot("a11y-login");
  expect(await blockingAxeViolations(page)).toEqual([]);
});
