import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { packageBookingForUser, packagePaymentOrder, markPackagePaymentPaid } from "@/lib/server/package-bookings";
import { verifyCheckoutSignature, fetchPayment, capturePayment } from "@/lib/server/payments/razorpay";
import { logProvider } from "@/lib/server/payments/log";

export const POST=route(async(req:NextRequest)=>{
  const user=await requireUser();
  const body=await readJson(req,z.object({bookingRef:z.string().regex(/^SKYP[A-F0-9]{12}$/),razorpay_payment_id:z.string().regex(/^pay_[A-Za-z0-9]+$/),razorpay_order_id:z.string().regex(/^order_[A-Za-z0-9]+$/),razorpay_signature:z.string().regex(/^[a-f0-9]{64}$/)}));
  const booking=await packageBookingForUser(body.bookingRef,user.uid);
  if(!booking) throw new ApiError(404,"BOOKING_NOT_FOUND","Package booking not found.");
  const order=await packagePaymentOrder(body.razorpay_order_id);
  const valid=!!order && order.booking_ref===booking.booking_ref && verifyCheckoutSignature(body.razorpay_order_id,body.razorpay_payment_id,body.razorpay_signature);
  await logProvider({bookingRef:booking.booking_ref,provider:"razorpay",direction:"inbound",action:"package.checkout.verify",outcome:valid?"ok":"error",externalId:body.razorpay_payment_id,request:{orderId:body.razorpay_order_id,paymentId:body.razorpay_payment_id},response:{signature_valid:valid}});
  if(!valid) throw new ApiError(400,"BAD_SIGNATURE","Payment could not be verified. If money was debited, contact support with your booking reference.");
  let payment=await fetchPayment(body.razorpay_payment_id,booking.booking_ref);
  if(payment.order_id!==body.razorpay_order_id) throw new ApiError(400,"ORDER_MISMATCH","Payment does not match this booking.");
  if(payment.status==="authorized") payment=await capturePayment(payment.id,Number(order!.amount_paise),booking.booking_ref);
  if(payment.status!=="captured" || payment.currency!=="INR") throw new ApiError(409,"PAYMENT_NOT_CAPTURED","Payment is not captured yet. Please refresh your booking status shortly.");
  const result=await markPackagePaymentPaid(body.razorpay_order_id,payment.id,payment.amount);
  if(!result.ok) throw new ApiError(409,"AMOUNT_MISMATCH","Paid amount does not match the package order. Please contact support.");
  return ok({result:{...result,voucherUrl:`/api/package-bookings/${booking.booking_ref}/voucher`,invoiceUrl:`/api/package-bookings/${booking.booking_ref}/invoice`}});
});
