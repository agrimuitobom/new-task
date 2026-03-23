import sharp from "sharp";

const sizes = [192, 512];

function generateSVG(size) {
  const s = size;
  const pad = s * 0.12;
  const r = s * 0.18;  // corner radius

  // Checkbox dimensions
  const cbSize = s * 0.115;
  const cbR = s * 0.025;
  const cbStartX = s * 0.22;
  const rowStartY = s * 0.30;
  const rowGap = s * 0.175;

  // Line bar dimensions
  const lineX = cbStartX + cbSize + s * 0.06;
  const lineW = s * 0.42;
  const lineH = s * 0.045;
  const lineR = lineH / 2;

  // Shorter second line
  const line2W = s * 0.28;

  // Checkmark path for checked boxes
  function checkmark(cx, cy, sz) {
    const x1 = cx + sz * 0.18;
    const y1 = cy + sz * 0.5;
    const x2 = cx + sz * 0.42;
    const y2 = cy + sz * 0.72;
    const x3 = cx + sz * 0.82;
    const y3 = cy + sz * 0.22;
    const sw = sz * 0.16;
    return `<path d="M${x1},${y1} L${x2},${y2} L${x3},${y3}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="check1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a5b4fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect x="${pad}" y="${pad}" width="${s - pad * 2}" height="${s - pad * 2}" rx="${r}" ry="${r}" fill="url(#bg)"/>

  <!-- Subtle inner glow -->
  <rect x="${pad}" y="${pad}" width="${s - pad * 2}" height="${s - pad * 2}" rx="${r}" ry="${r}" fill="none" stroke="#ffffff18" stroke-width="${s * 0.01}"/>

  <!-- Row 1: Checked (green) -->
  <rect x="${cbStartX}" y="${rowStartY}" width="${cbSize}" height="${cbSize}" rx="${cbR}" fill="url(#accent)" opacity="0.95"/>
  ${checkmark(cbStartX, rowStartY, cbSize)}
  <rect x="${lineX}" y="${rowStartY + cbSize / 2 - lineH / 2}" width="${lineW}" height="${lineH}" rx="${lineR}" fill="#ffffff" opacity="0.85"/>

  <!-- Row 2: Checked (blue) -->
  <rect x="${cbStartX}" y="${rowStartY + rowGap}" width="${cbSize}" height="${cbSize}" rx="${cbR}" fill="url(#check1)" opacity="0.9"/>
  ${checkmark(cbStartX, rowStartY + rowGap, cbSize)}
  <rect x="${lineX}" y="${rowStartY + rowGap + cbSize / 2 - lineH / 2}" width="${line2W}" height="${lineH}" rx="${lineR}" fill="#ffffff" opacity="0.6"/>

  <!-- Row 3: Unchecked -->
  <rect x="${cbStartX}" y="${rowStartY + rowGap * 2}" width="${cbSize}" height="${cbSize}" rx="${cbR}" fill="none" stroke="#ffffff" stroke-width="${s * 0.018}" opacity="0.5"/>
  <rect x="${lineX}" y="${rowStartY + rowGap * 2 + cbSize / 2 - lineH / 2}" width="${lineW * 0.75}" height="${lineH}" rx="${lineR}" fill="#ffffff" opacity="0.35"/>

  <!-- Progress bar at bottom -->
  <rect x="${cbStartX}" y="${rowStartY + rowGap * 2 + cbSize + s * 0.08}" width="${lineW + cbSize + s * 0.06}" height="${s * 0.035}" rx="${s * 0.018}" fill="#ffffff" opacity="0.15"/>
  <rect x="${cbStartX}" y="${rowStartY + rowGap * 2 + cbSize + s * 0.08}" width="${(lineW + cbSize + s * 0.06) * 0.66}" height="${s * 0.035}" rx="${s * 0.018}" fill="#34d399" opacity="0.8"/>
</svg>`;
}

for (const size of sizes) {
  const svg = generateSVG(size);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/icon-${size}.png`);
  console.log(`Generated icon-${size}.png`);
}
