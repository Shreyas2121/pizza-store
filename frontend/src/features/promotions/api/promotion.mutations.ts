import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { promotionKeys } from "../model/promotion.keys";
import {
  promotionDefinitionWriteSchema,
  promotionUpdateRequestSchema,
  storePromotionSettingWriteSchema,
} from "../model/promotion.schemas";
import type {
  MediaUploadResponse,
  MediaVariant,
  Promotion,
  PromotionDefinition,
  StorePromotion,
} from "../model/promotion.types";
import { usePromotionAccess } from "./promotion.queries";

const requirePermission = (allowed: boolean) => {
  if (!allowed) throw new Error("Promotion permission is required");
};
export const usePromotionMutations = () => {
  const client = useQueryClient();
  const { userId, admin, manager, activeStoreId } = usePromotionAccess();
  const invalidate = () =>
    client.invalidateQueries({ queryKey: promotionKeys.principal(userId) });
  const save = useMutation({
    mutationFn: async ({
      id,
      version,
      definition,
    }: {
      id?: number;
      version?: number;
      definition: PromotionDefinition;
    }) => {
      requirePermission(admin);
      const response =
        id === undefined
          ? await API.post<{ data: Promotion }>(
              "/promotions",
              promotionDefinitionWriteSchema.parse(definition),
            )
          : await API.put<{ data: Promotion }>(
              `/promotions/${id}`,
              promotionUpdateRequestSchema.parse({
                ...definition,
                expectedDefinitionVersion: version,
              }),
            );
      return response.data.data;
    },
    onSuccess: invalidate,
  });
  const deactivate = useMutation({
    mutationFn: async (id: number) => {
      requirePermission(admin);
      return (await API.delete<{ data: Promotion }>(`/promotions/${id}`)).data
        .data;
    },
    onSuccess: invalidate,
  });
  const upload = useMutation({
    mutationFn: async ({
      id,
      file,
      variant,
      imageAlt,
    }: {
      id: number;
      file: File;
      variant: MediaVariant;
      imageAlt: string;
    }) => {
      requirePermission(admin);
      const body = new FormData();
      body.append("file", file);
      body.append("variant", variant);
      body.append("imageAlt", imageAlt.trim());
      // Override the client's JSON default; Axios/browser supply the multipart boundary.
      return (
        await API.post<{ data: MediaUploadResponse }>(
          `/promotions/${id}/images`,
          body,
          { headers: { "Content-Type": undefined } },
        )
      ).data.data;
    },
    onSuccess: invalidate,
  });
  const removeImage = useMutation({
    mutationFn: async ({
      id,
      variant,
    }: {
      id: number;
      variant: MediaVariant;
    }) => {
      requirePermission(admin);
      return (
        await API.delete<{ data: Promotion }>(`/promotions/${id}/images`, {
          data: { variant },
        })
      ).data.data;
    },
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: async ({
      storeId,
      id,
      enabled,
      reason,
    }: {
      storeId: number;
      id: number;
      enabled: boolean;
      reason?: string;
    }) => {
      requirePermission(manager && storeId === activeStoreId);
      return (
        await API.put<{ data: StorePromotion }>(
          `/stores/${storeId}/promotions/${id}/setting`,
          storePromotionSettingWriteSchema.parse({
            enabled,
            ...(reason?.trim() ? { reason } : {}),
          }),
        )
      ).data.data;
    },
    onSuccess: invalidate,
  });
  return { save, deactivate, upload, removeImage, toggle };
};
