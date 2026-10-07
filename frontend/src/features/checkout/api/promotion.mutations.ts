import { useEffect, useMemo, useSyncExternalStore } from "react";
import { API } from "@/shared/api";
import type { PricingQuote } from "../model/checkout.types";
import { CouponSession } from "../model/coupon-session";

export const validateManualCoupon = async (couponCode: string, signal: AbortSignal) =>
  (await API.post<{ data: PricingQuote }>("/promotions/validate", { couponCode }, { signal })).data.data;

export function useCheckoutCoupon(contextKey: string) {
  const session = useMemo(() => new CouponSession(contextKey), [contextKey]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => () => session.cancel(), [session]);
  return { ...state, session, apply: (eligible: boolean) => session.apply(eligible, validateManualCoupon) };
}
