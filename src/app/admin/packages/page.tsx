import { guardPage } from "@/lib/server/admin/guard";
import { Forbidden } from "@/components/admin/ui";
import { PackageManager } from "@/components/admin/package-manager";

export default async function AdminPackagesPage(){const {allowed}=await guardPage("bookings.package");return allowed?<PackageManager/>:<Forbidden/>;}
