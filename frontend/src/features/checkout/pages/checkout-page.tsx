import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { ArrowLeft, Clock3, MapPin, Store as StoreIcon, Truck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { AddressForm, useGetAddresses, useGetUser } from "@/features/account";
import { useGetCartCheckout } from "@/features/cart";
import { useCreateOrder } from "@/features/orders";
import { error, formatClockTime, formatStoreHours, success, warning } from "@/shared/lib";
import { Coupon, PaymentType } from "../model/checkout.types";
import { useValidateCoupon } from "../api/coupon.mutations";
import {
  useInitiateRazorpayOrder,
  useVerifyRazorpayPayment,
} from "../api/payment.mutations";
import { openRazorpayCheckout } from "../lib/razorpay";
import AddressStep from "../components/address-step";
import PaymentStep from "../components/payment-step";
import CheckoutSummary from "../components/checkout-summary";
import { DetailsPageSkeleton } from "@/shared/ui";
import { isStoreOpen, useStoreStore } from "@/features/store";
import axios from "axios";

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading: loadingAddresses, isError: addressesError } = useGetAddresses();
  const { data: cart, isLoading: loadingCart, isError: cartError } = useGetCartCheckout();
  const { data: user, isLoading: loadingUser, isError: userError } = useGetUser();
  const createOrderM = useCreateOrder();
  const validateCouponM = useValidateCoupon();
  const initiateRazorpayM = useInitiateRazorpayOrder();
  const verifyRazorpayM = useVerifyRazorpayPayment();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [code, setCode] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [addressDrawerOpen, setAddressDrawerOpen] = useState(false);
  const clientRequestId = useRef<string | null>(null);
  const resolvedStore = useStoreStore((state) => state.resolvedStore);
  const userPincode = useStoreStore((state) => state.userPincode);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);

  useEffect(() => {
    if (!selectedAddress) {
      const matchingAddress = addresses?.find((address) => address.pincode === userPincode);
      if (matchingAddress) setSelectedAddress(matchingAddress.id);
    }
  }, [addresses, selectedAddress, userPincode]);

  useEffect(() => {
    clientRequestId.current = null;
  }, [selectedAddress, coupon?.code]);

  const { discountAmount, total } = useMemo(() => {
    const subtotal = cart?.totalPrice ?? 0;
    const amount = coupon ? coupon.discountType === "percentage" ? (coupon.discountValue / 100) * subtotal : Math.min(coupon.discountValue, subtotal) : 0;
    return { discountAmount: amount, total: Math.max(0, subtotal - amount) };
  }, [cart?.totalPrice, coupon]);

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const loading = loadingAddresses || loadingCart || loadingUser;
  const failed = addressesError || cartError || userError;
  const selectedAddressDetails = addresses?.find((address) => address.id === selectedAddress);
  const addressMatchesStore = !!selectedAddressDetails && selectedAddressDetails.pincode === userPincode;
  const cartMatchesStore = !!resolvedStore && cart?.storeId === resolvedStore.id;
  const storeOpen = !!resolvedStore && isStoreOpen(resolvedStore.opensAt, resolvedStore.closesAt);

  const applyCoupon = () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) { error("Enter a coupon code"); return; }
    if (!cart) return;
    validateCouponM.mutate({ code: normalized }, { onSuccess: (validated) => { setCoupon(validated); setCode(validated.code); success("Coupon applied"); } });
  };

  const placeOrder = async () => {
    if (!user) { error("Your account details are unavailable. Refresh and try again."); return; }
    if (!resolvedStore || !userPincode) { error("Select your delivery pincode before placing the order."); openPincodeModal(); return; }
    if (!cartMatchesStore) { error("Your cart belongs to a different store. Review your delivery area."); openPincodeModal(); return; }
    if (!isStoreOpen(resolvedStore.opensAt, resolvedStore.closesAt)) { error(`This store is currently closed. It opens at ${formatClockTime(resolvedStore.opensAt)}.`); return; }
    if (!selectedAddress) { error("Select a delivery address"); return; }
    if (!addressMatchesStore) { error(`Choose an address in pincode ${userPincode}.`); return; }
    if (paymentType === "cash") {
      createOrderM.mutate({ addressId: selectedAddress, paymentType: "cash", couponCode: coupon?.code ?? null }, {
        onSuccess: (response) => {
          success(response.message);
          navigate(`/order/${response.data}`);
        },
        onError: (cause) => error(
          axios.isAxiosError<{ message?: string }>(cause)
            ? cause.response?.data.message ?? "The order could not be placed."
            : "The order could not be placed. Check store availability and try again.",
        ),
      });
      return;
    }

    if (total < 1) {
      error("Online payments require a total of at least ₹1.00. Choose cash on delivery.");
      return;
    }

    let pendingOrderId: number | null = null;
    try {
      setPaymentStatusMessage("Preparing secure payment…");
      clientRequestId.current ??= crypto.randomUUID();
      const initiation = await initiateRazorpayM.mutateAsync({
        addressId: selectedAddress,
        couponCode: coupon?.code ?? null,
        clientRequestId: clientRequestId.current,
      });
      const checkout = initiation.data;
      pendingOrderId = checkout.localOrderId;

      if (!checkout.checkoutReady) {
        const message =
          checkout.failure?.description ??
          "Your payment is still being prepared. Open the order to retry.";
        warning(message, "Payment pending");
        navigate(`/order/${checkout.localOrderId}`);
        return;
      }

      setPaymentStatusMessage("Opening Razorpay Checkout…");
      const checkoutResult = await openRazorpayCheckout({
        checkout,
        prefill: {
          name: `${user.fname} ${user.lname}`.trim(),
          email: user.email,
          contact: selectedAddressDetails?.phone,
        },
        onPaymentFailed: (message) => error(message, "Payment failed"),
      });

      if (checkoutResult.kind === "dismissed") {
        warning(
          "Payment was not confirmed. Your order is saved and can be retried.",
          "Payment window closed"
        );
        navigate(`/order/${checkout.localOrderId}`);
        return;
      }

      setPaymentStatusMessage("Verifying captured payment…");
      const verification = await verifyRazorpayM.mutateAsync({
        localOrderId: checkout.localOrderId,
        ...checkoutResult.response,
      });
      success(verification.message);
      navigate(`/order/${verification.data.localOrderId}`);
    } catch (cause) {
      const response = axios.isAxiosError<{
        message?: string;
        data?: { localOrderId?: number };
      }>(cause)
        ? cause.response?.data
        : undefined;
      pendingOrderId = response?.data?.localOrderId ?? pendingOrderId;
      error(
        response?.message ??
          (cause instanceof Error
            ? cause.message
            : "Online payment could not be completed."),
        "Payment not confirmed"
      );
      if (pendingOrderId) navigate(`/order/${pendingOrderId}`);
    } finally {
      setPaymentStatusMessage(null);
    }
  };

  const paymentBusy =
    createOrderM.isPending ||
    initiateRazorpayM.isPending ||
    verifyRazorpayM.isPending ||
    paymentStatusMessage !== null;

  if (loading) return <div className="page-shell"><DetailsPageSkeleton /></div>;

  if (!resolvedStore || !userPincode) {
    return <div className="page-shell"><div className="empty-state"><MapPin size={36} className="text-brand" /><h1 className="mt-3 text-section-title-scale">Choose your delivery area</h1><p className="mt-2 text-supporting-scale">Enter your pincode before reviewing checkout.</p><Button mt="lg" onClick={openPincodeModal} leftSection={<MapPin size={17} />}>Enter pincode</Button></div></div>;
  }

  if (failed || !cart || !user || itemCount === 0) {
    return <div className="page-shell"><div className="empty-state"><Truck size={36} className="text-brand" /><h1 className="mt-3 text-section-title-scale">Checkout isn’t ready</h1><p className="mt-2 text-supporting-scale">Your cart or account details could not be loaded. Return to your cart and try again.</p><Button component={Link} to="/cart" mt="lg" leftSection={<ArrowLeft size={17} />}>Back to cart</Button></div></div>;
  }

  return (
    <div className="page-shell">
      <div className="mb-7"><Link to="/cart" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"><ArrowLeft size={17} /> Back to cart</Link><h1 className="mt-2 text-page-title-scale">Checkout</h1><p className="mt-2 text-ink-muted">Confirm your details, choose a delivery address, and place your order.</p></div>

      <div className={`mb-5 flex items-start gap-3 rounded-card border p-4 ${storeOpen && cartMatchesStore ? "border-basil/30 bg-basil-soft" : "border-red-200 bg-red-50"}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand"><StoreIcon size={19} /></span>
        <div><p className="font-semibold text-ink">Ordering from {resolvedStore.name}</p><p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted"><span className="inline-flex items-center gap-1"><MapPin size={14} />Delivery area {userPincode}</span><span className="inline-flex items-center gap-1"><Clock3 size={14} />{formatStoreHours(resolvedStore.opensAt, resolvedStore.closesAt)} IST</span></p>{!storeOpen && <p className="mt-2 text-sm font-semibold text-danger">Store is currently closed. Checkout is unavailable until {formatClockTime(resolvedStore.opensAt)}.</p>}{!cartMatchesStore && <p className="mt-2 text-sm font-semibold text-danger">This cart belongs to a different store.</p>}</div>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
            <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">1</span><div><div className="flex items-center gap-2"><h2 className="text-card-title-scale">Contact</h2><UserRound size={18} className="text-brand" aria-hidden="true" /></div><p className="mt-1 text-sm text-ink-muted">We’ll use these details for order updates.</p></div></div>
            <div className="ml-0 mt-5 rounded-control bg-surface-muted p-4 sm:ml-[52px]"><p className="font-semibold text-ink">{user.fname} {user.lname}</p><p className="mt-1 text-sm text-ink-muted">{user.email}</p></div>
          </section>

          <AddressStep
            addresses={addresses}
            selectedAddress={selectedAddress}
            onSelectAddress={(id) => setSelectedAddress(id)}
            onOpenAddDrawer={() => setAddressDrawerOpen(true)}
            servicePincode={userPincode}
          />

          <PaymentStep
            value={paymentType}
            onChange={(value) => {
              setPaymentType(value);
              setPaymentStatusMessage(null);
              clientRequestId.current = null;
            }}
            disabled={paymentBusy}
          />
        </div>

        <CheckoutSummary
          cart={cart}
          itemCount={itemCount}
          code={code}
          coupon={coupon}
          discountAmount={discountAmount}
          total={total}
          validatingCoupon={validateCouponM.isPending}
          placingOrder={paymentBusy}
          paymentType={paymentType}
          paymentStatusMessage={paymentStatusMessage}
          canPlaceOrder={!!selectedAddress && addressMatchesStore && cartMatchesStore && storeOpen}
          onCodeChange={(newCode) => setCode(newCode)}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={() => { setCoupon(null); setCode(""); }}
          onPlaceOrder={placeOrder}
        />
      </div>

      <Drawer opened={addressDrawerOpen} onClose={() => setAddressDrawerOpen(false)} position="right" size="100%" padding="lg" title="New delivery address" overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[560px]" }}><AddressForm onSubmit={() => setAddressDrawerOpen(false)} /></Drawer>
    </div>
  );
};

export default CheckoutPage;
