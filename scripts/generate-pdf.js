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

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();

    const fileUrl = 'file://' + inputPath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
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
