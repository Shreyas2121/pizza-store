export interface Store {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  opensAt: string;
  closesAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProduct {
  id: number;
  storeId: number;
  productId: number;
  pricePaise: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  product: {
    id: number;
    name: string;
    slug: string;
    pricePaise: number;
    image: string;
    isAvailable: boolean;
    categoryId: number;
  };
}

export interface DeliveryZone {
  id: number;
  storeId: number;
  pincode: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorePayload {
  name: string;
  slug?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opensAt: string;
  closesAt: string;
  isActive: boolean;
}
