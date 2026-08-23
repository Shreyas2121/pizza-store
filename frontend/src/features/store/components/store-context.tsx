import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { PincodeModal } from "./pincode-modal";
import { useStoreStore } from "../model/store.store";

export function StoreContext() {
  const userPincode = useStoreStore((state) => state.userPincode);
  const isStoreResolved = useStoreStore((state) => state.isStoreResolved);
  const setPincode = useStoreStore((state) => state.setPincode);
  const opened = useStoreStore((state) => state.isPincodeModalOpen);
  const openModal = useStoreStore((state) => state.openPincodeModal);
  const closeModal = useStoreStore((state) => state.closePincodeModal);
  const revalidationStarted = useRef(false);

  useEffect(() => {
    if (!userPincode) openModal();
  }, [openModal, userPincode]);

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
            <button type="button" onClick={openModal} className="font-bold text-brand underline underline-offset-4">
              Enter pincode
            </button>
          </div>
        </div>
      )}
      <PincodeModal opened={opened} onClose={closeModal} />
    </>
  );
}
