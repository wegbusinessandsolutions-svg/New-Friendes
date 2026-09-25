const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Exact SVG recreation of the uploaded ico_nfs.png logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient for Maskable Icons -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f0f7ff"/>
    </linearGradient>

    <!-- Radar Sweep Beam Gradient -->
    <linearGradient id="radarSweep" x1="256" y1="256" x2="440" y2="80" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#bae6fd" stop-opacity="0.08"/>
    </linearGradient>

    <!-- Main Pin Gradient -->
    <linearGradient id="pinGrad" x1="0%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#0066ff"/>
      <stop offset="100%" stop-color="#0047cc"/>
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="pinShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0047cc" flood-opacity="0.25"/>
    </filter>

    <filter id="avatarShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Clean Background -->
  <rect width="512" height="512" fill="url(#bgGrad)"/>

  <!-- Radar Scanning Beam Wedge -->
  <path d="M 256 256 L 350 90 A 210 210 0 0 1 425 155 Z" fill="url(#radarSweep)"/>
  
  <!-- Sweeping Line indicator -->
  <line x1="256" y1="256" x2="425" y2="155" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>

  <!-- Glowing Blip Dot on sweep line -->
  <circle cx="395" cy="132" r="10" fill="#ffffff" opacity="0.85"/>
  <circle cx="395" cy="132" r="6" fill="#38bdf8"/>

  <!-- Concentric Radar Rings -->
  <!-- Outer Ring (Radius 225) -->
  <circle cx="256" cy="256" r="225" fill="none" stroke="#bae6fd" stroke-width="2.5" stroke-dasharray="14 10" opacity="0.85"/>
  
  <!-- Ring 3 (Radius 180) -->
  <circle cx="256" cy="256" r="180" fill="none" stroke="#7dd3fc" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="100 24 60 20 140 30" opacity="0.9"/>
  
  <!-- Ring 2 (Radius 135) -->
  <circle cx="256" cy="256" r="135" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="80 20 120 25" opacity="0.85"/>

  <!-- Inner Ring (Radius 85) -->
  <circle cx="256" cy="256" r="85" fill="none" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" stroke-dasharray="60 16 70 18" opacity="0.8"/>

  <!-- 1. Top-Left User Avatar (Green / Teal #10b981) -->
  <g transform="translate(132, 126)" filter="url(#avatarShadow)">
    <circle cx="0" cy="0" r="32" fill="#ffffff"/>
    <circle cx="0" cy="0" r="30" fill="#ecfdf5"/>
    <!-- Head -->
    <circle cx="0" cy="-7" r="11" fill="#10b981"/>
    <!-- Body -->
    <path d="M -16 16 C -16 6 -8 2 0 2 C 8 2 16 6 16 16 Z" fill="#10b981"/>
  </g>

  <!-- 2. Right User Avatar (Orange / Amber #f97316) -->
  <g transform="translate(416, 276)" filter="url(#avatarShadow)">
    <circle cx="0" cy="0" r="32" fill="#ffffff"/>
    <circle cx="0" cy="0" r="30" fill="#fff7ed"/>
    <!-- Head -->
    <circle cx="0" cy="-7" r="11" fill="#f97316"/>
    <!-- Body -->
    <path d="M -16 16 C -16 6 -8 2 0 2 C 8 2 16 6 16 16 Z" fill="#f97316"/>
  </g>

  <!-- 3. Bottom-Left User Avatar (Purple / Violet #8b5cf6) -->
  <g transform="translate(156, 386)" filter="url(#avatarShadow)">
    <circle cx="0" cy="0" r="32" fill="#ffffff"/>
    <circle cx="0" cy="0" r="30" fill="#f5f3ff"/>
    <!-- Head -->
    <circle cx="0" cy="-7" r="11" fill="#8b5cf6"/>
    <!-- Body -->
    <path d="M -16 16 C -16 6 -8 2 0 2 C 8 2 16 6 16 16 Z" fill="#8b5cf6"/>
  </g>

  <!-- Center Location Pin Marker (Vibrant Blue #0066ff) -->
  <g filter="url(#pinShadow)">
    <!-- Map Pin Shape -->
    <path d="M 256 348 C 238 316 186 266 186 226 C 186 187 217 156 256 156 C 295 156 326 187 326 226 C 326 266 274 316 256 348 Z" 
          fill="url(#pinGrad)"/>
    <!-- Center White Hole -->
    <circle cx="256" cy="226" r="28" fill="#ffffff"/>
  </g>
</svg>`;

async function generate() {
  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write public/icon.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
  console.log('Saved public/icon.svg');

  const svgBuffer = Buffer.from(svgContent);

  // 2. Generate pwa-192x192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 3. Generate pwa-512x512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 4. Generate pwa-maskable-512x512.png (with safe zone padding: 15% inner shrink for Android squircle)
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#f8fafc'
    })
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 5. Generate apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 6. Generate favicon-32x32.png and favicon.ico
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Generated favicon-32x32.png');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
