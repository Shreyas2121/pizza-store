import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import type { TransactionType } from "../../utils/types";
import { codCheckoutService } from "../checkout";
import { snapshotQuote } from "../promotions/promotion-application.test-fixtures";
import cartService from "../cart/cart.service";
import inventoryService from "../inventory/inventory.service";
import paymentService from "../payments/payment.service";
import { OrderService } from "./order.service";

describe("COD transaction failure boundaries", () => {
  beforeEach(() => vi.restoreAllMocks());
  it.each(["pricing", "payment", "snapshots"])(
    "propagates %s failure and preserves the cart",
    async (failure) => {
      const now = new Date("2026-10-06");
      // No executor operations should run: the use-case dependencies are stubbed.
      const tx = {} as TransactionType;
      const transaction = vi
        .spyOn(db, "transaction")
        .mockImplementation(async (operation) => operation(tx));
      const build = vi
        .spyOn(codCheckoutService, "buildQuote")
        .mockResolvedValue({
          cart: {
            storeId: 1,
            items: [
              {
                id: 101,
                productId: 11,
                quantity: 2,
                customizationOptionIds: [5],
              },
            ],
          },
          address: {
            id: 2,
            userId: 7,
            type: "Home",
            street: "Street",
            city: "City",
            state: "Karnataka",
            pincode: "123456",
            phone: "1234567890",
            createdAt: now,
            updatedAt: now,
          },
          now,
          pricingQuote: snapshotQuote(),
          totalPaise: 1800,
          stockAllocations: [],
        });
      const payment = vi
        .spyOn(paymentService, "createPayment")
        .mockRejectedValue(new Error("payment failure"));
      const snapshot = vi
        .spyOn(codCheckoutService, "createOrderSnapshot")
        .mockRejectedValue(new Error("snapshots failure"));
      const stock = vi.spyOn(inventoryService, "deductStockForCod");
      const clear = vi.spyOn(cartService, "clearCart");
      if (failure === "pricing")
        build.mockRejectedValue(new Error("pricing failure"));
      if (failure === "snapshots")
        payment.mockResolvedValue({
          id: 8,
          provider: "cod",
          status: "pending",
          amountPaise: 1800,
          currency: "INR",
          providerStatus: null,
          providerOrderId: null,
          providerPaymentId: null,
          clientRequestId: null,
          paymentDate: now,
          paidAt: null,
          failedAt: null,
          failureCode: null,
          failureDescription: null,
          createdAt: now,
          updatedAt: now,
        });
      await expect(
        new OrderService().createOrder({ userId: 7, addressId: 2 }),
      ).rejects.toThrow(`${failure} failure`);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(stock).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      if (failure === "pricing") expect(payment).not.toHaveBeenCalled();
      if (failure !== "snapshots") expect(snapshot).not.toHaveBeenCalled();
      else
        expect(payment).toHaveBeenCalledWith(
          expect.objectContaining({ amountPaise: 1800 }),
          tx,
        );
    },
  );
});
