export { ProfilePage } from "./pages/profile-page";
export { AddressesPage } from "./pages/addresses-page";
export { AddressForm } from "./components/address-form";
export { ProfileSidebar } from "./components/profile-sidebar";

export {
  useGetAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  addressKeys,
} from "./api/address.queries";

export { useGetUser } from "./api/profile.queries";

export { addressSchema, type TAddress } from "./model/address.schema";
export type { Address, AddressType } from "./model/account.types";
