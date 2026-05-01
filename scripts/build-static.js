const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const publicFiles = ["index.html", "styles.css", "app.js", "preview.png"];
const requiredFiles = ["index.html", "styles.css", "app.js", "render.yaml"];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const requiredRefs = ['./styles.css', './app.js'];
const missingRefs = requiredRefs.filter((ref) => !html.includes(ref));

if (missingRefs.length) {
  console.error(`index.html is missing references: ${missingRefs.join(", ")}`);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of publicFiles) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(dist, file));
  }
}

console.log(`Static deploy build passed. Published ${publicFiles.length} files to dist/.`);
