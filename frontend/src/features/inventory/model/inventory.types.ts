export type InventoryStatus =
  | "untracked"
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export type InventoryStatusFilter = "all" | "low_stock" | "out_of_stock";

export interface InventoryItem {
  storeProductId: number;
  storeId: number;
  productId: number;
  productName: string;
  productImage: string;
  price: number;
  isAvailable: boolean;
  productIsAvailable: boolean;
  onHandQuantity: number | null;
  reservedQuantity: number;
  availableQuantity: number | null;
  lowStockThreshold: number;
  lastRestockedAt: string | null;
  stockStatus: InventoryStatus;
}

export interface InventoryMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface InventoryListResponse {
  data: InventoryItem[];
  meta: InventoryMeta;
}

export interface InventoryListParams {
  storeId: number | null;
  status: InventoryStatusFilter;
  search: string;
  page: number;
  limit: number;
}

export interface InventoryMutationTarget {
  productId: number;
  productName: string;
  onHandQuantity: number | null;
  reservedQuantity: number;
  lowStockThreshold: number;
}

export type InventoryAction = "restock" | "adjust" | "threshold";
