export { CheckoutPage } from "./pages/checkout-page";
export { AddressStep } from "./components/address-step";
export { CouponField } from "./components/coupon-field";
export { PaymentStep } from "./components/payment-step";
export { CheckoutSummary } from "./components/checkout-summary";

export { useValidateCoupon, useRedeemCoupon } from "./api/coupon.mutations";
export { useProcessCodPayment } from "./api/payment.mutations";

export type {
  Coupon,
  Payment,
  PaymentType,
  PaymentStatus,
  CouponType,
} from "./model/checkout.types";
