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

