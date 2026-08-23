import { useEffect, useState } from "react";
import { Alert, Button, Modal, TextInput } from "@mantine/core";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { useStoreStore } from "../model/store.store";

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
  const [isDetecting, setIsDetecting] = useState(false);
  const userPincode = useStoreStore((state) => state.userPincode);
  const isLoading = useStoreStore((state) => state.isLoading);
  const resolutionError = useStoreStore((state) => state.resolutionError);
  const setPincode = useStoreStore((state) => state.setPincode);

  useEffect(() => {
    if (opened) setPincodeInput(userPincode ?? "");
  }, [opened, userPincode]);

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
    if (!opened || userPincode) return;
    void handleDetection();
    // Only run the automatic suggestion once when the first-visit modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const store = await setPincode(pincode);
    if (store) onClose();
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

        {resolutionError && resolutionError.includes("closed") && (
          <Alert color="yellow" mt="md">You can try another nearby delivery pincode.</Alert>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
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
          <Button type="submit" loading={isLoading} disabled={pincode.length !== 6}>
            Show available items
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default PincodeModal;
