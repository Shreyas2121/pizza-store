import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import inventoryService from "../inventory/inventory.service";
import checkoutService from "./checkout.service";

describe("CheckoutService stock integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks cart, validates available stock, and returns stockAllocations in quote", async () => {
    const mockCart = {
      id: 1,
      userId: 10,
      storeId: 1,
      store: {
        id: 1,
        name: "Main Store",
        isActive: true,
        opensAt: "00:00",
        closesAt: "23:59",
      },
      items: [
        {
          id: 101,
          productId: 1,
          quantity: 2,
          price: 200,
          product: { name: "Margherita" },
          customizations: [],
        },
      ],
    };

    vi.spyOn(cartService, "getCart").mockResolvedValue(mockCart as any);

    const mockAllocations = [
      {
        storeProductId: 10,
        productId: 1,
        productName: "Margherita",
        demandedQuantity: 2,
        isTracked: true,
        onHandQuantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        lowStockThreshold: 5,
      },
    ];

    vi.spyOn(inventoryService, "validateAndLockStock").mockResolvedValue(
      mockAllocations
    );

    const mockTx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]), // locked cart
            })),
            limit: vi.fn().mockResolvedValue([
              { id: 1, pincode: "400001" }, // address or deliveryZone
            ]),
          })),
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { productId: 1, isAvailable: true, productIsAvailable: true },
            ]),
          })),
        })),
      })),
    } as unknown as TransactionType;

    const quote = await checkoutService.buildQuote(
      { userId: 10, addressId: 1 },
      mockTx
    );

    expect(quote.stockAllocations).toEqual(mockAllocations);
    expect(inventoryService.validateAndLockStock).toHaveBeenCalledWith(
      1,
      mockCart.items,
      mockTx
    );
  });

  it("propagates INSUFFICIENT_STOCK error when inventory validation fails", async () => {
    const mockCart = {
      id: 1,
      userId: 10,
      storeId: 1,
      store: {
        id: 1,
        name: "Main Store",
        isActive: true,
        opensAt: "00:00",
        closesAt: "23:59",
      },
      items: [
        {
          id: 101,
          productId: 1,
          quantity: 5,
          price: 200,
          product: { name: "Margherita" },
          customizations: [],
        },
      ],
    };

    vi.spyOn(cartService, "getCart").mockResolvedValue(mockCart as any);

    vi.spyOn(inventoryService, "validateAndLockStock").mockRejectedValue(
      new AppError(
        "Insufficient stock for one or more items",
        409,
        "INSUFFICIENT_STOCK",
        {
          items: [
            {
              productId: 1,
              productName: "Margherita",
              requestedQuantity: 5,
              availableQuantity: 2,
            },
          ],
        }
      )
    );

    const mockTx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            })),
            limit: vi.fn().mockResolvedValue([
              { id: 1, pincode: "400001" },
            ]),
          })),
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { productId: 1, isAvailable: true, productIsAvailable: true },
            ]),
          })),
        })),
      })),
    } as unknown as TransactionType;

    await expect(
      checkoutService.buildQuote({ userId: 10, addressId: 1 }, mockTx)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "INSUFFICIENT_STOCK",
        status: 409,
      })
    );
  });
});
