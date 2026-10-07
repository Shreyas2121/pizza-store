import { AppError } from "../../utils/error";
import { loadCheckoutPricingItems } from "./checkout-catalogue";
import promotionPricingService from "../pricing";
import { publicQuoteRepository } from "./checkout.repository";

export interface CalculatePublicQuoteInput {
  storeId: number;
  couponCode?: string | null;
  destinationState?: string | null;
  addressId?: number | null;
  items?: {
    productId: number;
    quantity: number;
    customizationOptionIds?: number[];
  }[];
  userId?: number;
}

class CheckoutService {
  async previewPromotionCoupon(userId: number, couponCode: string) {
    const cart = await publicQuoteRepository.findOwnedCart(userId);
    if (!cart?.storeId || cart.items.length === 0)
      throw new AppError("Cart is empty", 400, "CART_EMPTY");
    return this.calculatePublicQuote({
      userId,
      storeId: cart.storeId,
      couponCode,
    });
  }
  async calculatePublicQuote(input: CalculatePublicQuoteInput) {
    let destinationState = input.destinationState?.trim() || null;
    if (input.addressId) {
      if (!input.userId) {
        throw new AppError(
          "Authentication is required to use a saved address",
          401,
          "ADDRESS_AUTHENTICATION_REQUIRED",
        );
      }
      const addressState = await publicQuoteRepository.findAddressState(
        input.addressId,
        input.userId,
      );
      if (!addressState) {
        throw new AppError("Delivery address not found", 404);
      }
      destinationState = addressState;
    }

    let requestedItems: Array<{
      lineId: number;
      productId: number;
      quantity: number;
      customizationOptionIds?: number[];
    }>;
    if (input.items !== undefined) {
      requestedItems = input.items.map((item, index) => ({
        ...item,
        lineId: index + 1,
      }));
    } else if (input.userId) {
      const cart = await publicQuoteRepository.findOwnedCart(input.userId);
      if (!cart || cart.items.length === 0)
        throw new AppError("Cart is empty", 400, "CART_EMPTY");
      if (cart.storeId !== input.storeId)
        throw new AppError(
          "Cart belongs to a different store",
          409,
          "CART_STORE_MISMATCH",
        );
      requestedItems = cart.items.map((item) => ({
        lineId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        customizationOptionIds: item.customizationOptionIds,
      }));
    } else
      throw new AppError(
        "Quote requires items or an active cart",
        400,
        "CART_EMPTY",
      );
    if (requestedItems.length === 0)
      throw new AppError("Cart is empty", 400, "CART_EMPTY");
    const pricingItems = await loadCheckoutPricingItems(input.storeId, requestedItems);
    const { quote } = await promotionPricingService.buildQuote({
      storeId: input.storeId,
      userId: input.userId,
      items: pricingItems,
      couponCode: input.couponCode,
      destinationState,
    });

    return quote;
  }

}

export default new CheckoutService();
