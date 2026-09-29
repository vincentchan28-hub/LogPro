import fs from 'node:fs'

// Precise geometric model of x10 logo
// ViewBox: 0 0 200 240

// Center of intersection
const yCenter = 120
const xCenter = 98

// Slope of Stroke 2 (bottom-left to top-right slash)
// dx/dy: for each +1 in y, x decreases by s2
const s2 = 0.72
function cx(y) {
  return xCenter - (y - yCenter) * s2
}

// Stroke 1 (top-left to bottom-right)
// dx/dy: for each +1 in y, x increases by s1
const s1 = 0.62
const w1 = 66 // horizontal width of Stroke 1
function s1Left(y) {
  return (xCenter - w1 / 2) + (y - yCenter) * s1
}
function s1Right(y) {
  return s1Left(y) + w1
}

// Slice boundaries along Stroke 2:
const sliceLeft = 21.5
const sliceRight = 21.5

// Cut boundaries
function cutL(y) { return cx(y) - sliceLeft }
function cutR(y) { return cx(y) + sliceRight }

// Red stripe boundaries
function redL(y) { return cx(y) - 6.5 }
function redR(y) { return cx(y) + 6.5 }

// Left thin stripe
function p1L(y) { return cx(y) - 16.5 }
function p1R(y) { return cx(y) - 11 }

// Right thin stripe
function p2L(y) { return cx(y) + 11 }
function p2R(y) { return cx(y) + 16.5 }

// Top & bottom baselines for X caps
const yTop = 32
const yBottom = 208

// Red stripe extends beyond caps:
const yRedTop = 0
const yRedBottom = 240

// Left thin stripe
const yP1Top = 8
const yP1Bottom = 222

// Right thin stripe
const yP2Top = 32
const yP2Bottom = 216

// 1. Red Stripe
const redStripe = `<polygon points="${redL(yRedTop).toFixed(1)},${yRedTop} ${redR(yRedTop).toFixed(1)},${yRedTop} ${redR(yRedBottom).toFixed(1)},${yRedBottom} ${redL(yRedBottom).toFixed(1)},${yRedBottom}" fill="#b91c1c" />`

// 2. Left Thin Black Stripe
const leftThinStripe = `<polygon points="${p1L(yP1Top).toFixed(1)},${yP1Top} ${p1R(yP1Top).toFixed(1)},${yP1Top} ${p1R(yP1Bottom).toFixed(1)},${yP1Bottom} ${p1L(yP1Bottom).toFixed(1)},${yP1Bottom}" fill="#000000" />`

// 3. Right Thin Black Stripe
const rightThinStripe = `<polygon points="${p2L(yP2Top).toFixed(1)},${yP2Top} ${p2R(yP2Top).toFixed(1)},${yP2Top} ${p2R(yP2Bottom).toFixed(1)},${yP2Bottom} ${p2L(yP2Bottom).toFixed(1)},${yP2Bottom}" fill="#000000" />`

// 4. Stroke 1 - Top Left Segment
const yIntCenterL = yCenter + (w1 / 2 - sliceLeft) / (s1 + s2)

const stroke1Top = `<polygon points="
  ${s1Left(yTop).toFixed(1)},${yTop}
  ${cutL(yTop).toFixed(1)},${yTop}
  ${cutL(yIntCenterL).toFixed(1)},${yIntCenterL.toFixed(1)}
  ${s1Left(yIntCenterL).toFixed(1)},${yIntCenterL.toFixed(1)}
" fill="#000000" />`

// 5. Stroke 1 - Bottom Right Segment
const yIntCenterR = yCenter - (w1 / 2 - sliceRight) / (s1 + s2)

const stroke1Bottom = `<polygon points="
  ${cutR(yIntCenterR).toFixed(1)},${yIntCenterR.toFixed(1)}
  ${s1Right(yIntCenterR).toFixed(1)},${yIntCenterR.toFixed(1)}
  ${s1Right(yBottom).toFixed(1)},${yBottom}
  ${cutR(yBottom).toFixed(1)},${yBottom}
" fill="#000000" />`

// 6. Stroke 2 - Top Right Tip
// Bounded at top by yTop, left by cutR, outer edge meets cutR at y = 86
const stroke2Top = `<polygon points="
  ${cutR(yTop).toFixed(1)},${yTop}
  192,${yTop}
  ${cutR(86).toFixed(1)},86
" fill="#000000" />`

// 7. Stroke 2 - Bottom Left Tip
// Bounded at bottom by yBottom, right by cutL, outer edge meets cutL at y = 154
const stroke2Bottom = `<polygon points="
  8,${yBottom}
  ${cutL(yBottom).toFixed(1)},${yBottom}
  ${cutL(154).toFixed(1)},154
" fill="#000000" />`

const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">
  <!-- Stroke 1 Top-Left Segment -->
  ${stroke1Top}

  <!-- Stroke 1 Bottom-Right Segment -->
  ${stroke1Bottom}

  <!-- Stroke 2 Top-Right Tip -->
  ${stroke2Top}

  <!-- Stroke 2 Bottom-Left Tip -->
  ${stroke2Bottom}

  <!-- Left Thin Black Stripe -->
  ${leftThinStripe}

  <!-- Center Crimson Red Stripe -->
  ${redStripe}

  <!-- Right Thin Black Stripe -->
  ${rightThinStripe}
</svg>
`

fs.writeFileSync('public/logo.svg', finalSvg)
fs.writeFileSync('public/favicon.svg', finalSvg)
console.log('Saved public/logo.svg and public/favicon.svg successfully!')
