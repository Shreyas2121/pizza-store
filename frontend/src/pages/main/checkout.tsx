import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Drawer, Radio, Skeleton, TextInput } from "@mantine/core";
import { ArrowLeft, BadgePercent, Check, ChevronRight, CircleDollarSign, LockKeyhole, MapPin, Plus, Truck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { AddressForm } from "@/features/account";
import { useGetCartCheckout } from "@/features/cart";
import { COUPON_API_HOOKS, ORDER_API_HOOKS, USER_API_HOOKS } from "@/hooks";
import { BASE_URL, Coupon, error, formatPrice, success } from "@/lib";

const StepHeading = ({ number, title, description, icon: Icon }: { number: number; title: string; description: string; icon: typeof UserRound }) => (
  <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{number}</span><div><div className="flex items-center gap-2"><h2 className="text-card-title-scale">{title}</h2><Icon size={18} className="text-brand" aria-hidden="true" /></div><p className="mt-1 text-sm text-ink-muted">{description}</p></div></div>
);

const Checkout = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading: loadingAddresses, isError: addressesError } = USER_API_HOOKS.useGetAddresses();
  const { data: cart, isLoading: loadingCart, isError: cartError } = useGetCartCheckout();
  const { data: user, isLoading: loadingUser, isError: userError } = USER_API_HOOKS.useGetUser();
  const createOrderM = ORDER_API_HOOKS.useCreateOrder();
  const validateCouponM = COUPON_API_HOOKS.useValidateCoupon();
  const redeemCouponM = COUPON_API_HOOKS.useRedeemCoupon();
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

  if (loading) return <div className="page-shell space-y-5"><Skeleton height={90} radius="lg" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-4">{[0, 1, 2].map((item) => <Skeleton key={item} height={190} radius="lg" />)}</div><Skeleton height={480} radius="lg" /></div></div>;

  if (failed || !cart || !user || itemCount === 0) {
    return <div className="page-shell"><div className="empty-state"><Truck size={36} className="text-brand" /><h1 className="mt-3 text-section-title-scale">Checkout isn’t ready</h1><p className="mt-2 text-supporting-scale">Your cart or account details could not be loaded. Return to your cart and try again.</p><Button component={Link} to="/cart" mt="lg" leftSection={<ArrowLeft size={17} />}>Back to cart</Button></div></div>;
  }

  return (
    <div className="page-shell">
      <div className="mb-7"><Link to="/cart" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"><ArrowLeft size={17} /> Back to cart</Link><h1 className="mt-2 text-page-title-scale">Checkout</h1><p className="mt-2 text-ink-muted">Confirm your details, choose a delivery address, and place your order.</p></div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
            <StepHeading number={1} title="Contact" description="We’ll use these details for order updates." icon={UserRound} />
            <div className="ml-0 mt-5 rounded-control bg-surface-muted p-4 sm:ml-[52px]"><p className="font-semibold text-ink">{user.fname} {user.lname}</p><p className="mt-1 text-sm text-ink-muted">{user.email}</p></div>
          </section>

          <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><StepHeading number={2} title="Delivery address" description="Choose where this order should arrive." icon={MapPin} /><Button variant="light" size="sm" leftSection={<Plus size={16} />} onClick={() => setAddressDrawerOpen(true)}>Add address</Button></div>
            {!addresses?.length ? (
              <button type="button" onClick={() => setAddressDrawerOpen(true)} className="ml-0 mt-5 flex min-h-28 w-full flex-col items-center justify-center rounded-card border border-dashed border-brand/40 bg-brand-soft/30 p-4 text-brand sm:ml-[52px] sm:w-[calc(100%-52px)]"><Plus size={22} /><span className="mt-2 font-semibold">Add a delivery address</span></button>
            ) : (
              <Radio.Group value={selectedAddress ? String(selectedAddress) : ""} onChange={(value) => setSelectedAddress(Number(value))}>
                <div className="ml-0 mt-5 grid gap-3 sm:ml-[52px]">
                  {addresses.map((address) => {
                    const selected = selectedAddress === address.id;
                    return <label key={address.id} className={`relative cursor-pointer rounded-card border p-4 transition-colors ${selected ? "border-brand bg-brand-soft/40 ring-1 ring-brand" : "border-border bg-surface hover:border-brand/50"}`}><div className="flex items-start gap-3"><Radio value={String(address.id)} mt={2} aria-label={`Deliver to ${address.type} address`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-ink">{address.type}</p>{selected && <span className="inline-flex items-center gap-1 text-xs font-bold text-brand"><Check size={14} /> Selected</span>}</div><p className="mt-1 text-sm leading-5 text-ink-muted">{address.street}, {address.city}, {address.state} · {address.pincode}</p><p className="mt-1 text-sm text-ink-muted">{address.phone}</p></div></div></label>;
                  })}
                </div>
              </Radio.Group>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6">
            <StepHeading number={3} title="Payment" description="Payment is collected when your order arrives." icon={CircleDollarSign} />
            <div className="ml-0 mt-5 flex items-center gap-3 rounded-card border border-basil/30 bg-basil-soft p-4 sm:ml-[52px]"><span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-basil"><Truck size={20} /></span><div><p className="font-semibold text-ink">Cash on delivery</p><p className="mt-0.5 text-sm text-ink-muted">Pay the delivery partner when you receive your order.</p></div><Check className="ml-auto text-basil" size={20} /></div>
          </section>
        </div>

        <aside className="rounded-card border border-border bg-surface p-5 shadow-subtle lg:sticky lg:top-32" aria-labelledby="checkout-summary-title">
          <div className="flex items-center justify-between gap-3"><h2 id="checkout-summary-title" className="text-card-title-scale">Order summary</h2><Badge color="brand" variant="light">{itemCount} {itemCount === 1 ? "item" : "items"}</Badge></div>
          <ul className="mt-4 max-h-52 space-y-3 overflow-y-auto border-y border-border py-4">{cart.items.map((item) => <li key={item.id} className="flex gap-3"><img src={`${BASE_URL}${item.product.image}`} alt="" className="h-12 w-12 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{item.product.name}</p><p className="text-xs text-ink-muted">Qty {item.quantity}</p></div><p className="text-sm font-semibold tabular-nums text-ink">{formatPrice((item.price + item.customizations.reduce((sum, option) => sum + option.price, 0)) * item.quantity)}</p></li>)}</ul>

          <div className="mt-4"><label htmlFor="coupon-code" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><BadgePercent size={16} className="text-brand" /> Coupon code</label><div className="flex gap-2"><TextInput id="coupon-code" value={code} onChange={(event) => setCode(event.currentTarget.value.toUpperCase())} disabled={!!coupon || validateCouponM.isPending} placeholder="Enter code" className="min-w-0 flex-1" /><Button variant={coupon ? "light" : "filled"} color={coupon ? "red" : "brand"} loading={validateCouponM.isPending} onClick={() => coupon ? (setCoupon(null), setCode("")) : applyCoupon()}>{coupon ? "Remove" : "Apply"}</Button></div>{coupon && <p className="mt-2 text-xs font-semibold text-basil">{coupon.code} applied successfully</p>}</div>

          <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums text-ink">{formatPrice(cart.totalPrice)}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Delivery fee</dt><dd className="tabular-nums text-ink">{formatPrice(0)}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className={discountAmount > 0 ? "tabular-nums text-basil" : "tabular-nums text-ink"}>{discountAmount > 0 ? "−" : ""}{formatPrice(discountAmount)}</dd></div><div className="flex items-baseline justify-between border-t border-border pt-4 text-base font-bold"><dt>Total</dt><dd className="text-2xl tabular-nums text-brand">{formatPrice(total)}</dd></div></dl>
          <Button fullWidth size="md" mt="lg" loading={createOrderM.isPending} disabled={!selectedAddress} onClick={placeOrder} rightSection={<ChevronRight size={18} />}>Place cash-on-delivery order</Button>
          <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-ink-muted"><LockKeyhole size={15} className="mt-0.5 shrink-0" /> Your order details are securely linked to your account.</p>
        </aside>
      </div>

      <Drawer opened={addressDrawerOpen} onClose={() => setAddressDrawerOpen(false)} position="right" size="100%" padding="lg" title="New delivery address" overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[560px]" }}><AddressForm onSubmit={() => setAddressDrawerOpen(false)} /></Drawer>
    </div>
  );
};

export default Checkout;
