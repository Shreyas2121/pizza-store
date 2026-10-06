import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import inventoryService from "../inventory/inventory.service";
import pricingService from "../pricing";
import {
  promotionApplicationService,
  PromotionApplicationService,
} from "../promotions/applications";
import { isStoreOpen, formatStoreTime } from "../stores/store-hours";
import { CodCheckoutRepository } from "./checkout-cod.repository";
import { loadCheckoutPricingItems } from "./checkout-catalogue";
interface CreateOrderSnapshotInput {
  userId: number;
  addressId: number;
  paymentId: number;
  paymentType: "cash" | "razorpay";
  status: "pending" | "awaiting_payment";
}
export class CodCheckoutService {
  constructor(
    private readonly repository = new CodCheckoutRepository(),
    private readonly pricing = pricingService,
    private readonly inventory = inventoryService,
    private readonly applications: PromotionApplicationService = promotionApplicationService,
    private readonly clock = () => new Date(),
  ) {}
  async buildQuote(
    data: { userId: number; addressId: number; couponCode?: string | null },
    tx: TransactionType,
  ) {
    const cart = await this.repository.lockCart(data.userId, tx);
    if (!cart?.storeId || !cart.items.length)
      throw new AppError("Cart is empty", 400, "CART_EMPTY");
    await this.repository.lockUser(data.userId, tx);
    const store = await this.repository.lockStore(cart.storeId, tx);
    const now = this.clock();
    if (!isStoreOpen(store.opensAt, store.closesAt, now, store.timezone))
      throw new AppError(
        "Store is closed. Opens at " +
          formatStoreTime(store.opensAt) +
          " " +
          store.timezone,
        409,
        "STORE_CLOSED",
      );
    const address = await this.repository.address(
      data.userId,
      data.addressId,
      cart.storeId,
      tx,
    );
    const productIds = [...new Set(cart.items.map((item) => item.productId))];
    const optionIds = [
      ...new Set(cart.items.flatMap((item) => item.customizationOptionIds)),
    ];
    await this.repository.lockCatalogue(
      cart.storeId,
      productIds,
      optionIds,
      tx,
    );
    const items = await loadCheckoutPricingItems(
      cart.storeId,
      cart.items.map((item) => ({ ...item, lineId: item.id })),
      tx,
    );
    const stockAllocations = await this.inventory.validateAndLockStock(
      cart.storeId,
      cart.items,
      tx,
    );
    const { quote: pricingQuote } = await this.pricing.buildQuote(
      {
        storeId: cart.storeId,
        userId: data.userId,
        items,
        couponCode: data.couponCode,
        destinationState: address.state,
        now,
      },
      { executor: tx, lockPromotions: true },
    );
    return {
      cart,
      address,
      now,
      pricingQuote,
      totalPaise: pricingQuote.grandTotalPaise,
      stockAllocations,
    };
  }
  async createOrderSnapshot(
    quote: Awaited<ReturnType<CodCheckoutService["buildQuote"]>>,
    data: CreateOrderSnapshotInput,
    tx: TransactionType,
  ) {
    const pricingQuote = quote.pricingQuote;
    const order = await this.repository.insertOrder(
      {
        userId: data.userId,
        addressId: data.addressId,
        storeId: quote.cart.storeId!,
        discountMode: pricingQuote.discountMode,
        itemsSubtotalPaise: pricingQuote.itemsSubtotalPaise,
        discountPaise: pricingQuote.itemDiscountPaise,
        deliveryFeePaise: pricingQuote.chargedDeliveryFeePaise,
        taxableAmountPaise: pricingQuote.taxableAmountPaise,
        taxPaise: pricingQuote.taxPaise,
        roundingAdjustmentPaise: pricingQuote.roundingAdjustmentPaise,
        grandTotalPaise: pricingQuote.grandTotalPaise,
        currency: pricingQuote.currency,
        quoteVersion: pricingQuote.quoteVersion,
        pricingPolicyVersion: pricingQuote.pricingPolicyVersion,
        deliveryPricingRuleId: pricingQuote.deliveryPricing.ruleId,
        deliveryPricingRuleVersion: pricingQuote.deliveryPricing.ruleVersion,
        pricingBusinessDate: pricingQuote.deliveryPricing.businessDate,
        pricingTimezone: pricingQuote.deliveryPricing.timezone,
        taxCalculationPolicyVersion: pricingQuote.tax.calculationPolicyVersion,
        taxDisclaimer: pricingQuote.tax.disclaimer,
        taxIsDemo: pricingQuote.tax.isDemo,
        placeOfSupplyState: pricingQuote.tax.placeOfSupplyState,
        deliveryTaxRuleId: pricingQuote.tax.deliveryRule.ruleId,
        deliveryTaxRuleVersion: pricingQuote.tax.deliveryRule.ruleVersion,
        deliveryTaxRateBps: pricingQuote.tax.deliveryRule.rateBps,
        deliveryTaxableAmountPaise:
          pricingQuote.tax.deliveryRule.taxableAmountPaise,
        deliveryTaxPaise: pricingQuote.tax.deliveryRule.taxPaise,
        deliveryHsnSacCode: pricingQuote.tax.deliveryRule.hsnSacCode,
        paymentType: data.paymentType,
        paymentId: data.paymentId,
        status: data.status,
      },
      tx,
    );

    const itemIds = new Map<number, number>();
    for (const item of pricingQuote.items) {
      const orderItem = await this.repository.insertItem(
        {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          productName: item.productName,
          productType: item.productType ?? "single",
          unitPricePaise: item.unitPricePaise,
          compareAtUnitPricePaise: item.compareAtUnitPricePaise ?? null,
          bundleMarkdownPaise: item.bundleMarkdownPaise ?? 0,
          lineSubtotalPaise: item.lineSubtotalPaise,
          discountAllocationPaise: item.itemDiscountPaise,
          taxRuleId: item.taxRuleId,
          taxRuleVersion: item.taxRuleVersion,
          taxRateBps: item.taxRateBps,
          taxableAmountPaise: item.taxableAmountPaise,
          taxPaise: item.taxPaise,
          lineTotalPaise: item.lineTotalPaise,
          hsnSacCode: item.hsnSacCode,
        },
        tx,
      );

      itemIds.set(item.lineId, orderItem.id);
      if (item.customizations.length > 0) {
        await this.repository.insertCustomizations(
          item.customizations.map((customization) => ({
            customizationOptionId: customization.customizationOptionId,
            orderItemId: orderItem.id,
            customizationName: customization.name,
            pricePaise: customization.pricePaise,
          })),
          tx,
        );
      }
      if ((item.bundleComponents ?? []).length > 0) {
        await this.repository.insertBundleComponents(
          item.bundleComponents.map((component) => ({
            orderItemId: orderItem.id,
            componentProductId: component.productId,
            componentName: component.name,
            quantityPerBundle: component.quantityPerBundle,
            totalQuantity: component.totalQuantity,
          })),
          tx,
        );
      }
    }

    await this.applications.record(
      order.id,
      pricingQuote,
      itemIds,
      data.status === "pending" ? "consumed" : "reserved",
      tx,
      quote.now,
    );
    return order;
  }
}
export default new CodCheckoutService();
