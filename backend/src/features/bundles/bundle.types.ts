export interface BundleComponentDefinition {
  productId: number;
  name: string;
  quantityPerBundle: number;
  isAvailable: boolean;
}

export interface BundleDefinition {
  bundleProductId: number;
  bundleName: string;
  components: BundleComponentDefinition[];
}

export interface BundleProductDto {
  productId: number;
  productType: "bundle";
  name: string;
  description: string | null;
  imageUrl: string;
  storeId: number;
  sellingPricePaise: number;
  compareAtPricePaise: number;
  markdownPaise: number;
  isAvailable: boolean;
  unavailableComponentIds: number[];
  components: BundleComponentDefinition[];
}

export interface BundleDemandLine {
  productId: number;
  quantity: number;
}

export interface BundleComponentSnapshot {
  productId: number;
  name: string;
  quantityPerBundle: number;
  totalQuantity: number;
}
