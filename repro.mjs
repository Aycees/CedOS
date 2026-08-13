import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
const page = await context.newPage();
page.on("console", (msg) => console.log("PAGE:", msg.type(), msg.text()));

await page.goto("http://localhost:3000/calendar");
await page.waitForLoadState("networkidle");

// ensure at least one calendar exists
const noCal = await page.getByText("no calendars yet").count();
if (noCal > 0) {
  await page.getByRole("button", { name: "+ new calendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("NAME").fill("Repro " + Date.now());
  await dialog.getByRole("button", { name: "blue", exact: true }).click();
  await dialog.getByRole("button", { name: "save" }).click();
  await page.waitForTimeout(500);
}

await page.getByRole("button", { name: "+ new event" }).click();
await page.waitForTimeout(500);

const dialog = page.getByRole("dialog");
await dialog.screenshot({ path: "/tmp/before-open.png" }).catch(() => {});

// click the time picker trigger
const trigger = dialog.getByRole("button", { name: /set time|AM|PM/ });
console.log("trigger count", await trigger.count());
await trigger.click();
await page.waitForTimeout(300);

await page.screenshot({ path: "/tmp/after-open.png", fullPage: true });

// try clicking hour "9"
const hourBtn = page.getByRole("button", { name: "9", exact: true });
console.log("hour9 count", await hourBtn.count());
if (await hourBtn.count() > 0) {
  const box = await hourBtn.first().boundingBox();
  console.log("hour9 box", box);
  // find topmost element at that point
  const elInfo = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? { tag: el.tagName, cls: el.className, text: el.textContent?.slice(0,30) } : null;
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  console.log("elementFromPoint at hour9 center:", elInfo);

  await hourBtn.first().click({ timeout: 3000 }).then(
    () => console.log("CLICK SUCCEEDED"),
    (e) => console.log("CLICK FAILED:", e.message)
  );
}

await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/after-click.png", fullPage: true });

await browser.close();
