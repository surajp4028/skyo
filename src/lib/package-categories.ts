import type { TourPackage } from "./packages";

/**
 * Package categories shown on /packages. The admin can tag each package (tour_packages.categories);
 * a package with no tags is placed automatically from its title, places, length and price.
 * "trending" always follows the package's Featured switch.
 */
export type PackageCategoryKey = "trending" | "pilgrimage" | "mountains" | "beaches" | "heritage" | "adventure" | "honeymoon" | "family" | "wildlife" | "weekend" | "budget";
export type PackageCategoryDef = { key: PackageCategoryKey; label: string; sub: string; auto: (p: TourPackage) => boolean };

const text = (p: TourPackage) => `${p.title} ${p.destinations.join(" ")} ${p.shortDescription}`.toLowerCase();
const has = (words: string[]) => (p: TourPackage) => words.some((w) => text(p).includes(w));

export const PACKAGE_CATEGORIES: PackageCategoryDef[] = [
  { key: "trending", label: "Trending", sub: "Most booked right now", auto: (p) => p.featured },
  { key: "pilgrimage", label: "Pilgrimage", sub: "Temples, dhams and darshan", auto: has(["kedarnath", "badrinath", "tungnath", "dham", "temple", "jyotirlinga", "vaishno", "tirupati", "darshan", "haridwar", "rishikesh", "varanasi", "ayodhya", "mahadev", "shiv"]) },
  { key: "mountains", label: "Mountain", sub: "Peaks, meadows and trails", auto: has(["trek", "himalaya", "chopta", "tungnath", "chandrashila", "kedarnath", "manali", "shimla", "ladakh", "spiti", "hill", "mountain", "kashmir", "darjeeling", "munnar"]) },
  { key: "beaches", label: "Beach", sub: "Sea, sand and sunsets", auto: has(["beach", "goa", "andaman", "island", "lakshadweep", "gokarna", "pondicherry", "coast", "backwater"]) },
  { key: "heritage", label: "Heritage", sub: "Forts, palaces and old cities", auto: has(["fort", "palace", "heritage", "rajasthan", "jaipur", "udaipur", "jaisalmer", "hampi", "agra", "kutch"]) },
  { key: "adventure", label: "Adventure", sub: "Treks, rafting and camps", auto: has(["rafting", "paragliding", "camp", "bungee", "scuba", "trek"]) },
  { key: "honeymoon", label: "Honeymoon", sub: "Made for two", auto: has(["honeymoon", "couple", "romantic"]) },
  { key: "family", label: "Family", sub: "Easy pace, all ages", auto: has(["family", "kids"]) },
  { key: "wildlife", label: "Wildlife", sub: "Safaris and national parks", auto: has(["safari", "wildlife", "national park", "tiger", "jim corbett", "ranthambore", "kaziranga"]) },
  { key: "weekend", label: "Weekend", sub: "3 days or less", auto: (p) => p.durationDays <= 3 },
  { key: "budget", label: "Budget", sub: "Under ₹15,000", auto: (p) => p.discountedPrice < 15000 },
];
export const PACKAGE_CATEGORY_KEYS = PACKAGE_CATEGORIES.map((c) => c.key) as [PackageCategoryKey, ...PackageCategoryKey[]];

/** Does this package belong in this category? Admin tags win; untagged packages are guessed. */
export function inCategory(p: TourPackage, c: PackageCategoryDef) {
  if (c.key === "trending") return p.featured;
  const tags = p.categories || [];
  return tags.length ? tags.includes(c.key) : c.auto(p);
}
