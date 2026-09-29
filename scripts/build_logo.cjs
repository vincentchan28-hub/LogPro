const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// 1. Generate the exact SVG vector
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">
  <!-- Stroke 1 Top-Left Segment -->
  <polygon points="10.4,32 139.9,32 70.3,128.6" fill="#000000" />

  <!-- Stroke 1 Bottom-Right Segment -->
  <polygon points="125.7,111.4 185.6,208 56.1,208" fill="#000000" />

  <!-- Stroke 2 Top-Right Tip -->
  <polygon points="182.9,32 197.4,32 164.2,78 149.7,78" fill="#000000" />

  <!-- Stroke 2 Bottom-Left Tip -->
  <polygon points="31.8,162 46.3,162 13.1,208 -1.4,208" fill="#000000" />

  <!-- Thin Black Stripe -->
  <polygon points="155,8 161.5,8 7.5,222 1,222" fill="#000000" />

  <!-- Crimson Red Stripe -->
  <polygon points="174,0 187,0 17,240 4,240" fill="#c01818" />
</svg>
`;

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgContent.trim());
console.log('Written public/logo.svg');

// 2. Generate favicon.svg (with crisp transparent or light rounded backing for browser tab visibility)
const faviconContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">
  <rect width="200" height="240" rx="36" fill="#f8fafc" />
  <!-- Stroke 1 Top-Left Segment -->
  <polygon points="10.4,32 139.9,32 70.3,128.6" fill="#000000" />

  <!-- Stroke 1 Bottom-Right Segment -->
  <polygon points="125.7,111.4 185.6,208 56.1,208" fill="#000000" />

  <!-- Stroke 2 Top-Right Tip -->
  <polygon points="182.9,32 197.4,32 164.2,78 149.7,78" fill="#000000" />

  <!-- Stroke 2 Bottom-Left Tip -->
  <polygon points="31.8,162 46.3,162 13.1,208 -1.4,208" fill="#000000" />

  <!-- Thin Black Stripe -->
  <polygon points="155,8 161.5,8 7.5,222 1,222" fill="#000000" />

  <!-- Crimson Red Stripe -->
  <polygon points="174,0 187,0 17,240 4,240" fill="#c01818" />
</svg>
`;
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconContent.trim());
console.log('Written public/favicon.svg');

// 3. Generate raster PNG (logo.png) with true alpha transparency and 4x supersampling
const targetWidth = 400;
const targetHeight = 480;
const scale = 4; // 4x supersampling for ultra smooth antialiasing
const sWidth = targetWidth * scale;
const sHeight = targetHeight * scale;

// Point-in-polygon test
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Convert 200x240 coordinates to supersample coordinates
const polys = [
  // Top-Left Segment (Black)
  {
    color: [0, 0, 0],
    pts: [[10.4, 32], [139.9, 32], [70.3, 128.6]].map(([x, y]) => [x * (sWidth / 200), y * (sHeight / 240)])
  },
  // Bottom-Right Segment (Black)
  {
    color: [0, 0, 0],
    pts: [[125.7, 111.4], [185.6, 208], [56.1, 208]].map(([x, y]) => [x * (sWidth / 200), y * (sHeight / 240)])
  },
  // Top-Right Tip (Black)
  {
    color: [0, 0, 0],
    pts: [[182.9, 32], [197.4, 32], [164.2, 78], [149.7, 78]].map(([x, y]) => [x * (sWidth / 200), y * (sHeight / 240)])
  },
  // Bottom-Left Tip (Black)
  {
    color: [0, 0, 0],
    pts: [[31.8, 162], [46.3, 162], [13.1, 208], [-1.4, 208]].map(([x, y]) => [x * (sWidth / 200), y * (sHeight / 240)])
  },
  // Thin Black Stripe
  {
    color: [0, 0, 0],
    pts: [[155, 8], [161.5, 8], [7.5, 222], [1, 222]].map(([x, y]) => [x * (sWidth / 200), y * (sHeight / 240)])
  },
  // Crimson Red Stripe
  {
    color: [192, 24, 24],
    pts: [[174, 0], [187, 0], [17, 240], [4, 240]].map(([x, y]) => [x * (sWidth / 200), y * (sHeight / 240)])
  }
];

const png = new PNG({ width: targetWidth, height: targetHeight });

// Render using downsampling
for (let y = 0; y < targetHeight; y++) {
  for (let x = 0; x < targetWidth; x++) {
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    
    for (let sy = 0; sy < scale; sy++) {
      const py = y * scale + sy + 0.5;
      for (let sx = 0; sx < scale; sx++) {
        const px = x * scale + sx + 0.5;
        
        let sampleR = 0, sampleG = 0, sampleB = 0, sampleA = 0;
        // Test in reverse so red/black stripes render correctly on top if overlapping
        for (let p = 0; p < polys.length; p++) {
          if (pointInPoly(px, py, polys[p].pts)) {
            sampleR = polys[p].color[0];
            sampleG = polys[p].color[1];
            sampleB = polys[p].color[2];
            sampleA = 255;
            break;
          }
        }
        rSum += sampleR;
        gSum += sampleG;
        bSum += sampleB;
        aSum += sampleA;
      }
    }
    
    const count = scale * scale;
    const idx = (targetWidth * y + x) << 2;
    const finalA = Math.round(aSum / count);
    if (finalA > 0) {
      png.data[idx] = Math.round(rSum / count);
      png.data[idx + 1] = Math.round(gSum / count);
      png.data[idx + 2] = Math.round(bSum / count);
      png.data[idx + 3] = finalA;
    } else {
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = 0; // completely transparent
    }
  }
}

const buffer = PNG.sync.write(png);
fs.writeFileSync(path.join(publicDir, 'logo.png'), buffer);
console.log('Written public/logo.png (size:', buffer.length, 'bytes)');
