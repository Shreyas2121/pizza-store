import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import cartService from "./cart.service";

describe("CartService stock validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("addToCart stock limits", () => {
    it("allows adding product within available stock limit", async () => {
      const mockStoreProduct = {
        id: 10,
        pricePaise: 29_900,
        isAvailable: true,
        productName: "Margherita",
        productIsAvailable: true,
        hasCustomization: false,
        storeIsActive: true,
        isTracked: true,
        availableQuantity: 5,
      };

      vi.spyOn(cartService, "getAvailableStoreProduct").mockResolvedValue(
        mockStoreProduct as any
      );
      vi.spyOn(cartService, "getExistingCart").mockResolvedValue({
        id: 1,
        userId: 10,
        storeId: 1,
        totalPaise: 29_900,
      } as any);

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { quantity: 2 }, // already 2 in cart
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 101 }]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      vi.spyOn(cartService, "addToCartItem").mockResolvedValue([
        { id: 101, cartId: 1, productId: 1, quantity: 3, pricePaise: 29_900 },
      ] as any);

      // 2 in cart + 1 = 3 <= 5 -> success
      const result = await cartService.addToCart({
        productId: 1,
        storeId: 1,
        userId: 10,
        cIds: [],
      });

      expect(result).toEqual({ cartCleared: false, storeId: 1 });
    });

    it("throws INSUFFICIENT_STOCK when adding exceeds available stock across customized lines", async () => {
      const mockStoreProduct = {
        id: 10,
        pricePaise: 29_900,
        isAvailable: true,
        productName: "Margherita",
        productIsAvailable: true,
        hasCustomization: false,
        storeIsActive: true,
        isTracked: true,
        availableQuantity: 3,
      };

      vi.spyOn(cartService, "getAvailableStoreProduct").mockResolvedValue(
        mockStoreProduct as any
      );
      vi.spyOn(cartService, "getExistingCart").mockResolvedValue({
        id: 1,
        userId: 10,
        storeId: 1,
        totalPaise: 89_700,
      } as any);

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { quantity: 2 }, // Line 1: Margherita with extra cheese: qty 2
              { quantity: 1 }, // Line 2: Margherita plain: qty 1
              // total existing in cart = 3
            ]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      // 3 in cart + 1 = 4 > 3 -> throws INSUFFICIENT_STOCK
      await expect(
        cartService.addToCart({
          productId: 1,
          storeId: 1,
          userId: 10,
          cIds: [],
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INSUFFICIENT_STOCK",
          status: 409,
          data: {
            items: [
              {
                productId: 1,
                productName: "Margherita",
                requestedQuantity: 4,
                availableQuantity: 3,
              },
            ],
          },
        })
      );
    });
  });

  describe("updateCartItemByType '+' increment stock limits", () => {
    it("throws INSUFFICIENT_STOCK when incrementing exceeds available stock", async () => {
      vi.spyOn(cartService, "assertCartItemOwner").mockResolvedValue({
        id: 50,
        cartId: 1,
        productId: 1,
        quantity: 2,
        pricePaise: 29_900,
        customizations: [],
      } as any);
      vi.spyOn(cartService, "getExistingCart").mockResolvedValue({
        id: 1,
        userId: 10,
        storeId: 1,
      } as any);
      vi.spyOn(cartService, "getAvailableStoreProduct").mockResolvedValue({
        id: 10,
        productName: "Margherita",
        isTracked: true,
        availableQuantity: 2,
      } as any);

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            { quantity: 2 }, // existing in cart = 2, + 1 = 3 > 2 available
          ]),
        }),
      })) as any);

      await expect(
        cartService.updateCartItemByType({
          cartItemId: 50,
          productId: 1,
          type: "+",
          userId: 10,
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INSUFFICIENT_STOCK",
          status: 409,
          data: {
            items: [
              {
                productId: 1,
                productName: "Margherita",
                requestedQuantity: 3,
                availableQuantity: 2,
              },
            ],
          },
        })
      );
    });
  });
});
