import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useGetAddresses, useGetUser } from "../../hooks/user";
import { useGetCartCheckout } from "../../hooks/cart";
import {
  Loader,
  Card,
  Button,
  Text,
  Input,
  Radio,
  Divider,
} from "@mantine/core";
import { CreditCard, Truck } from "lucide-react";
import { useCreateOrder } from "../../hooks/order";
import { error, formatPrice, success } from "../../lib/utils";
import { useProcessPayment, useValidatePayment } from "../../hooks/payment";
import { useRedeemCoupon, useValidateCoupon } from "../../hooks/coupon";
import { Coupon } from "../../lib/types";

const Checkout = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading } = useGetAddresses();
  const { data: cart, isLoading: loadingC } = useGetCartCheckout();
  const { data: user, isLoading: loadingU } = useGetUser();
  const createOrderM = useCreateOrder();
  const paymentM = useProcessPayment();
  const validateM = useValidatePayment();

  //Coupon
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);
  const validateCouponM = useValidateCoupon();
  const redeemCouponM = useRedeemCoupon();

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
    addresses?.[0]?.id || null
  );
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("COD");

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

  const handlSubmit = async () => {
    if (paymentMethod === "COD") {
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
        }
      );
    } else {
      const { paymentId, orderId, amount } = await paymentM.mutateAsync({
        amount: updatedTotal,
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_ID,
        amount,
        order_id: orderId,

        handler: async (response: any) => {
          await validateM.mutateAsync({
            ...response,
            paymentId: paymentId,
          });

          success("Payment successful");
          const data = await createOrderM.mutateAsync({
            addressId: selectedAddress,
            totalPrice: updatedTotal,
            paymentType: "online",
            paymentId,
            couponId: coupon ? coupon.id : null,
            discountAmount: discountAmt,
          });

          handleSuccess(data.message, data.data);
        },
      };

      const rz = new (window as any).Razorpay(options);
      rz.open();
    }
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
            <Radio.Group
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as "COD" | "ONLINE")}
            >
              <div className="flex flex-col gap-3 mt-2">
                <Card
                  padding="sm"
                  className={`border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === "COD"
                      ? "border-red-500 bg-red-50"
                      : "bg-gray-50"
                  }`}
                  onClick={() => setPaymentMethod("COD")}
                >
                  <Radio value="COD" label="Cash on Delivery" />
                  <div className="flex items-center gap-2 text-gray-600">
                    <Truck size={18} />
                    <Text className="text-sm">
                      Pay when you receive the order
                    </Text>
                  </div>
                </Card>
                <Card
                  padding="sm"
                  className={`border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === "ONLINE"
                      ? "border-red-500 bg-red-50"
                      : "bg-gray-50"
                  }`}
                  onClick={() => setPaymentMethod("ONLINE")}
                >
                  <Radio value="ONLINE" label="Online Payment" />
                  <div className="flex items-center gap-2 text-gray-600">
                    <CreditCard size={18} />
                    <Text className="text-sm">
                      Pay securely via card or UPI
                    </Text>
                  </div>
                </Card>
              </div>
            </Radio.Group>
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
                      }
                    );
                  }}
                  color="red"
                >
                  Apply
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT SIDE - Pricing Summary */}
        <Card
          shadow="lg"
          padding="lg"
          className="border rounded-lg bg-white/80 backdrop-blur-md "
        >
          <Text className="text-lg font-semibold mb-2">Order Summary</Text>
          <Divider className="mb-3" />

          {/* Subtotal */}
          <div className="flex justify-between text-gray-600">
            <Text>Subtotal:</Text>
            <Text>{formatPrice(cart.totalPrice)}</Text>
          </div>

          {/* Discount */}
          <div className="flex justify-between text-gray-600 mt-2">
            <Text>Discount:</Text>
            <Text>{formatPrice(discountAmt)}</Text>
          </div>

          {/* Final Price */}
          <div className="flex justify-between font-semibold text-lg mt-2">
            <Text>Total:</Text>
            <Text>{formatPrice(updatedTotal)}</Text>
          </div>

          {/* Proceed Button */}
          <Button
            disabled={createOrderM.isPending}
            onClick={handlSubmit}
            fullWidth
            color="red"
            className="mt-4"
          >
            Proceed to Order
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Checkout;
