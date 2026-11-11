import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { HomeDock } from "@/components/site/home-dock";
import { PackageDetail } from "@/components/package/package-detail";
import { getPackageBySlug } from "@/lib/server/packages";
import { packageGeo } from "@/lib/server/package-geo";
import { departureSeatsLeft } from "@/lib/server/package-bookings";

type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const p=await getPackageBySlug((await params).slug);return p?{title:p.title,description:p.shortDescription,openGraph:{title:p.title,description:p.shortDescription,images:[p.coverPhoto]}}:{title:"Tour package"};}
export default async function PackagePage({params}:Props){const pkg=await getPackageBySlug((await params).slug);if(!pkg)notFound();return <div className="relative"><Navbar tone="light"/><PackageDetail pkg={pkg} geo={packageGeo(pkg.destinations)} availability={await departureSeatsLeft(pkg)}/><Footer/><HomeDock/></div>;}
