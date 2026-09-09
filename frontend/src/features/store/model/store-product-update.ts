export interface StoreProductEditableState {
  pricePaise: number;
  isAvailable: boolean;
}

export interface StoreProductUpdatePermissions {
  canUpdatePrice: boolean;
  canUpdateAvailability: boolean;
}

export const buildStoreProductUpdate = (
  original: StoreProductEditableState,
  next: StoreProductEditableState,
  permissions: StoreProductUpdatePermissions,
): Partial<StoreProductEditableState> => {
  const update: Partial<StoreProductEditableState> = {};
  if (permissions.canUpdatePrice && next.pricePaise !== original.pricePaise) {
    update.pricePaise = next.pricePaise;
  }
  if (permissions.canUpdateAvailability && next.isAvailable !== original.isAvailable) {
    update.isAvailable = next.isAvailable;
  }
  return update;
};
