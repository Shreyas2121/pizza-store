import sharp from "sharp";
import { PROMOTION_DESKTOP_MIN_HEIGHT, PROMOTION_DESKTOP_MIN_WIDTH, PROMOTION_MOBILE_MIN_HEIGHT, PROMOTION_MOBILE_MIN_WIDTH } from "../features/promotions";

// Trusted fixture artwork, rasterized internally. Public upload validation still rejects SVG.
export async function promotionFixtureArtwork(variant: "desktop" | "mobile", discount: "percentage" | "fixed_amount" = "percentage") {
  const width = variant === "desktop" ? PROMOTION_DESKTOP_MIN_WIDTH : PROMOTION_MOBILE_MIN_WIDTH;
  const height = variant === "desktop" ? PROMOTION_DESKTOP_MIN_HEIGHT : PROMOTION_MOBILE_MIN_HEIGHT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#fff7e8"/>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="28" fill="#155e3d"/>
    <g fill="#fff7e8" font-family="sans-serif">
      <text x="56" y="100" font-size="24">PIZZASTORE DEMO OFFER</text>
      <text x="56" y="180" font-size="52" font-weight="bold">${discount === "percentage" ? "Save 10%" : "Save Rs 20"}</text>
      <text x="56" y="235" font-size="24">${discount === "percentage" ? "Margherita base price" : "Pizza base prices"}</text>
      <text x="56" y="290" font-size="18">Checkout confirms eligibility.</text>
      <text x="56" y="325" font-size="18">Coupons cannot be combined.</text>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}
