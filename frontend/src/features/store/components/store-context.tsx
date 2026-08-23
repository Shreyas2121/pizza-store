import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { PincodeModal } from "./pincode-modal";
import { useStoreStore } from "../model/store.store";

export function StoreContext() {
  const userPincode = useStoreStore((state) => state.userPincode);
  const isStoreResolved = useStoreStore((state) => state.isStoreResolved);
  const setPincode = useStoreStore((state) => state.setPincode);
  const [opened, setOpened] = useState(!userPincode);
  const revalidationStarted = useRef(false);
  const previousPincode = useRef(userPincode);

  useEffect(() => {
    if (previousPincode.current && !userPincode) setOpened(true);
    previousPincode.current = userPincode;
  }, [userPincode]);

  useEffect(() => {
    if (!userPincode || revalidationStarted.current) return;
    revalidationStarted.current = true;
    void setPincode(userPincode);
  }, [setPincode, userPincode]);

  return (
    <>
      {!isStoreResolved && !opened && (
        <div className="border-b border-brand/20 bg-brand-soft px-5 py-3 text-ink">
          <div className="mx-auto flex max-w-storefront items-center justify-center gap-3 text-center text-sm sm:text-base">
            <MapPin className="shrink-0 text-brand" size={19} aria-hidden="true" />
            <span className="font-medium">Enter your delivery pincode to see available items.</span>
            <button type="button" onClick={() => setOpened(true)} className="font-bold text-brand underline underline-offset-4">
              Enter pincode
            </button>
          </div>
        </div>
      )}
      <PincodeModal opened={opened} onClose={() => setOpened(false)} />
    </>
  );
}
