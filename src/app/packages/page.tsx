import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { HomeDock } from "@/components/site/home-dock";
import { PackageBrowser } from "@/components/package/package-browser";
import { listPackages } from "@/lib/server/packages";

export default async function PackagesPage({searchParams}:{searchParams:Promise<{destination?:string;month?:string;theme?:string}>}){const [packages,query]=await Promise.all([listPackages(),searchParams]);return <div className="relative"><Navbar tone="light"/><PackageBrowser packages={packages} initialDestination={query.destination||""}/><Footer/><HomeDock/></div>;}
