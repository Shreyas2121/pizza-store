import type { PromotionDefinitionWriteInput } from "./promotion.schemas";
import type {
  PROMOTION_DERIVED_STATUSES,
  PROMOTION_MEDIA_VARIANTS,
} from "./promotion.constants";

export type PromotionDefinition = PromotionDefinitionWriteInput;
export type PromotionDiscount = PromotionDefinition["discount"];
export type PromotionRule = PromotionDefinition["rules"][number];
export type PromotionStatus = (typeof PROMOTION_DERIVED_STATUSES)[number];
export type MediaVariant = (typeof PROMOTION_MEDIA_VARIANTS)[number];
export interface Promotion extends PromotionDefinition {
  id: number;
  definitionVersion: number;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
  display: PromotionDefinition["display"] & {
    imageUrl: string | null;
    mobileImageUrl: string | null;
    imageAlt: string | null;
  };
  storeParticipation?: {
    storeId: number;
    enabled: boolean;
    effectiveEnabled: boolean;
  };
}
export interface StorePromotion {
  promotion: Omit<
    Promotion,
    "display" | "createdAt" | "updatedAt" | "storeParticipation"
  >;
  storeId: number;
  explicitSetting: {
    enabled: boolean;
    reason: string | null;
    updatedByUserId: number;
    updatedAt: string;
  } | null;
  effectiveEnabled: boolean;
  effectiveStatus: "enabled" | "store_disabled" | "globally_inactive";
  canToggle: boolean;
}
export interface PromotionPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
export interface PromotionFilters {
  kind?: PromotionDefinition["kind"];
  status?: PromotionStatus;
  storeId?: number;
  page: number;
  pageSize: number;
}
export interface AnalyticsFilters {
  fromBusinessDate?: string;
  toBusinessDate?: string;
  storeId?: number;
}
export interface AnalyticsTotals {
  reservedApplications: string;
  consumedApplications: string;
  releasedApplications: string;
  uniqueUsers: string;
  itemDiscountPaise: string;
  deliveryDiscountPaise: string;
  totalSavingsPaise: string;
  influencedOrderValuePaise: string;
  netRevenueReductionPaise: string;
}
export interface PromotionAnalytics {
  promotionId: number;
  fromBusinessDate: string;
  toBusinessDate: string;
  totals: AnalyticsTotals;
  stores: Array<
    Omit<AnalyticsTotals, "reservedApplications" | "releasedApplications"> & {
      storeId: number;
      storeName: string;
    }
  >;
}
export interface MediaUploadResponse {
  promotionId: number;
  definitionVersion: number;
  variant: MediaVariant;
  url: string;
  imageAlt: string;
  replacedUrl: string | null;
}
