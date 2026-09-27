// Simple script to generate clean PWA PNG icons using node-canvas or pure BMP/PNG
import fs from 'fs';
import path from 'path';

// Let's create an SVG that works directly or minimal valid PNG
// Actually, SVG can be referenced in manifest directly!
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#16a34a"/>
  <path d="M192 384V128l192-32v256" fill="none" stroke="#ffffff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="144" cy="384" r="48" fill="#ffffff"/>
  <circle cx="336" cy="352" r="48" fill="#ffffff"/>
</svg>`;

fs.writeFileSync('public/icon.svg', svgIcon);
console.log('Created public/icon.svg');
