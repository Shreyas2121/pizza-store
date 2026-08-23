export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
export type PaymentType = "cash";
export type CouponType = "percentage" | "fixed";

export type Payment = {
  status: PaymentStatus;
  id: number;
  createdAt: string;
  updatedAt: string;
  paymentDate: string;
};

export type Coupon = {
  id: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  code: string;
  discountType: CouponType;
  discountValue: number;
  minOrderValue: number;
  startDate: string;
  endDate: string;
  redemptionCount: number;
  maxRedemptions: number;
};
