import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { getSetting } from "@/lib/server/settings";
import { rateLimit } from "@/lib/server/ratelimit";
import { getPackageBySlug } from "@/lib/server/packages";
import { packageCheckoutInput } from "@/lib/server/package-validation";
import { packageQuote, todayIST, upcomingDepartures, withDeparturePrice, type PackageDeparture } from "@/lib/packages";
import { createPackageBooking, departureSeatsLeft, newPackageBookingRef, packageBookingForUser, storePackageOrder } from "@/lib/server/package-bookings";
import { createOrder, razorpayKeyId } from "@/lib/server/payments/razorpay";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import { exec } from "@/lib/server/db";

const input = z.union([
  packageCheckoutInput,
  z.object({ bookingRef:z.string().regex(/^SKYP[A-F0-9]{12}$/), paymentType:z.literal("balance") }),
]);
export const POST = route(async (req:NextRequest) => {
  if (await getSetting("service_package") === "off") throw new ApiError(404,"SERVICE_OFF","Package bookings are currently unavailable.");
  const user=await requireUser();
  const rl=await rateLimit(`package:order:${user.id}`,5,600);
  if(!rl.ok) throw new ApiError(429,"RATE_LIMITED","Too many booking attempts. Please wait a few minutes.",{retryAfter:rl.retryAfter});
  const body=await readJson(req,input);
  let ref:string, amountPaise:number, paymentType:"upfront"|"balance"|"full", quote:unknown, customer:{name:string;email:string;phone:string};
  if("bookingRef" in body){
    const b=await packageBookingForUser(body.bookingRef,user.uid);
    if(!b || b.booking_status!=="confirmed") throw new ApiError(404,"BOOKING_NOT_FOUND","Package booking not found.");
    const remaining=Math.max(0,Number(b.total_amount_paise)-Number(b.amount_paid_paise));
    if(!remaining) throw new ApiError(409,"BALANCE_SETTLED","This package is already fully paid.");
    ref=b.booking_ref; amountPaise=remaining; paymentType="balance"; customer=b.customer;
  } else {
    const item=await getPackageBySlug(body.slug);
    if(!item) throw new ApiError(404,"PACKAGE_NOT_FOUND","This package is no longer available.");
    // fixed departures (admin-set) when the package has them; otherwise the traveller's own date
    let departure:PackageDeparture|null=null; let travelDate=body.travelDate||"";
    if(item.departures.length){
      departure=upcomingDepartures(item).find((d)=>d.id===body.departureId)||null;
      if(!departure) throw new ApiError(422,"DEPARTURE","Pick one of the available departure dates.",{field:"departureId"});
      const left=(await departureSeatsLeft(item))[departure.id]??0;
      if(left<body.guests) throw new ApiError(409,"SEATS_FULL",left?`Only ${left} seat${left===1?"":"s"} left on this departure.`:"This departure is full. Please pick another date.");
      travelDate=departure.startDate;
    } else if(!/^\d{4}-\d{2}-\d{2}$/.test(travelDate) || travelDate<=todayIST()) throw new ApiError(422,"TRAVEL_DATE","Choose a future travel date.",{field:"travelDate"});
    const q=packageQuote(withDeparturePrice(item,departure),body.guests,body.couponCode);
    if(!q.valid) throw new ApiError(422,"INVALID_COUPON",q.error);
    ref=newPackageBookingRef(); const lead=body.travellers[0]; customer={name:lead.name,email:lead.email||"",phone:lead.phone||""}; paymentType=body.paymentType;
    const created=await createPackageBooking({pkg:item,uid:user.uid,ref,customer,travellers:body.travellers.map((t)=>({name:t.name,age:t.age??null,gender:t.gender??null,email:t.email||null,phone:t.phone||null})),travelDate,departure,guests:body.guests,quote:q,paymentType});
    amountPaise=created.amountPaise; quote=q;
  }
  const order=await createOrder({amountPaise,receipt:ref,bookingRef:ref,notes:{booking_ref:ref,service:"package",payment_type:paymentType}}).catch(async(e)=>{
    await exec("UPDATE bookings SET status='failed',payment_status='failed' WHERE booking_ref=?",[ref]);
    await exec("UPDATE tour_package_bookings SET booking_status='pending',payment_status='failed' WHERE booking_ref=?",[ref]);
    throw e;
  });
  await storePackageOrder(ref,order.id,amountPaise,paymentType);
  await audit({actorType:"user",actorId:user.id,action:"package.payment.initiated",targetType:"tour_package_booking",targetId:ref,ip:getClientIp(req.headers),meta:{amountPaise,paymentType}});
  return ok({bookingRef:ref,quote,checkout:{key:razorpayKeyId(),amount:order.amount,currency:order.currency,order_id:order.id,name:"SKYO",description:"Tour package booking",prefill:customer,notes:{booking_ref:ref,service:"package",payment_type:paymentType},theme:{color:"#ff5a1f"}}});
});
