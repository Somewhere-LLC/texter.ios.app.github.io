const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const inputPath = path.join(rootDir, 'pdf', 'texter-for-business.html');
const outputDir = path.join(rootDir, 'assets', 'pdf');
const outputPath = path.join(outputDir, 'texter-for-business.pdf');

async function generatePDF() {
  if (!fs.existsSync(inputPath)) {
    console.error('Input HTML not found:', inputPath);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // CHROME_PATH があればそれを使う（同梱の Chrome が無い環境向け。macOS では pipe が要る）
  // 負荷が高いと起動と CDP の呼び出しが既定の30秒を超えるので、どちらの待ち時間も延ばす
  const chromePath = process.env.CHROME_PATH;
  const browser = await puppeteer.launch(
    chromePath
      ? { executablePath: chromePath, headless: true, pipe: true, timeout: 240000, protocolTimeout: 240000 }
      : { timeout: 240000, protocolTimeout: 240000 }
  );
  try {
    const page = await browser.newPage();

    const fileUrl = 'file://' + inputPath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await page.evaluate(async () => { await document.fonts.ready; });

    // 16:9 のスライド（1枚 1920×1080）
    await page.pdf({
      path: outputPath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    console.log('PDF generated:', outputPath);
  } finally {
    await browser.close();
  }
}

generatePDF().catch((err) => {
  console.error('PDF generation failed:', err.message);
  process.exit(1);
});
