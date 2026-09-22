import sharp from "sharp";
import fs from "fs/promises";

async function fileSize(path) {
  const s = await fs.stat(path);
  return s.size;
}

async function optimizePng(input, width, height) {
  const before = await fileSize(input);

  const img = sharp(input, { failOnError: false }).resize(width, height, {
    fit: "cover",
    position: "centre",
  });

  await img
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
    })
    .toFile(input + ".tmp");

  await fs.rename(input + ".tmp", input);

  const after = await fileSize(input);
  const kb = (n) => (n / 1024).toFixed(1);
  console.log(`${input}: ${kb(before)} KB -> ${kb(after)} KB`);
}

async function main() {
  await optimizePng("public/og.png", 1200, 630);
  await optimizePng("public/apple-touch-icon.png", 180, 180);
  await optimizePng("public/icon.png", 512, 512);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
