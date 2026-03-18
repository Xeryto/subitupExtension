import sharp from 'sharp';
import { writeFileSync } from 'fs';

// SVG icon: calendar with sync arrows, teal gradient background
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0EA5E9"/>
      <stop offset="100%" style="stop-color:#0D9488"/>
    </linearGradient>
    <linearGradient id="arrow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#34D399"/>
      <stop offset="100%" style="stop-color:#059669"/>
    </linearGradient>
  </defs>

  <!-- Rounded background -->
  <rect width="128" height="128" rx="24" ry="24" fill="url(#bg)"/>

  <!-- Calendar body -->
  <rect x="22" y="34" width="84" height="72" rx="8" ry="8" fill="white" opacity="0.95"/>

  <!-- Calendar header bar -->
  <rect x="22" y="34" width="84" height="24" rx="8" ry="8" fill="white" opacity="0.95"/>
  <rect x="22" y="46" width="84" height="12" fill="white" opacity="0.95"/>

  <!-- Header teal strip -->
  <rect x="22" y="34" width="84" height="22" rx="8" ry="8" fill="#0EA5E9" opacity="0.85"/>
  <rect x="22" y="44" width="84" height="12" fill="#0EA5E9" opacity="0.85"/>

  <!-- Calendar pegs -->
  <rect x="42" y="26" width="8" height="18" rx="4" fill="white"/>
  <rect x="78" y="26" width="8" height="18" rx="4" fill="white"/>

  <!-- Grid dots (days) -->
  <rect x="31" y="66" width="10" height="9" rx="2" fill="#BAE6FD"/>
  <rect x="47" y="66" width="10" height="9" rx="2" fill="#BAE6FD"/>
  <rect x="63" y="66" width="10" height="9" rx="2" fill="#BAE6FD"/>
  <rect x="79" y="66" width="10" height="9" rx="2" fill="#BAE6FD"/>

  <rect x="31" y="81" width="10" height="9" rx="2" fill="#BAE6FD"/>
  <rect x="47" y="81" width="10" height="9" rx="2" fill="#2DD4BF"/>
  <rect x="63" y="81" width="10" height="9" rx="2" fill="#2DD4BF"/>
  <rect x="79" y="81" width="10" height="9" rx="2" fill="#BAE6FD"/>

  <!-- Sync arrow badge (bottom-right) -->
  <circle cx="95" cy="95" r="22" fill="#0F172A" opacity="0.15"/>
  <circle cx="95" cy="95" r="19" fill="url(#arrow)"/>

  <!-- Sync arrows (two arcs forming circle) -->
  <g transform="translate(95,95)">
    <!-- Top arc arrow -->
    <path d="M -8 -4 A 9 9 0 0 1 8 -4" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
    <polygon points="8,-4 12,-1 7,2" fill="white"/>
    <!-- Bottom arc arrow -->
    <path d="M 8 4 A 9 9 0 0 1 -8 4" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
    <polygon points="-8,4 -12,1 -7,-2" fill="white"/>
  </g>
</svg>`;

const sizes = [16, 48, 128];

for (const size of sizes) {
  const buf = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(`public/icons/icon${size}.png`, buf);
  console.log(`✓ icon${size}.png`);
}
