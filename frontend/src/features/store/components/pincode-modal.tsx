import { useEffect, useState } from "react";
import { Alert, Button, Loader, Modal, Select, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { useStoreStore } from "../model/store.store";
import { useUser } from "@/features/auth";
import { useClearCart, useGetCartOptional } from "@/features/cart";
import { error, warning } from "@/shared/lib";
import { useGetAddresses } from "@/features/account";

const LOCATION_CACHE_KEY = "pincode-suggestion";
const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000;

interface CachedPincode {
  pincode: string;
  expiresAt: number;
}

const readCachedPincode = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) ?? "null") as CachedPincode | null;
    return cached && cached.expiresAt > Date.now() ? cached.pincode : null;
  } catch {
    return null;
  }
};

const detectPincode = async () => {
  const cached = readCachedPincode();
  if (cached) return cached;

  const response = await fetch("https://ipapi.co/json/");
  if (!response.ok) throw new Error("Location lookup failed");

  const result = await response.json() as { postal?: string };
  const pincode = result.postal?.trim();
  if (!pincode || !/^\d{6}$/.test(pincode)) return null;

  localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
    pincode,
    expiresAt: Date.now() + LOCATION_CACHE_TTL,
  } satisfies CachedPincode));
  return pincode;
};

interface PincodeModalProps {
  opened: boolean;
  onClose: () => void;
}

export function PincodeModal({ opened, onClose }: PincodeModalProps) {
  const [pincode, setPincodeInput] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const userPincode = useStoreStore((state) => state.userPincode);
  const isLoading = useStoreStore((state) => state.isLoading);
  const resolutionError = useStoreStore((state) => state.resolutionError);
  const resolvedStore = useStoreStore((state) => state.resolvedStore);
  const previewPincode = useStoreStore((state) => state.previewPincode);
  const setResolvedStore = useStoreStore((state) => state.setResolvedStore);
  const isLoggedIn = useUser((state) => state.isLoggedIn);
  const cart = useGetCartOptional(isLoggedIn && opened);
  const addresses = useGetAddresses(isLoggedIn && opened);
  const clearCart = useClearCart();
  const hasSavedAddresses = isLoggedIn && (addresses.data?.length ?? 0) > 0;
  const waitingForAddresses = isLoggedIn && addresses.isLoading;
  const addressSelectionUnavailable = isLoggedIn && addresses.isError;
  const useAddressOptions = hasSavedAddresses || waitingForAddresses || addressSelectionUnavailable;

  useEffect(() => {
    if (!opened) return;
    setPincodeInput(userPincode ?? "");
    const matchingAddress = addresses.data?.find((address) => address.pincode === userPincode);
    setSelectedAddressId(matchingAddress ? String(matchingAddress.id) : null);
  }, [addresses.data, opened, userPincode]);

  const handleDetection = async () => {
    setIsDetecting(true);
    try {
      const detected = await detectPincode();
      if (detected) setPincodeInput(detected);
    } catch {
      // Detection is a convenience; manual entry remains available.
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    if (!opened || userPincode || useAddressOptions) return;
    void handleDetection();
    // Only run the automatic suggestion once when the first-visit modal opens.
  }, [opened, useAddressOptions, userPincode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedAddress = addresses.data?.find((address) => String(address.id) === selectedAddressId);
    const requestedPincode = hasSavedAddresses ? selectedAddress?.pincode ?? "" : pincode;
    const store = await previewPincode(requestedPincode);
    if (!store) return;

    const cartItems = cart.data?.items ?? [];
    const changesCartStore = cartItems.length > 0
      && cart.data?.storeId !== null
      && cart.data?.storeId !== store.id;

    const commitStore = () => {
      setResolvedStore(store, requestedPincode.trim());
      onClose();
    };

    if (!changesCartStore) {
      commitStore();
      return;
    }

    modals.openConfirmModal({
      title: "Changing your area will clear your cart",
      children: <p className="text-sm text-ink-muted">Your cart contains items from {cart.data?.store?.name ?? resolvedStore?.name ?? "your current store"}. Continue with {store.name}?</p>,
      labels: { confirm: "Clear cart and continue", cancel: "Keep current area" },
      confirmProps: { color: "red" },
      centered: true,
      onConfirm: () => clearCart.mutate(cartItems.map((item) => item.id), {
        onSuccess: () => {
          commitStore();
          warning("Your cart has been cleared because you changed your delivery area.");
        },
        onError: () => error("Your cart could not be cleared. Your delivery area was not changed."),
      }),
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={480}
      radius="lg"
      padding="xl"
      title={<span className="text-xl font-bold text-ink">Find your nearest PizzaStore</span>}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <div className="mb-6 flex gap-3 rounded-card bg-brand-soft p-4 text-ink">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand">
          <Navigation size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">See the menu available in your area</p>
          <p className="mt-1 text-sm text-ink-muted">Your pincode helps us select the store that will prepare your order.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {useAddressOptions ? (
          <Select
            label="Delivery address"
            placeholder={waitingForAddresses ? "Loading saved addresses…" : addressSelectionUnavailable ? "Saved addresses unavailable" : "Choose a saved address"}
            data={(addresses.data ?? []).map((address) => ({
              value: String(address.id),
              label: `${address.type} · ${address.street}, ${address.city} · ${address.pincode}`,
            }))}
            value={selectedAddressId}
            onChange={setSelectedAddressId}
            leftSection={<MapPin size={18} aria-hidden="true" />}
            rightSection={waitingForAddresses ? <Loader size={16} /> : undefined}
            disabled={waitingForAddresses || addressSelectionUnavailable}
            error={resolutionError ?? (addressSelectionUnavailable ? "Saved addresses could not be loaded" : undefined)}
            searchable
            allowDeselect={false}
            size="md"
          />
        ) : (
          <TextInput
            label="Delivery pincode"
            placeholder="Enter 6-digit pincode"
            value={pincode}
            onChange={(event) => setPincodeInput(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            leftSection={<MapPin size={18} aria-hidden="true" />}
            inputMode="numeric"
            autoComplete="postal-code"
            autoFocus
            required
            maxLength={6}
            error={resolutionError}
            size="md"
          />
        )}

        {resolutionError && resolutionError.includes("closed") && (
          <Alert color="yellow" mt="md">You can try another nearby delivery pincode.</Alert>
        )}
        {addressSelectionUnavailable && (
          <Alert color="red" mt="md">
            Saved addresses could not be loaded. <button type="button" className="font-bold underline" onClick={() => void addresses.refetch()}>Try again</button>
          </Alert>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {!useAddressOptions ? (
            <Button
              type="button"
              variant="subtle"
              color="dark"
              leftSection={<LocateFixed size={18} />}
              loading={isDetecting}
              onClick={() => void handleDetection()}
            >
              Detect my location
            </Button>
          ) : <span />}
          <Button type="submit" loading={isLoading || clearCart.isPending} disabled={(hasSavedAddresses ? !selectedAddressId : pincode.length !== 6) || waitingForAddresses || addressSelectionUnavailable || cart.isLoading}>
            Show available items
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default PincodeModal;
