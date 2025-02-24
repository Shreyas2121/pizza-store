export const filterImage = (file: Express.Multer.File) => {
  return `/api/v1/${file.path.replace(/\\/g, "/")}`;
};

export const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "-");
};
