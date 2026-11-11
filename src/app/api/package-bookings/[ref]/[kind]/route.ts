import type { NextRequest } from "next/server";
import { ApiError, route } from "@/lib/server/http";
import { getSessionAdmin, getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/permissions";
import { packageBookingByRef } from "@/lib/server/package-bookings";
import { getPackageBySlug } from "@/lib/server/packages";
import { packagePdf } from "@/lib/server/package-pdf";

type Ctx={params:Promise<{ref:string;kind:string}>};
export const GET=route<Ctx>(async(_req:NextRequest,{params})=>{
 const {ref,kind}=await params;if(!/^SKYP[A-F0-9]{12}$/.test(ref)||!(kind==="invoice"||kind==="voucher"))throw new ApiError(404,"NOT_FOUND","Document not found.");
 const [booking,user,admin]=await Promise.all([packageBookingByRef(ref),getSessionUser(),getSessionAdmin()]);
 if(!booking||!((user&&user.uid===booking.user_uid)||(admin&&can(admin,"bookings.package"))))throw new ApiError(404,"NOT_FOUND","Document not found.");
 if(Number(booking.amount_paid_paise)<=0)throw new ApiError(409,"NOT_PAID","A booking document is available after payment.");
 const pkg=await getPackageBySlug(booking.package_slug,true);if(!pkg)throw new ApiError(404,"NOT_FOUND","Package details are no longer available.");
 const pdf=await packagePdf(kind,{ref:booking.booking_ref,customer:booking.customer,travelDate:typeof booking.travel_date==="string"?booking.travel_date:booking.travel_date.toISOString().slice(0,10),guests:Number(booking.total_guests),totalPaise:Number(booking.total_amount_paise),discountPaise:Number(booking.discount_paise),paidPaise:Number(booking.amount_paid_paise),paymentStatus:booking.payment_status,bookingStatus:booking.booking_status,couponCode:booking.coupon_code},pkg);
 return new Response(Buffer.from(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="SKYO-${kind}-${ref}.pdf"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
});
