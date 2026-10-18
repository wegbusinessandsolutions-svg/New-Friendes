const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function buildIcons() {
  const sourceImagePath = path.resolve(__dirname, '../src/assets/images/nfriends_app_icon_1792243754653.jpg');
  const publicDir = path.resolve(__dirname, '../public');

  if (!fs.existsSync(sourceImagePath)) {
    throw new Error(`Source image not found at ${sourceImagePath}`);
  }

  console.log(`Loading source image from: ${sourceImagePath}`);

  // 1. Generate public/nfriends.png (512x512)
  await sharp(sourceImagePath)
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'nfriends.png'));
  console.log('✓ Generated public/nfriends.png (512x512)');

  // 2. Generate public/nfriends-1024.png (1024x1024 master)
  await sharp(sourceImagePath)
    .resize(1024, 1024, { fit: 'cover' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'nfriends-1024.png'));
  console.log('✓ Generated public/nfriends-1024.png (1024x1024)');

  // 3. Generate public/pwa-192x192.png (Android / Mobile PWA Home Screen)
  await sharp(sourceImagePath)
    .resize(192, 192, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ Generated public/pwa-192x192.png (192x192)');

  // 4. Generate public/pwa-512x512.png (PWA Splash & Launcher)
  await sharp(sourceImagePath)
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ Generated public/pwa-512x512.png (512x512)');

  // 5. Generate public/pwa-maskable-512x512.png (with safe-zone 15% inner shrink for Android circular/squircle masks)
  // Android maskable specs require 10-15% padding so corners or essential parts aren't clipped
  await sharp(sourceImagePath)
    .resize(420, 420, { fit: 'cover' })
    .extend({
      top: 46,
      bottom: 46,
      left: 46,
      right: 46,
      background: '#0a3582' // Rich blue matching top corners of the icon
    })
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✓ Generated public/pwa-maskable-512x512.png (512x512 maskable with safe zone)');

  // 6. Generate public/apple-touch-icon.png (180x180 for iOS Safari home screen)
  await sharp(sourceImagePath)
    .resize(180, 180, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated public/apple-touch-icon.png (180x180 iOS)');

  // 7. Generate public/favicon-32x32.png (32x32 for desktop browser tabs)
  await sharp(sourceImagePath)
    .resize(32, 32, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('✓ Generated public/favicon-32x32.png (32x32)');

  // 8. Generate public/favicon.ico
  await sharp(sourceImagePath)
    .resize(48, 48, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ Generated public/favicon.ico');

  console.log('All nfriends mobile and desktop app icons successfully built!');
}

buildIcons().catch(err => {
  console.error('Error building icons:', err);
  process.exit(1);
});
