export type AddressType = "Home" | "Work" | "Other";

export type Address = {
  type: AddressType;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};
