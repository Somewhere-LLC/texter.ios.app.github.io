const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const entries = [
  'index.html',
  'index-en.html',
  'en',
  'css',
  'js',
  'img',
  'robots.txt',
  'CNAME',
  '.htaccess',
  '.well-known',
];

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyFile = (src, dest) => {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
};

const copyDir = (src, dest) => {
  ensureDir(dest);
  const items = fs.readdirSync(src, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (item.isFile()) {
      copyFile(srcPath, destPath);
    }
  }
};

const clean = () => {
  fs.rmSync(distDir, { recursive: true, force: true });
};

const build = () => {
  clean();
  ensureDir(distDir);

  const missing = [];
  for (const entry of entries) {
    const srcPath = path.join(rootDir, entry);
    const destPath = path.join(distDir, entry);
    if (!fs.existsSync(srcPath)) {
      missing.push(entry);
      continue;
    }

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }

  if (missing.length > 0) {
    console.warn('Missing build entries:', missing.join(', '));
  }

  console.log('Build complete:', distDir);
};

build();
