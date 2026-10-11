export const BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "");

export const imageUrl = (image: string | null | undefined) => {
  if (!image) return undefined;
  return image.startsWith("https://") ? image : `${BASE_URL}${image}`;
};
