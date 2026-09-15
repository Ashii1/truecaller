import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crisp SVG for SpamShield
const svgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Background with subtle corner curve -->
  <rect width="512" height="512" rx="100" fill="url(#bgGrad)" />
  
  <!-- Subtle circular pulse rings -->
  <circle cx="256" cy="256" r="180" stroke="#4f46e5" stroke-width="2" stroke-opacity="0.25" stroke-dasharray="8 8" />
  <circle cx="256" cy="256" r="140" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.3" />

  <!-- Shield Shape -->
  <path d="M256 90 L370 140 C370 270 256 360 256 395 C256 360 142 270 142 140 Z" 
        fill="url(#shieldGrad)" 
        stroke="url(#borderGrad)" 
        stroke-width="12" 
        stroke-linejoin="round" />

  <!-- Inner Shield Glow Overlay -->
  <path d="M256 106 L354 148 C354 260 256 342 256 374 C256 342 158 260 158 148 Z" 
        fill="url(#glowGrad)" />

  <!-- Phone Handset Silhouette inside shield -->
  <path d="M225 180 C218 180 212 186 214 193 C218 212 228 240 248 260 C268 280 296 290 315 294 C322 296 328 290 328 283 L328 266 C328 261 324 256 319 255 L292 249 C288 248 284 250 282 253 L273 264 C256 254 244 242 234 225 L245 216 C248 214 250 210 249 206 L243 179 C242 174 237 170 232 170 Z" 
        fill="#ffffff" />
        
  <!-- Checkmark / Verification spark in corner of shield -->
  <circle cx="340" cy="160" r="26" fill="#10b981" stroke="#0f172a" stroke-width="6" />
  <path d="M330 160 L337 167 L352 152" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;

// Maskable SVG with safe zone padding (Android crops up to 15% outer edge)
const maskableSvgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
  </defs>

  <!-- Full bleed background for safe zone -->
  <rect width="512" height="512" fill="url(#bgGradMask)" />

  <!-- Shield Shape Scaled into safe inner zone -->
  <g transform="translate(64, 64) scale(0.75)">
    <circle cx="256" cy="256" r="180" stroke="#4f46e5" stroke-width="3" stroke-opacity="0.25" stroke-dasharray="8 8" />
    
    <path d="M256 90 L370 140 C370 270 256 360 256 395 C256 360 142 270 142 140 Z" 
          fill="url(#shieldGrad)" 
          stroke="url(#borderGrad)" 
          stroke-width="14" 
          stroke-linejoin="round" />

    <path d="M225 180 C218 180 212 186 214 193 C218 212 228 240 248 260 C268 280 296 290 315 294 C322 296 328 290 328 283 L328 266 C328 261 324 256 319 255 L292 249 C288 248 284 250 282 253 L273 264 C256 254 244 242 234 225 L245 216 C248 214 250 210 249 206 L243 179 C242 174 237 170 232 170 Z" 
          fill="#ffffff" />
          
    <circle cx="340" cy="160" r="26" fill="#10b981" stroke="#0f172a" stroke-width="6" />
    <path d="M330 160 L337 167 L352 152" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>
`;

async function generate() {
  const svgBuffer = Buffer.from(svgContent);
  const maskableSvgBuffer = Buffer.from(maskableSvgContent);

  // 1. Save main SVG
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

  // 2. pwa-192x192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 3. pwa-512x512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 4. pwa-maskable-512x512.png
  await sharp(maskableSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // 5. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 6. favicon.ico
  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png');
}

generate().catch(console.error);
