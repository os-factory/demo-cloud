const { test, expect } = require("@playwright/test");

test.describe("API smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const healthPath =
      process.env.HARNESS_HEALTH_CHECK_PATH ||
      process.env.HARNESS_HEALTH_PATH ||
      "/api/health";
    const res = await request.get(healthPath);
    expect(res.ok()).toBeTruthy();
    await expect(res.json()).resolves.toMatchObject({ status: "ok" });
  });
});
