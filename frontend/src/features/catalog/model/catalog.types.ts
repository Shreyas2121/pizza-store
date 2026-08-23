export type CustomizationType = "single" | "multiple";

export type Category = {
  id: number;
  name: string;
  featured: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  veg: boolean | null;
  hasCustomization: boolean;
  isAvailable: boolean;
  price: number;
  image: string;
  categoryId: number;
};

export type MenuItem = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  slug: string;
  image: string;
  position: number;
};

export type CustomizationGroup = {
  type: CustomizationType;
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  required: boolean;
};

export type CustomizationOption = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  price: number | null;
  isAvailable: boolean;
  groupId: number;
};

export type Option = CustomizationOption;

export interface Group extends CustomizationGroup {
  options: CustomizationOption[];
}

export interface ProductWithCategory extends Product {
  category: Category;
}
