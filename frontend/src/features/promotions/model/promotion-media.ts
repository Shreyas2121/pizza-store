import {
  PROMOTION_DESKTOP_MIN_HEIGHT,
  PROMOTION_DESKTOP_MIN_WIDTH,
  PROMOTION_IMAGE_MAX_BYTES,
  PROMOTION_IMAGE_MAX_HEIGHT,
  PROMOTION_IMAGE_MAX_WIDTH,
  PROMOTION_IMAGE_MIMES,
  PROMOTION_MOBILE_MIN_HEIGHT,
  PROMOTION_MOBILE_MIN_WIDTH,
} from "./promotion.constants";
import type { MediaVariant } from "./promotion.types";

export const imageFileError = (file: Pick<File, "size" | "type">) => {
  if (!PROMOTION_IMAGE_MIMES.includes(file.type))
    return "Choose a JPEG, PNG or WebP image.";
  if (file.size === 0 || file.size > PROMOTION_IMAGE_MAX_BYTES)
    return `Choose a non-empty image no larger than ${PROMOTION_IMAGE_MAX_BYTES.toLocaleString()} bytes.`;
  return null;
};
export const imageDimensionsError = (
  width: number,
  height: number,
  variant: MediaVariant,
) => {
  const minimumWidth =
    variant === "desktop"
      ? PROMOTION_DESKTOP_MIN_WIDTH
      : PROMOTION_MOBILE_MIN_WIDTH;
  const minimumHeight =
    variant === "desktop"
      ? PROMOTION_DESKTOP_MIN_HEIGHT
      : PROMOTION_MOBILE_MIN_HEIGHT;
  return width < minimumWidth ||
    height < minimumHeight ||
    width > PROMOTION_IMAGE_MAX_WIDTH ||
    height > PROMOTION_IMAGE_MAX_HEIGHT
    ? `${variant} images must be at least ${minimumWidth} × ${minimumHeight} and at most ${PROMOTION_IMAGE_MAX_WIDTH} × ${PROMOTION_IMAGE_MAX_HEIGHT} pixels.`
    : null;
};
export const validateImageForUpload = async (
  file: File,
  variant: MediaVariant,
): Promise<string | null> => {
  const error = imageFileError(file);
  if (error) return error;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () =>
        resolve(
          imageDimensionsError(
            image.naturalWidth,
            image.naturalHeight,
            variant,
          ),
        );
      image.onerror = () =>
        resolve("The selected file could not be decoded as an image.");
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};
