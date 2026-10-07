import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, MapPin, Store as StoreIcon, Truck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { AddressForm, useGetAddresses, useGetUser } from "@/features/account";
import { cartKeys, useGetCartCheckout } from "@/features/cart";
import { useCreateOrder } from "@/features/orders";
import { error, formatClockTime, formatStoreHours, handleStockApiError, success, warning } from "@/shared/lib";
import { CheckoutQuoteRequest, PaymentType } from "../model/checkout.types";
import { useCheckoutCoupon } from "../api/promotion.mutations";
import { checkoutContextKey, checkoutErrorMessage, couponNeedsRemoval, quoteMatchesCart } from "../model/checkout.helpers";
import { ONLINE_PAYMENT_MINIMUM_PAISE } from "../model/checkout.constants";
import { useCheckoutQuote } from "../api/quote.queries";
import {
  useInitiateRazorpayOrder,
  usePaymentMethods,
  useRunPaymentSimulator,
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
  const queryClient = useQueryClient();
  const { data: addresses, isLoading: loadingAddresses, isError: addressesError } = useGetAddresses();
  const { data: cart, isLoading: loadingCart, isFetching: refreshingCart, isError: cartError } = useGetCartCheckout();
  const { data: user, isLoading: loadingUser, isError: userError } = useGetUser();
  const createOrderM = useCreateOrder();
  const initiateRazorpayM = useInitiateRazorpayOrder();
  const verifyRazorpayM = useVerifyRazorpayPayment();
  const runSimulatorM = useRunPaymentSimulator();
  const { data: paymentMethods } = usePaymentMethods();
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [addressDrawerOpen, setAddressDrawerOpen] = useState(false);
  const clientRequestId = useRef<string | null>(null);
  const resolvedStore = useStoreStore((state) => state.resolvedStore);
  const userPincode = useStoreStore((state) => state.userPincode);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);
  const storeResolving = useStoreStore((state) => state.isLoading);
  const contextKey = checkoutContextKey(user?.id, resolvedStore?.id, selectedAddress, cart);
  const coupon = useCheckoutCoupon(contextKey);
  const appliedCouponCode = coupon.appliedCode;
  const code = coupon.code;
  const paymentRequestContext = useRef<string | null>(null);
  if (paymentRequestContext.current !== contextKey) {
    paymentRequestContext.current = contextKey;
    clientRequestId.current = null;
  }

  useEffect(() => {
    if (!selectedAddress) {
      const matchingAddress = addresses?.find((address) => address.pincode === userPincode);
      if (matchingAddress) setSelectedAddress(matchingAddress.id);
    }
  }, [addresses, selectedAddress, userPincode]);

  useEffect(() => {
    clientRequestId.current = null;
  }, [selectedAddress, appliedCouponCode]);

  const selectedAddressDetails = addresses?.find((address) => address.id === selectedAddress);

  const quoteRequest = useMemo((): CheckoutQuoteRequest | null => {
    if (!resolvedStore || !cart || cart.items.length === 0) return null;
    return {
      storeId: resolvedStore.id,
      couponCode: appliedCouponCode,
      destinationState: selectedAddressDetails?.state ?? null,
      addressId: selectedAddress ?? null,
    };
  }, [resolvedStore, cart, appliedCouponCode, selectedAddressDetails?.state, selectedAddress]);

  const {
    data: quoteData,
    isLoading: loadingQuote,
    isFetching: refreshingQuote,
    isError: quoteIsError,
    error: quoteError,
    refetch: refreshQuote,
  } = useCheckoutQuote(quoteRequest, {
    enabled: !!resolvedStore && !storeResolving && !!cart && cart.storeId === resolvedStore.id && cart.items.length > 0,
    cartRevision: contextKey,
  });
  const matchingQuote = !!quoteData && !!cart && quoteMatchesCart(quoteData, cart);
  const quote = !quoteIsError && !refreshingQuote && !refreshingCart && !storeResolving && matchingQuote && cart?.storeId === resolvedStore?.id ? quoteData : null;
  useEffect(() => {
    if (quoteData && cart && !quoteMatchesCart(quoteData, cart)) {
      void queryClient.invalidateQueries({ queryKey: cartKeys.checkout() });
    }
  }, [quoteData, cart, queryClient]);
  useEffect(() => {
    if (appliedCouponCode && couponNeedsRemoval(quoteError)) {
      coupon.session.remove(checkoutErrorMessage(quoteError, "The coupon was removed. Review the current quote."));
    }
  }, [appliedCouponCode, quoteError, coupon.session]);

  const quoteErrorMessage = useMemo(() => {
    if (!quoteIsError || !quoteError) return null;
    return checkoutErrorMessage(quoteError, "Failed to calculate quote. Please retry.");
  }, [quoteIsError, quoteError]);

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const loading = loadingAddresses || loadingCart || loadingUser;
  const failed = addressesError || cartError || userError;
  const addressMatchesStore = !!selectedAddressDetails && selectedAddressDetails.pincode === userPincode;
  const cartMatchesStore = !!resolvedStore && cart?.storeId === resolvedStore.id;
  const storeOpen = !!resolvedStore && isStoreOpen(resolvedStore.opensAt, resolvedStore.closesAt);

  const totalPaise = quote?.grandTotalPaise ?? 0;

  const applyCoupon = () => {
    if (paymentBusy) return;
    void coupon.apply(quote?.couponEligibility.eligible === true);
  };

  const placeOrder = async () => {
    if (paymentBusy || coupon.pending || refreshingQuote || refreshingCart || storeResolving) return;
    if (!user) { error("Your account details are unavailable. Refresh and try again."); return; }
    if (!resolvedStore || !userPincode) { error("Select your delivery pincode before placing the order."); openPincodeModal(); return; }
    if (!cartMatchesStore) { error("Your cart belongs to a different store. Review your delivery area."); openPincodeModal(); return; }
    if (!isStoreOpen(resolvedStore.opensAt, resolvedStore.closesAt)) { error(`This store is currently closed. It opens at ${formatClockTime(resolvedStore.opensAt)}.`); return; }
    if (!selectedAddress) { error("Select a delivery address"); return; }
    if (!addressMatchesStore) { error(`Choose an address in pincode ${userPincode}.`); return; }
    if (quoteIsError) {
      error(quoteErrorMessage ?? "Cannot place order due to pricing discrepancy. Please review your cart.");
      return;
    }
    if (!quote) {
      error("The server is still calculating the authoritative total. Please wait and try again.");
      return;
    }
    if (paymentType === "razorpay" && !paymentMethods?.razorpay) {
      setPaymentType("cash");
      warning("Online payment is currently unavailable. Cash on delivery is still available.");
      return;
    }
    if (paymentType === "cash") {
      createOrderM.mutate({ addressId: selectedAddress, paymentType: "cash", couponCode: appliedCouponCode }, {
        onSuccess: (response) => {
          success(response.message);
          navigate(`/order/${response.data}`);
        },
        onError: (cause) => {
          const message = checkoutErrorMessage(cause, "The order could not be placed. Refresh your quote and try again.");
          if (appliedCouponCode && couponNeedsRemoval(cause)) coupon.session.remove(message);
          else coupon.session.showError(message);
          const stockResult = handleStockApiError(
            cause,
            "The order could not be placed. Check store availability and try again."
          );
          queryClient.invalidateQueries({ queryKey: ["cart"] });
          queryClient.invalidateQueries({ queryKey: ["catalog"] });
          queryClient.invalidateQueries({ queryKey: ["checkout-quote"] });
          if (stockResult.isStockError) {
            navigate("/cart");
          }
        },
      });
      return;
    }

    if (totalPaise < ONLINE_PAYMENT_MINIMUM_PAISE) {
      error("Online payments require a total of at least ₹1.00. Choose cash on delivery.");
      return;
    }

    let pendingOrderId: number | null = null;
    try {
      setPaymentStatusMessage("Preparing secure payment…");
      clientRequestId.current ??= crypto.randomUUID();
      const initiation = await initiateRazorpayM.mutateAsync({
        addressId: selectedAddress,
        couponCode: appliedCouponCode,
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

      setPaymentStatusMessage("Preparing online checkout…");
      if (checkout.providerMode === "simulator") {
        setPaymentStatusMessage("Running deterministic demo payment...");
        const simulated = await runSimulatorM.mutateAsync({
          localOrderId: checkout.localOrderId,
        });
        if (!simulated.data.reconciliation) {
          throw new Error("The simulator did not produce a payment result.");
        }
        success(simulated.message);
        navigate(`/order/${simulated.data.reconciliation.localOrderId}`);
        return;
      }

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
      const message = checkoutErrorMessage(cause, "Online payment could not be completed. Review your saved order or try again.");
      if (appliedCouponCode && couponNeedsRemoval(cause)) coupon.session.remove(message);
      else coupon.session.showError(message);
      const response = axios.isAxiosError<{
        message?: string;
        data?: { localOrderId?: number };
      }>(cause)
        ? cause.response?.data
        : undefined;
      pendingOrderId = response?.data?.localOrderId ?? pendingOrderId;

      const stockResult = handleStockApiError(
        cause,
        "Online payment could not be completed."
      );
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["checkout-quote"] });

      if (stockResult.isStockError) {
        navigate("/cart");
        return;
      }

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
            disabled={paymentBusy}
          />

          <PaymentStep
            value={paymentType}
            razorpayEnabled={paymentMethods?.razorpay ?? false}
            providerMode={paymentMethods?.providerMode}
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
          appliedCouponCode={appliedCouponCode}
          quote={quote ?? null}
          loadingQuote={loadingQuote || refreshingQuote || refreshingCart || storeResolving || (!!quoteData && !matchingQuote)}
          quoteError={quoteErrorMessage}
          validatingCoupon={coupon.pending}
          couponError={coupon.error}
          couponMessage={coupon.message}
          placingOrder={paymentBusy}
          paymentType={paymentType}
          paymentStatusMessage={paymentStatusMessage}
          canPlaceOrder={
            !!selectedAddress &&
            addressMatchesStore &&
            cartMatchesStore &&
            storeOpen &&
            !quoteIsError &&
            !refreshingQuote &&
            !refreshingCart &&
            !coupon.pending &&
            !storeResolving &&
            !!quote
          }
          onCodeChange={coupon.session.setCode}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={() => coupon.session.remove()}
          onRefreshQuote={() => void refreshQuote()}
          onPlaceOrder={placeOrder}
        />
      </div>

      <Drawer opened={addressDrawerOpen} onClose={() => setAddressDrawerOpen(false)} position="right" size="100%" padding="lg" title="New delivery address" overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[560px]" }}><AddressForm onSubmit={() => setAddressDrawerOpen(false)} /></Drawer>
    </div>
  );
};

export default CheckoutPage;
