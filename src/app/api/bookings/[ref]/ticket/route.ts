import type { NextRequest } from "next/server";
import { ApiError, route } from "@/lib/server/http";
import { getSessionAdmin, getSessionUser } from "@/lib/server/session";
import { queryOne } from "@/lib/server/db";
import { can, SERVICES } from "@/lib/permissions";
import { providerTicketFile, ticketFile } from "@/lib/server/booking/post-issue";

type Ctx = { params: Promise<{ ref: string }> };

/** E-ticket PDF (stored in S3 under the customer's SKYO ID) — owner, or an agent with train-bookings access. */
export const GET = route<Ctx>(async (req: NextRequest, { params }) => {
  const ref = (await params).ref;
  if (!/^SKT\d{8}$/.test(ref)) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  const b = await queryOne<{ user_uid: string; ticket_status: string; service: string }>("SELECT user_uid, ticket_status, service FROM bookings WHERE booking_ref = ?", [ref]);
  const user = await getSessionUser();
  const admin = await getSessionAdmin();
  const allowed = !!b && ((user && user.uid === b.user_uid) || (admin && can(admin, SERVICES.find((s) => s.key === b.service)?.perm ?? "bookings.train")));
  if (!allowed) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  if (b!.ticket_status !== "issued") throw new ApiError(409, "NO_TICKET", "The ticket hasn't been issued yet.");
  const irctc = req.nextUrl.searchParams.get("kind") === "irctc";
  const pdf = irctc ? await providerTicketFile(ref) : await ticketFile(ref);
  if (!pdf && irctc) throw new ApiError(404, "NO_PROVIDER_TICKET", "The IRCTC ticket isn't available yet.");
  if (!pdf) throw new ApiError(409, "NO_TICKET", "The ticket hasn't been issued yet.");
  const inline = req.nextUrl.searchParams.get("view") === "1";
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="SKYO-${irctc ? "IRCTC-Ticket" : b!.service === "flight" ? "Flight-eTicket" : "eTicket"}-${ref}.pdf"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
});
