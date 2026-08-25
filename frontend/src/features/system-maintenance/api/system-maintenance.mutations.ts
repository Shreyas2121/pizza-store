import { useMutation } from "@tanstack/react-query";
import { API } from "@/shared/api";

export const CLEAR_ALL_CONFIRMATION = "CLEAR EVERYTHING";

interface ClearAllDataResponse {
  data: {
    cleared: true;
    clearedTableCount: number;
    deletedNonAdminUsers: number;
    preservedAdminUsers: number;
  };
  message: string;
}

export const useClearAllApplicationData = () =>
  useMutation({
    mutationFn: async () =>
      (
        await API.post<ClearAllDataResponse>("/admin/system/clear-all", {
          confirmation: CLEAR_ALL_CONFIRMATION,
        })
      ).data,
  });
