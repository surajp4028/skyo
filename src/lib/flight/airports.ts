/**
 * Airport directory used for search suggestions, distances (fare model) and route maps.
 * Kept locally so typing an airport never costs an aviationstack request (free plan = 100/month).
 * lat/lon are the airport reference points (approx.), tz is the IANA zone.
 */
export type Airport = { iata: string; city: string; name: string; state: string; country: string; lat: number; lon: number; tz: string; metro?: boolean };

const IN = (iata: string, city: string, name: string, state: string, lat: number, lon: number, metro = false): Airport => ({ iata, city, name, state, country: "IN", lat, lon, tz: "Asia/Kolkata", metro });
const X = (iata: string, city: string, name: string, country: string, lat: number, lon: number, tz: string): Airport => ({ iata, city, name, state: "", country, lat, lon, tz });

export const AIRPORTS: Airport[] = [
  IN("DEL", "New Delhi", "Indira Gandhi International", "Delhi", 28.5562, 77.1, true),
  IN("BOM", "Mumbai", "Chhatrapati Shivaji Maharaj International", "Maharashtra", 19.0896, 72.8656, true),
  IN("BLR", "Bengaluru", "Kempegowda International", "Karnataka", 13.1986, 77.7066, true),
  IN("HYD", "Hyderabad", "Rajiv Gandhi International", "Telangana", 17.2403, 78.4294, true),
  IN("MAA", "Chennai", "Chennai International", "Tamil Nadu", 12.9941, 80.1709, true),
  IN("CCU", "Kolkata", "Netaji Subhas Chandra Bose International", "West Bengal", 22.6547, 88.4467, true),
  IN("AMD", "Ahmedabad", "Sardar Vallabhbhai Patel International", "Gujarat", 23.0772, 72.6347, true),
  IN("PNQ", "Pune", "Pune International", "Maharashtra", 18.5821, 73.9197, true),
  IN("COK", "Kochi", "Cochin International", "Kerala", 10.152, 76.4019, true),
  IN("GOI", "Goa", "Dabolim", "Goa", 15.3808, 73.8314, true),
  IN("GOX", "Goa", "Manohar International (Mopa)", "Goa", 15.7442, 73.8606),
  IN("JAI", "Jaipur", "Jaipur International", "Rajasthan", 26.8242, 75.8122, true),
  IN("LKO", "Lucknow", "Chaudhary Charan Singh International", "Uttar Pradesh", 26.7606, 80.8893, true),
  IN("GAU", "Guwahati", "Lokpriya Gopinath Bordoloi International", "Assam", 26.1061, 91.5859),
  IN("SXR", "Srinagar", "Sheikh ul-Alam International", "Jammu & Kashmir", 33.9871, 74.7742),
  IN("IXC", "Chandigarh", "Shaheed Bhagat Singh International", "Chandigarh", 30.6735, 76.7885),
  IN("ATQ", "Amritsar", "Sri Guru Ram Dass Jee International", "Punjab", 31.7096, 74.7973),
  IN("PAT", "Patna", "Jay Prakash Narayan International", "Bihar", 25.5913, 85.088),
  IN("BBI", "Bhubaneswar", "Biju Patnaik International", "Odisha", 20.2444, 85.8178),
  IN("TRV", "Thiruvananthapuram", "Thiruvananthapuram International", "Kerala", 8.4821, 76.92),
  IN("CCJ", "Kozhikode", "Calicut International", "Kerala", 11.1368, 75.9553),
  IN("CNN", "Kannur", "Kannur International", "Kerala", 11.9186, 75.5472),
  IN("IXE", "Mangaluru", "Mangaluru International", "Karnataka", 12.9613, 74.8901),
  IN("CJB", "Coimbatore", "Coimbatore International", "Tamil Nadu", 11.03, 77.0434),
  IN("IXM", "Madurai", "Madurai", "Tamil Nadu", 9.8345, 78.0934),
  IN("TRZ", "Tiruchirappalli", "Tiruchirappalli International", "Tamil Nadu", 10.7654, 78.7097),
  IN("VTZ", "Visakhapatnam", "Visakhapatnam", "Andhra Pradesh", 17.7212, 83.2245),
  IN("VGA", "Vijayawada", "Vijayawada", "Andhra Pradesh", 16.5304, 80.7968),
  IN("TIR", "Tirupati", "Tirupati", "Andhra Pradesh", 13.6325, 79.5433),
  IN("NAG", "Nagpur", "Dr. Babasaheb Ambedkar International", "Maharashtra", 21.0922, 79.0472),
  IN("IDR", "Indore", "Devi Ahilya Bai Holkar", "Madhya Pradesh", 22.7218, 75.8011),
  IN("BHO", "Bhopal", "Raja Bhoj", "Madhya Pradesh", 23.2875, 77.3374),
  IN("JLR", "Jabalpur", "Jabalpur", "Madhya Pradesh", 23.1778, 80.052),
  IN("RPR", "Raipur", "Swami Vivekananda", "Chhattisgarh", 21.1804, 81.7388),
  IN("IXR", "Ranchi", "Birsa Munda", "Jharkhand", 23.3143, 85.3217),
  IN("VNS", "Varanasi", "Lal Bahadur Shastri International", "Uttar Pradesh", 25.4524, 82.8593),
  IN("GOP", "Gorakhpur", "Gorakhpur", "Uttar Pradesh", 26.7397, 83.4497),
  IN("AYJ", "Ayodhya", "Maharishi Valmiki International", "Uttar Pradesh", 26.7531, 82.1531),
  IN("IXB", "Bagdogra", "Bagdogra International", "West Bengal", 26.6812, 88.3286),
  IN("IXA", "Agartala", "Maharaja Bir Bikram", "Tripura", 23.887, 91.2404),
  IN("IMF", "Imphal", "Bir Tikendrajit International", "Manipur", 24.76, 93.8967),
  IN("DIB", "Dibrugarh", "Dibrugarh", "Assam", 27.4839, 95.0169),
  IN("IXS", "Silchar", "Silchar", "Assam", 24.9129, 92.9787),
  IN("SHL", "Shillong", "Shillong", "Meghalaya", 25.7036, 91.9787),
  IN("IXZ", "Port Blair", "Veer Savarkar International", "Andaman & Nicobar", 11.6412, 92.7297),
  IN("IXL", "Leh", "Kushok Bakula Rimpochee", "Ladakh", 34.1359, 77.5465),
  IN("IXJ", "Jammu", "Jammu", "Jammu & Kashmir", 32.6891, 74.8374),
  IN("DED", "Dehradun", "Jolly Grant", "Uttarakhand", 30.1897, 78.1803),
  IN("KUU", "Kullu–Manali", "Bhuntar", "Himachal Pradesh", 31.8767, 77.1544),
  IN("DHM", "Dharamshala", "Kangra (Gaggal)", "Himachal Pradesh", 32.1651, 76.2634),
  IN("UDR", "Udaipur", "Maharana Pratap", "Rajasthan", 24.6177, 73.8961),
  IN("JDH", "Jodhpur", "Jodhpur", "Rajasthan", 26.2511, 73.0489),
  IN("STV", "Surat", "Surat International", "Gujarat", 21.1141, 72.7418),
  IN("BDQ", "Vadodara", "Vadodara", "Gujarat", 22.3362, 73.2263),
  IN("RAJ", "Rajkot", "Rajkot International (Hirasar)", "Gujarat", 22.3092, 70.7795),
  IN("BHJ", "Bhuj", "Bhuj", "Gujarat", 23.2878, 69.6702),
  IN("IXU", "Aurangabad", "Chhatrapati Sambhajinagar", "Maharashtra", 19.8627, 75.3981),
  IN("NDC", "Nanded", "Shri Guru Gobind Singh Ji", "Maharashtra", 19.1833, 77.3167),
  IN("KLH", "Kolhapur", "Kolhapur", "Maharashtra", 16.6647, 74.2894),
  IN("NMI", "Navi Mumbai", "Navi Mumbai International", "Maharashtra", 18.995, 73.07),
  IN("HBX", "Hubballi", "Hubballi", "Karnataka", 15.3617, 75.0849),
  IN("IXG", "Belagavi", "Belagavi", "Karnataka", 15.8593, 74.6183),
  IN("MYQ", "Mysuru", "Mysuru", "Karnataka", 12.2299, 76.6559),
  IN("IXD", "Prayagraj", "Prayagraj", "Uttar Pradesh", 25.4401, 81.7339),
  IN("KNU", "Kanpur", "Kanpur", "Uttar Pradesh", 26.4044, 80.4101),
  IN("AGR", "Agra", "Agra", "Uttar Pradesh", 27.1558, 77.9609),
  IN("GWL", "Gwalior", "Rajmata Vijaya Raje Scindia", "Madhya Pradesh", 26.2933, 78.2278),
  IN("DBR", "Darbhanga", "Darbhanga", "Bihar", 26.1947, 85.9175),
  IN("GAY", "Gaya", "Gaya", "Bihar", 24.7443, 84.9512),
  IN("DGH", "Deoghar", "Deoghar", "Jharkhand", 24.4442, 86.7067),
  IN("IXI", "Lilabari", "North Lakhimpur", "Assam", 27.2955, 94.0976),
  // international hubs commonly flown from India
  X("DXB", "Dubai", "Dubai International", "AE", 25.2532, 55.3657, "Asia/Dubai"),
  X("AUH", "Abu Dhabi", "Zayed International", "AE", 24.433, 54.6511, "Asia/Dubai"),
  X("SHJ", "Sharjah", "Sharjah International", "AE", 25.3286, 55.5172, "Asia/Dubai"),
  X("DOH", "Doha", "Hamad International", "QA", 25.2731, 51.6081, "Asia/Qatar"),
  X("MCT", "Muscat", "Muscat International", "OM", 23.5933, 58.2844, "Asia/Muscat"),
  X("BAH", "Bahrain", "Bahrain International", "BH", 26.2708, 50.6336, "Asia/Bahrain"),
  X("KWI", "Kuwait City", "Kuwait International", "KW", 29.2266, 47.9689, "Asia/Kuwait"),
  X("RUH", "Riyadh", "King Khalid International", "SA", 24.9576, 46.6988, "Asia/Riyadh"),
  X("JED", "Jeddah", "King Abdulaziz International", "SA", 21.6796, 39.1565, "Asia/Riyadh"),
  X("SIN", "Singapore", "Changi", "SG", 1.3644, 103.9915, "Asia/Singapore"),
  X("BKK", "Bangkok", "Suvarnabhumi", "TH", 13.69, 100.7501, "Asia/Bangkok"),
  X("KUL", "Kuala Lumpur", "Kuala Lumpur International", "MY", 2.7456, 101.7099, "Asia/Kuala_Lumpur"),
  X("CMB", "Colombo", "Bandaranaike International", "LK", 7.1808, 79.8841, "Asia/Colombo"),
  X("KTM", "Kathmandu", "Tribhuvan International", "NP", 27.6966, 85.3591, "Asia/Kathmandu"),
  X("DAC", "Dhaka", "Hazrat Shahjalal International", "BD", 23.8433, 90.3978, "Asia/Dhaka"),
  X("MLE", "Malé", "Velana International", "MV", 4.1918, 73.5291, "Indian/Maldives"),
  X("HKG", "Hong Kong", "Hong Kong International", "HK", 22.308, 113.9185, "Asia/Hong_Kong"),
  X("LHR", "London", "Heathrow", "GB", 51.47, -0.4543, "Europe/London"),
  X("FRA", "Frankfurt", "Frankfurt am Main", "DE", 50.0379, 8.5622, "Europe/Berlin"),
  X("CDG", "Paris", "Charles de Gaulle", "FR", 49.0097, 2.5479, "Europe/Paris"),
  X("AMS", "Amsterdam", "Schiphol", "NL", 52.3105, 4.7683, "Europe/Amsterdam"),
  X("IST", "Istanbul", "Istanbul Airport", "TR", 41.2753, 28.7519, "Europe/Istanbul"),
  X("JFK", "New York", "John F. Kennedy International", "US", 40.6413, -73.7781, "America/New_York"),
  X("EWR", "Newark", "Newark Liberty International", "US", 40.6895, -74.1745, "America/New_York"),
  X("SFO", "San Francisco", "San Francisco International", "US", 37.6213, -122.379, "America/Los_Angeles"),
  X("YYZ", "Toronto", "Pearson International", "CA", 43.6777, -79.6248, "America/Toronto"),
  X("SYD", "Sydney", "Kingsford Smith", "AU", -33.9399, 151.1753, "Australia/Sydney"),
  X("MEL", "Melbourne", "Tullamarine", "AU", -37.669, 144.841, "Australia/Melbourne"),
].filter((a, i, all) => all.findIndex((b) => b.iata === a.iata) === i);

const BY = new Map(AIRPORTS.map((a) => [a.iata, a]));
export const airportByCode = (iata?: string | null) => (iata ? BY.get(iata.toUpperCase()) ?? null : null);
export const isKnownAirport = (iata: string) => BY.has(iata.toUpperCase());
export const airportLabel = (a: Pick<Airport, "city" | "iata">) => `${a.city} (${a.iata})`;
export const isDomestic = (a?: Airport | null, b?: Airport | null) => !!a && !!b && a.country === "IN" && b.country === "IN";

/** "Delhi (DEL)" / "DEL" / "delhi" → DEL. */
export function parseAirportInput(v: string): string | null {
  // "City (XYZ)" picked from suggestions — any IATA code (the server checks it against the world list)
  const m = v.match(/\(([A-Z]{3})\)\s*$/i);
  if (m) return m[1].toUpperCase();
  const t = v.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(t) && isKnownAirport(t)) return t;
  const hit = searchAirports(v, 1)[0];
  return hit && (hit.city.toLowerCase() === v.trim().toLowerCase() || hit.iata === t) ? hit.iata : null;
}

/** Ranked local search by code, city, airport name or state. */
export function searchAirports(q: string, limit = 8): Airport[] {
  const s = q.replace(/\s*\([A-Z]{3}\)\s*$/i, "").trim().toLowerCase();
  if (!s) return AIRPORTS.filter((a) => a.metro).slice(0, limit);
  const score = (a: Airport) => {
    if (a.iata.toLowerCase() === s) return 0;
    if (a.city.toLowerCase().startsWith(s)) return 1 + (a.metro ? 0 : 0.5);
    if (a.name.toLowerCase().startsWith(s)) return 2;
    if (a.city.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)) return 3;
    if (a.state.toLowerCase().startsWith(s)) return 4;
    return 99;
  };
  return AIRPORTS.map((a) => [a, score(a)] as const)
    .filter(([, sc]) => sc < 99)
    .sort((x, y) => x[1] - y[1] || (x[0].country === "IN" ? -1 : 1))
    .slice(0, limit)
    .map(([a]) => a);
}

/** Great-circle distance in km. */
export function distanceKm(a: Pick<Airport, "lat" | "lon">, b: Pick<Airport, "lat" | "lon">) {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Hubs tried for one-stop connections (in order of usefulness). */
export const HUBS = ["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "AMD", "COK"];
