export type AddressType = "Home" | "Work" | "Other";

export type Address = {
  type: AddressType;
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};
