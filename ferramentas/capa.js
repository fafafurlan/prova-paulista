// Exporta uma página HTML (capa, slide de carrossel) como JPG.
// Uso: node capa.js capa.html capa.jpg [largura] [altura]
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "tests", "node_modules", "playwright"));

(async () => {
  const [entrada, saida, w = 1080, h = 1920] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  await page.goto("file://" + path.resolve(entrada));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: saida, type: "jpeg", quality: 92 });
  await browser.close();
})();
