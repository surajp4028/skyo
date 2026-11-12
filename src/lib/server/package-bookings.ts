import "server-only";
import { randomBytes } from "node:crypto";
import { transaction, exec, query, queryOne } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { PackageDeparture, TourPackage } from "@/lib/packages";
import { ApiError } from "./http";

type BookingRow = { id:number; booking_ref:string; core_booking_ref:string; package_id:number; package_title:string; package_slug:string; user_uid:string; user_details_enc:string; travel_date:Date|string; total_guests:number; pricing_type:string; package_price_paise:number|string; discount_paise:number|string; coupon_code:string|null; total_amount_paise:number|string; upfront_amount_paise:number|string; amount_paid_paise:number|string; payment_status:string; booking_status:string; created_at:Date };
export type PackageCustomer = { name:string; email:string; phone:string };
export type PackageTraveller = { name:string; age:number|null; gender:"M"|"F"|"T"|null; email:string|null; phone:string|null };
/** Guests holding seats: confirmed bookings + checkouts started in the last 30 minutes. */
const SEATS_SQL = "SELECT COALESCE(SUM(total_guests),0) n FROM tour_package_bookings WHERE package_id=? AND (booking_status='confirmed' OR (booking_status='pending' AND payment_status<>'failed' AND created_at > NOW() - INTERVAL 30 MINUTE))";

/** Seats left on each departure of a package. */
export async function departureSeatsLeft(pkg: Pick<TourPackage,"id"|"departures">): Promise<Record<string, number>> {
  if (!pkg.departures?.length) return {};
  const rows = await query<{ departure_id:string; n:number|string }>(SEATS_SQL.replace("COALESCE(SUM(total_guests),0) n","departure_id, COALESCE(SUM(total_guests),0) n") + " AND departure_id IS NOT NULL GROUP BY departure_id",[pkg.id]);
  const taken = Object.fromEntries(rows.map((r) => [r.departure_id, Number(r.n)]));
  return Object.fromEntries(pkg.departures.map((d) => [d.id, Math.max(0, d.seats - (taken[d.id] || 0))]));
}

export function newPackageBookingRef() { return `SKYP${randomBytes(6).toString("hex").toUpperCase()}`; }
export async function createPackageBooking(p: { pkg:TourPackage; uid:string; ref:string; customer:PackageCustomer; travellers?:PackageTraveller[]; travelDate:string; departure?:PackageDeparture|null; guests:number; quote:{subtotal:number;discount:number;total:number;upfront:number;couponCode:string|null}; paymentType:"upfront"|"full" }) {
  const totalPaise = p.quote.total * 100;
  const depositPaise = p.quote.upfront * 100;
  const amountPaise = p.paymentType === "full" ? totalPaise : depositPaise;
  const nameEnc = await encrypt(JSON.stringify({ ...p.customer, travellers:p.travellers ?? [], package:{slug:p.pkg.slug,title:p.pkg.title,route:p.pkg.destinations}, guests:p.guests, travelDate:p.travelDate, pricingType:p.pkg.pricingType, packagePrice:p.quote.subtotal, discount:p.quote.discount, total:p.quote.total, upfront:p.quote.upfront }));
  const titleEnc = await encrypt(p.pkg.title);
  const originEnc = await encrypt(p.pkg.destinations[0] || "");
  const destinationEnc = await encrypt(p.pkg.destinations[p.pkg.destinations.length - 1] || "");
  const detailsEnc = await encrypt(JSON.stringify({kind:"tour_package",packageId:p.pkg.id,slug:p.pkg.slug,title:p.pkg.title,customer:p.customer,travellers:p.travellers ?? [],guests:p.guests,travelDate:p.travelDate,pricingType:p.pkg.pricingType,packagePrice:p.quote.subtotal,discount:p.quote.discount,total:p.quote.total,upfront:p.quote.upfront,remaining:p.quote.total-p.quote.upfront,couponCode:p.quote.couponCode,route:p.pkg.destinations,
    // what the traveller agreed to — kept with the booking even if the admin edits the package later
    departure:p.departure?{id:p.departure.id,startDate:p.departure.startDate,startTime:p.departure.startTime,endDate:p.departure.endDate,endTime:p.departure.endTime}:null,
    tripInfo:p.pkg.tripInfo,cancellationRules:p.pkg.cancellationRules,cancellationPolicy:p.pkg.cancellationPolicy}));
  await transaction(async (conn) => {
    if (p.departure) {
      // lock the package row so two people can't take the last seats at the same time
      await conn.execute("SELECT id FROM tour_packages WHERE id=? FOR UPDATE",[p.pkg.id]);
      const [rows] = await conn.execute(SEATS_SQL + " AND departure_id=?",[p.pkg.id,p.departure.id]);
      const taken = Number((rows as Array<{n:number|string|null}>)[0]?.n || 0);
      if (taken + p.guests > p.departure.seats) throw new ApiError(409,"SEATS_FULL",p.departure.seats - taken > 0 ? `Only ${p.departure.seats - taken} seat${p.departure.seats - taken === 1 ? "" : "s"} left on this departure.` : "This departure is full. Please pick another date.");
    }
    await conn.execute("INSERT INTO bookings (booking_ref,user_uid,service,status,payment_status,title_enc,origin_enc,destination_enc,details_enc,travel_date,travellers,amount_paise,currency,pay_provider,ticket_status) VALUES (?,?, 'package','pending','unpaid',?,?,?,?,?,?,?,'INR','razorpay','not_issued')",[p.ref,p.uid,titleEnc,originEnc,destinationEnc,detailsEnc,p.travelDate,p.guests,amountPaise]);
    await conn.execute("INSERT INTO tour_package_bookings (booking_ref,core_booking_ref,package_id,package_title,package_slug,user_uid,user_details_enc,travel_date,departure_id,return_date,total_guests,pricing_type,package_price_paise,discount_paise,coupon_code,total_amount_paise,upfront_amount_paise) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[p.ref,p.ref,p.pkg.id,p.pkg.title,p.pkg.slug,p.uid,nameEnc,p.travelDate,p.departure?.id ?? null,p.departure?.endDate ?? null,p.guests,p.pkg.pricingType,p.quote.subtotal*100,p.quote.discount*100,p.quote.couponCode,totalPaise,depositPaise]);
  });
  return { amountPaise, totalPaise };
}
export async function packageBookingForUser(ref:string, uid:string) {
  const row = await queryOne<BookingRow>("SELECT * FROM tour_package_bookings WHERE booking_ref=? AND user_uid=?",[ref,uid]);
  if (!row) return null;
  return { ...row, customer: JSON.parse(await decrypt(row.user_details_enc)) as PackageCustomer, paidPaise:Number(row.amount_paid_paise), totalPaise:Number(row.total_amount_paise), upfrontPaise:Number(row.upfront_amount_paise) };
}
export async function packageBookingByRef(ref:string) {
  const row=await queryOne<BookingRow>("SELECT * FROM tour_package_bookings WHERE booking_ref=?",[ref]);
  return row?{...row,customer:JSON.parse(await decrypt(row.user_details_enc)) as PackageCustomer}:null;
}
export async function listUserPackageBookings(uid:string) {
  const rows = await query<BookingRow>("SELECT * FROM tour_package_bookings WHERE user_uid=? ORDER BY id DESC LIMIT 100",[uid]);
  return Promise.all(rows.map(async (r)=>({ ref:r.booking_ref, service:"package", status:r.booking_status, paymentStatus:r.payment_status, ticketStatus:"not_issued", amount:Number(r.total_amount_paise)/100, paid:Number(r.amount_paid_paise)/100, remaining:Math.max(0,Number(r.total_amount_paise)-Number(r.amount_paid_paise))/100, createdAt:r.created_at, date:typeof r.travel_date === "string" ? r.travel_date : r.travel_date.toISOString().slice(0,10), guests:Number(r.total_guests), title:r.package_title, destinations:JSON.parse(await decrypt(r.user_details_enc)).package?.route || [], invoiceUrl:`/api/package-bookings/${r.booking_ref}/invoice`, voucherUrl:`/api/package-bookings/${r.booking_ref}/voucher` })));
}
export async function listAdminPackageBookings() {
  const rows = await query<BookingRow>("SELECT * FROM tour_package_bookings ORDER BY id DESC LIMIT 500");
  return Promise.all(rows.map(async (r)=>({ ref:r.booking_ref, title:r.package_title, slug:r.package_slug, userUid:r.user_uid, customer:JSON.parse(await decrypt(r.user_details_enc)) as PackageCustomer, travelDate:typeof r.travel_date === "string" ? r.travel_date : r.travel_date.toISOString().slice(0,10), guests:Number(r.total_guests), pricingType:r.pricing_type, subtotalPaise:Number(r.package_price_paise), discountPaise:Number(r.discount_paise), couponCode:r.coupon_code, totalPaise:Number(r.total_amount_paise), upfrontPaise:Number(r.upfront_amount_paise), paidPaise:Number(r.amount_paid_paise), remainingPaise:Math.max(0,Number(r.total_amount_paise)-Number(r.amount_paid_paise)), paymentStatus:r.payment_status, bookingStatus:r.booking_status, createdAt:r.created_at, invoiceUrl:`/api/admin/package-bookings/${r.booking_ref}/invoice` })));
}
export async function packagePaymentOrder(orderId:string) {
  return queryOne<{id:number;booking_ref:string;amount_paise:number|string;payment_type:string;status:string}>("SELECT id,booking_ref,amount_paise,payment_type,status FROM tour_package_payments WHERE razorpay_order_id=?",[orderId]);
}
export async function markPackagePaymentPaid(orderId:string,paymentId:string,amountPaise:number) {
  const row = await packagePaymentOrder(orderId);
  if (!row || Number(row.amount_paise)!==amountPaise) return { ok:false as const };
  return transaction(async(conn)=>{
    const [res] = await conn.execute("UPDATE tour_package_payments SET status='paid',razorpay_payment_id=?,paid_at=UTC_TIMESTAMP() WHERE id=? AND status<>'paid'",[paymentId,row.id]);
    const changed=(res as {affectedRows:number}).affectedRows;
    if (changed) {
      await conn.execute("UPDATE tour_package_bookings SET amount_paid_paise=(SELECT COALESCE(SUM(amount_paise),0) FROM tour_package_payments WHERE booking_ref=? AND status='paid'), payment_status=IF((SELECT COALESCE(SUM(amount_paise),0) FROM tour_package_payments WHERE booking_ref=? AND status='paid') >= total_amount_paise,'paid','partially_paid'), booking_status='confirmed' WHERE booking_ref=?",[row.booking_ref,row.booking_ref,row.booking_ref]);
      await conn.execute("UPDATE bookings SET status='confirmed',payment_status='paid',pay_payment_id=?,paid_at=UTC_TIMESTAMP(),amount_paise=(SELECT COALESCE(SUM(amount_paise),0) FROM tour_package_payments WHERE booking_ref=? AND status='paid') WHERE booking_ref=?",[paymentId,row.booking_ref,row.booking_ref]);
    }
    const [state] = await conn.execute("SELECT amount_paid_paise,total_amount_paise,payment_status FROM tour_package_bookings WHERE booking_ref=?",[row.booking_ref]);
    const b=(state as Array<{amount_paid_paise:number|string;total_amount_paise:number|string;payment_status:string}>)[0];
    return { ok:true as const, bookingRef:row.booking_ref, paidPaise:Number(b.amount_paid_paise), totalPaise:Number(b.total_amount_paise), remainingPaise:Math.max(0,Number(b.total_amount_paise)-Number(b.amount_paid_paise)), paymentStatus:b.payment_status };
  });
}
export async function storePackageOrder(ref:string, orderId:string, amountPaise:number, paymentType:"upfront"|"balance"|"full") {
  await exec("INSERT INTO tour_package_payments (booking_ref,razorpay_order_id,amount_paise,payment_type) VALUES (?,?,?,?)",[ref,orderId,amountPaise,paymentType]);
  await exec("UPDATE bookings SET pay_order_id=?,amount_paise=? WHERE booking_ref=?",[orderId,amountPaise,ref]);
}
