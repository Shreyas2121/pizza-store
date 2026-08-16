import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import {
  Loader,
  Card,
  Button,
  Text,
  Input,
  Radio,
  Divider,
} from "@mantine/core";
import { Truck } from "lucide-react";
import {
  CART_API_HOOKS,
  COUPON_API_HOOKS,
  ORDER_API_HOOKS,
  USER_API_HOOKS,
} from "@/hooks";
import { Coupon, error, formatPrice, success } from "@/lib";

const Checkout = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading } = USER_API_HOOKS.useGetAddresses();
  const { data: cart, isLoading: loadingC } =
    CART_API_HOOKS.useGetCartCheckout();
  const { data: user, isLoading: loadingU } = USER_API_HOOKS.useGetUser();
  const createOrderM = ORDER_API_HOOKS.useCreateOrder();

  //Coupon
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);
  const validateCouponM = COUPON_API_HOOKS.useValidateCoupon();
  const redeemCouponM = COUPON_API_HOOKS.useRedeemCoupon();

  const { discountAmt, updatedTotal } = useMemo(() => {
    let discountAmt = 0;
    let updatedTotal = cart?.totalPrice ?? 0;
    if (coupon) {
      const type = coupon.discountType;
      if (type === "percentage") {
        discountAmt = (coupon.discountValue / 100) * updatedTotal;
      } else {
        discountAmt = Math.min(coupon.discountValue, updatedTotal);
      }
    }

    updatedTotal = updatedTotal - discountAmt;

    return {
      discountAmt,
      updatedTotal,
    };
  }, [cart?.totalPrice, coupon]);

  const [selectedAddress, setSelectedAddress] = useState<number | null>(
    addresses?.[0]?.id || null,
  );

  if (isLoading || loadingC || loadingU) return <Loader className="m-auto" />;

  if (!addresses || !cart || !user) {
    navigate("/");
    return null;
  }

  const handleSuccess = (msg: string, orderId: number) => {
    if (coupon) {
      redeemCouponM.mutate({
        code: coupon.code,
        orderId: orderId,
      });
    }
    success(msg);
    navigate(`/order/${orderId}`);
  };

  const handleSubmit = async () => {
    createOrderM.mutate(
      {
        addressId: selectedAddress,
        totalPrice: updatedTotal,
        paymentType: "cash",
        couponId: coupon ? coupon.id : null,
        discountAmount: discountAmt,
      },
      {
        onSuccess: (res) => {
          handleSuccess(res.message, res.data);
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT SIDE - User Details & Address Selection */}
        <div className="md:col-span-2 space-y-4">
          {/* Contact Info */}
          <Card shadow="md" padding="lg" className="border rounded-lg bg-white">
            <Text className="text-lg font-semibold">Contact Info</Text>
            <Text className="text-gray-600">
              {user.fname} {user.lname}
            </Text>
            <Text className="text-gray-600">{user.email}</Text>
          </Card>

          {/* Select Address */}
          <Card shadow="md" padding="lg" className="border rounded-lg bg-white">
            <Text className="text-lg font-semibold">Select Address</Text>
            <Radio.Group
              value={String(selectedAddress)}
              onChange={(value) => setSelectedAddress(Number(value))}
            >
              <div className="flex flex-col gap-3 mt-2">
                {addresses.map((address) => (
                  <Card
                    key={address.id}
                    padding="sm"
                    className={`border rounded-lg cursor-pointer transition-all ${
                      selectedAddress === address.id
                        ? "border-red-500 bg-red-50"
                        : "bg-gray-50"
                    }`}
                    onClick={() => setSelectedAddress(address.id)}
                  >
                    <Radio value={String(address.id)} label={address.type} />
                    <Text className="text-sm">
                      {address.street}, {address.city}, {address.state}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Pincode: {address.pincode}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Phone: {address.phone}
                    </Text>
                  </Card>
                ))}
              </div>
            </Radio.Group>
          </Card>

          {/* Payment Method */}
          <Card shadow="md" padding="lg" className="border rounded-lg bg-white">
            <Text className="text-lg font-semibold">Payment Method</Text>
            <div className="mt-2">
              <Card
                padding="sm"
                className="border border-red-500 bg-red-50 rounded-lg"
              >
                <Text className="font-medium text-gray-900">
                  Cash on Delivery
                </Text>
                <div className="flex items-center gap-2 text-gray-600 mt-1">
                  <Truck size={18} />
                  <Text className="text-sm">
                    Pay when you receive the order
                  </Text>
                </div>
              </Card>
            </div>
          </Card>

          {/* Coupon Input */}
          <Card shadow="md" padding="lg" className="border rounded-lg bg-white">
            <Text className="text-lg font-semibold">Apply Coupon</Text>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter coupon code"
                disabled={applied}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {applied ? (
                <Button
                  onClick={() => {
                    setCoupon(null);
                    setApplied(false);
                    setCode("");
                    success("Coupon removed successfully");
                  }}
                  color="red"
                  variant="light"
                >
                  Remove
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (!code) {
                      error("Coupon code is required");
                      return;
                    }

                    validateCouponM.mutate(
                      {
                        code,
                        total: cart.totalPrice,
                      },
                      {
                        onSuccess: (res) => {
                          setCoupon(res);
                          setApplied(true);
                          success("Coupon applied successfully");
                        },
                      },
                    );
                  }}
                  color="brand"
                >
                  Apply
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT SIDE - Pricing Summary */}
        <Card
          shadow="sm"
          padding="lg"
          className="border border-border rounded-card bg-surface"
        >
          <Text className="text-lg font-semibold mb-2 text-ink">Order Summary</Text>
          <Divider className="mb-3" />

          {/* Subtotal */}
          <div className="flex justify-between text-ink-muted">
            <Text>Subtotal:</Text>
            <Text>{formatPrice(cart.totalPrice)}</Text>
          </div>

          {/* Discount */}
          <div className="flex justify-between text-ink-muted mt-2">
            <Text>Discount:</Text>
            <Text>{formatPrice(discountAmt)}</Text>
          </div>

          {/* Final Price */}
          <div className="flex justify-between font-semibold text-lg mt-2 text-ink">
            <Text>Total:</Text>
            <Text>{formatPrice(updatedTotal)}</Text>
          </div>

          {/* Proceed Button */}
          <Button
            loading={createOrderM.isPending}
            onClick={handleSubmit}
            fullWidth
            color="brand"
            className="mt-4"
          >
            Place Order
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Checkout;
