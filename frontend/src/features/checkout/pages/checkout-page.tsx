import { useEffect, useMemo, useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { ArrowLeft, Truck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { AddressForm, useGetAddresses, useGetUser } from "@/features/account";
import { useGetCartCheckout } from "@/features/cart";
import { useCreateOrder } from "@/features/orders";
import { error, success } from "@/shared/lib";
import { Coupon } from "../model/checkout.types";
import { useValidateCoupon, useRedeemCoupon } from "../api/coupon.mutations";
import AddressStep from "../components/address-step";
import PaymentStep from "../components/payment-step";
import CheckoutSummary from "../components/checkout-summary";
import { DetailsPageSkeleton } from "@/shared/ui";

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading: loadingAddresses, isError: addressesError } = useGetAddresses();
  const { data: cart, isLoading: loadingCart, isError: cartError } = useGetCartCheckout();
  const { data: user, isLoading: loadingUser, isError: userError } = useGetUser();
  const createOrderM = useCreateOrder();
  const validateCouponM = useValidateCoupon();
  const redeemCouponM = useRedeemCoupon();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [code, setCode] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [addressDrawerOpen, setAddressDrawerOpen] = useState(false);

  useEffect(() => {
    if (!selectedAddress && addresses?.[0]) setSelectedAddress(addresses[0].id);
  }, [addresses, selectedAddress]);

  const { discountAmount, total } = useMemo(() => {
    const subtotal = cart?.totalPrice ?? 0;
    const amount = coupon ? coupon.discountType === "percentage" ? (coupon.discountValue / 100) * subtotal : Math.min(coupon.discountValue, subtotal) : 0;
    return { discountAmount: amount, total: Math.max(0, subtotal - amount) };
  }, [cart?.totalPrice, coupon]);

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const loading = loadingAddresses || loadingCart || loadingUser;
  const failed = addressesError || cartError || userError;

  const applyCoupon = () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) { error("Enter a coupon code"); return; }
    if (!cart) return;
    validateCouponM.mutate({ code: normalized, total: cart.totalPrice }, { onSuccess: (validated) => { setCoupon(validated); setCode(validated.code); success("Coupon applied"); } });
  };

  const placeOrder = () => {
    if (!selectedAddress) { error("Select a delivery address"); return; }
    createOrderM.mutate({ addressId: selectedAddress, totalPrice: total, paymentType: "cash", couponId: coupon?.id ?? null, discountAmount }, {
      onSuccess: (response) => {
        if (coupon) redeemCouponM.mutate({ code: coupon.code, orderId: response.data });
        success(response.message);
        navigate(`/order/${response.data}`);
      },
    });
  };

  if (loading) return <div className="page-shell"><DetailsPageSkeleton /></div>;

  if (failed || !cart || !user || itemCount === 0) {
    return <div className="page-shell"><div className="empty-state"><Truck size={36} className="text-brand" /><h1 className="mt-3 text-section-title-scale">Checkout isn’t ready</h1><p className="mt-2 text-supporting-scale">Your cart or account details could not be loaded. Return to your cart and try again.</p><Button component={Link} to="/cart" mt="lg" leftSection={<ArrowLeft size={17} />}>Back to cart</Button></div></div>;
  }

  return (
    <div className="page-shell">
      <div className="mb-7"><Link to="/cart" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"><ArrowLeft size={17} /> Back to cart</Link><h1 className="mt-2 text-page-title-scale">Checkout</h1><p className="mt-2 text-ink-muted">Confirm your details, choose a delivery address, and place your order.</p></div>

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
          />

          <PaymentStep />
        </div>

        <CheckoutSummary
          cart={cart}
          itemCount={itemCount}
          code={code}
          coupon={coupon}
          discountAmount={discountAmount}
          total={total}
          validatingCoupon={validateCouponM.isPending}
          placingOrder={createOrderM.isPending}
          canPlaceOrder={!!selectedAddress}
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
