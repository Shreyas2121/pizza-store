import { useEffect } from "react";
import { useAccessMe } from "../api/access.queries";
import { useStaffActiveStore } from "../model/staff-store.store";

export const useSyncStaffStore = () => {
  const { data: access, isLoading: accessLoading } = useAccessMe();
  const { activeStoreId, setActiveStoreId } = useStaffActiveStore();

  useEffect(() => {
    if (!access) return;

    if (access.platformRole === "admin") {
      // Platform admin can stay global (null) or pick any store
      return;
    }

    const validStoreIds = access.memberships.map((m) => m.store.id);
    if (validStoreIds.length === 0) {
      setActiveStoreId(null);
    } else if (validStoreIds.length === 1) {
      if (activeStoreId !== validStoreIds[0]) {
        setActiveStoreId(validStoreIds[0]);
      }
    } else {
      if (!activeStoreId || !validStoreIds.includes(activeStoreId)) {
        setActiveStoreId(validStoreIds[0]);
      }
    }
  }, [access, activeStoreId, setActiveStoreId]);

  return { access, accessLoading, activeStoreId, setActiveStoreId };
};
