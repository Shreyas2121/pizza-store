export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
export type PaymentType = "cash";
export type CouponType = "percentage" | "fixed";

export type Payment = {
  status: PaymentStatus;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  paymentDate: Date;
};

export type Coupon = {
  id: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  code: string;
  discountType: CouponType;
  discountValue: number;
  minOrderValue: number;
  startDate: Date;
  endDate: Date;
  redemptionCount: number;
  maxRedemptions: number;
};
