/**
 * Major Indian Railways stations (public station codes) for instant, zero-credit autocomplete.
 * Anything not listed here falls back to RailCore /stations/search (1 credit) — see /api/train/stations/search.
 */
export type LocalStation = { code: string; name: string; city: string; aliases?: string[] };

export const MAJOR_STATIONS: LocalStation[] = [
  { code: "NDLS", name: "New Delhi", city: "Delhi" },
  { code: "DLI", name: "Delhi Jn", city: "Delhi", aliases: ["old delhi"] },
  { code: "NZM", name: "Hazrat Nizamuddin", city: "Delhi" },
  { code: "ANVT", name: "Anand Vihar Terminal", city: "Delhi" },
  { code: "DEE", name: "Delhi Sarai Rohilla", city: "Delhi" },
  { code: "MMCT", name: "Mumbai Central", city: "Mumbai", aliases: ["bombay"] },
  { code: "CSMT", name: "Chhatrapati Shivaji Maharaj Terminus", city: "Mumbai", aliases: ["vt", "cst", "bombay"] },
  { code: "LTT", name: "Lokmanya Tilak Terminus", city: "Mumbai", aliases: ["kurla"] },
  { code: "BDTS", name: "Bandra Terminus", city: "Mumbai" },
  { code: "DR", name: "Dadar", city: "Mumbai" },
  { code: "BVI", name: "Borivali", city: "Mumbai" },
  { code: "TNA", name: "Thane", city: "Thane" },
  { code: "KYN", name: "Kalyan Jn", city: "Kalyan" },
  { code: "PNVL", name: "Panvel", city: "Navi Mumbai" },
  { code: "HWH", name: "Howrah Jn", city: "Kolkata", aliases: ["calcutta"] },
  { code: "SDAH", name: "Sealdah", city: "Kolkata" },
  { code: "KOAA", name: "Kolkata", city: "Kolkata", aliases: ["chitpur"] },
  { code: "SHM", name: "Shalimar", city: "Kolkata" },
  { code: "MAS", name: "Chennai Central", city: "Chennai", aliases: ["madras"] },
  { code: "MS", name: "Chennai Egmore", city: "Chennai" },
  { code: "TBM", name: "Tambaram", city: "Chennai" },
  { code: "SBC", name: "KSR Bengaluru", city: "Bengaluru", aliases: ["bangalore", "majestic"] },
  { code: "YPR", name: "Yesvantpur Jn", city: "Bengaluru", aliases: ["bangalore"] },
  { code: "SMVB", name: "SMVT Bengaluru", city: "Bengaluru", aliases: ["baiyappanahalli", "bangalore"] },
  { code: "BNC", name: "Bengaluru Cantt", city: "Bengaluru", aliases: ["bangalore"] },
  { code: "KJM", name: "Krishnarajapuram", city: "Bengaluru" },
  { code: "SC", name: "Secunderabad Jn", city: "Hyderabad" },
  { code: "HYB", name: "Hyderabad Deccan", city: "Hyderabad", aliases: ["nampally"] },
  { code: "KCG", name: "Kacheguda", city: "Hyderabad" },
  { code: "PUNE", name: "Pune Jn", city: "Pune", aliases: ["poona"] },
  { code: "ADI", name: "Ahmedabad Jn", city: "Ahmedabad" },
  { code: "BRC", name: "Vadodara Jn", city: "Vadodara", aliases: ["baroda"] },
  { code: "ST", name: "Surat", city: "Surat" },
  { code: "RJT", name: "Rajkot Jn", city: "Rajkot" },
  { code: "JP", name: "Jaipur Jn", city: "Jaipur" },
  { code: "AII", name: "Ajmer Jn", city: "Ajmer" },
  { code: "JU", name: "Jodhpur Jn", city: "Jodhpur" },
  { code: "UDZ", name: "Udaipur City", city: "Udaipur" },
  { code: "KOTA", name: "Kota Jn", city: "Kota" },
  { code: "BKN", name: "Bikaner Jn", city: "Bikaner" },
  { code: "LKO", name: "Lucknow Charbagh", city: "Lucknow" },
  { code: "LJN", name: "Lucknow Jn", city: "Lucknow" },
  { code: "CNB", name: "Kanpur Central", city: "Kanpur" },
  { code: "PRYJ", name: "Prayagraj Jn", city: "Prayagraj", aliases: ["allahabad"] },
  { code: "BSB", name: "Varanasi Jn", city: "Varanasi", aliases: ["banaras", "benares", "kashi"] },
  { code: "DDU", name: "Pt. Deen Dayal Upadhyaya Jn", city: "Mughalsarai", aliases: ["mughalsarai"] },
  { code: "GKP", name: "Gorakhpur Jn", city: "Gorakhpur" },
  { code: "AGC", name: "Agra Cantt", city: "Agra" },
  { code: "MTJ", name: "Mathura Jn", city: "Mathura" },
  { code: "GWL", name: "Gwalior Jn", city: "Gwalior" },
  { code: "VGLJ", name: "Virangana Lakshmibai Jhansi", city: "Jhansi", aliases: ["jhansi"] },
  { code: "BPL", name: "Bhopal Jn", city: "Bhopal" },
  { code: "RKMP", name: "Rani Kamlapati", city: "Bhopal", aliases: ["habibganj"] },
  { code: "JBP", name: "Jabalpur", city: "Jabalpur" },
  { code: "INDB", name: "Indore Jn", city: "Indore" },
  { code: "UJN", name: "Ujjain Jn", city: "Ujjain" },
  { code: "ET", name: "Itarsi Jn", city: "Itarsi" },
  { code: "NGP", name: "Nagpur Jn", city: "Nagpur" },
  { code: "R", name: "Raipur Jn", city: "Raipur" },
  { code: "BSP", name: "Bilaspur Jn", city: "Bilaspur" },
  { code: "PNBE", name: "Patna Jn", city: "Patna" },
  { code: "RJPB", name: "Rajendra Nagar Terminal", city: "Patna" },
  { code: "GAYA", name: "Gaya Jn", city: "Gaya" },
  { code: "MFP", name: "Muzaffarpur Jn", city: "Muzaffarpur" },
  { code: "DBG", name: "Darbhanga Jn", city: "Darbhanga" },
  { code: "RNC", name: "Ranchi", city: "Ranchi" },
  { code: "TATA", name: "Tatanagar Jn", city: "Jamshedpur", aliases: ["jamshedpur"] },
  { code: "DHN", name: "Dhanbad Jn", city: "Dhanbad" },
  { code: "ASN", name: "Asansol Jn", city: "Asansol" },
  { code: "BWN", name: "Barddhaman", city: "Bardhaman", aliases: ["burdwan"] },
  { code: "BBS", name: "Bhubaneswar", city: "Bhubaneswar" },
  { code: "PURI", name: "Puri", city: "Puri" },
  { code: "CTC", name: "Cuttack", city: "Cuttack" },
  { code: "VSKP", name: "Visakhapatnam", city: "Visakhapatnam", aliases: ["vizag"] },
  { code: "BZA", name: "Vijayawada Jn", city: "Vijayawada" },
  { code: "GNT", name: "Guntur Jn", city: "Guntur" },
  { code: "TPTY", name: "Tirupati", city: "Tirupati" },
  { code: "NLR", name: "Nellore", city: "Nellore" },
  { code: "GHY", name: "Guwahati", city: "Guwahati" },
  { code: "NJP", name: "New Jalpaiguri", city: "Siliguri", aliases: ["siliguri"] },
  { code: "DBRG", name: "Dibrugarh", city: "Dibrugarh" },
  { code: "CDG", name: "Chandigarh", city: "Chandigarh" },
  { code: "UMB", name: "Ambala Cantt", city: "Ambala" },
  { code: "LDH", name: "Ludhiana Jn", city: "Ludhiana" },
  { code: "ASR", name: "Amritsar Jn", city: "Amritsar" },
  { code: "JAT", name: "Jammu Tawi", city: "Jammu" },
  { code: "SVDK", name: "Shri Mata Vaishno Devi Katra", city: "Katra", aliases: ["katra", "vaishno devi"] },
  { code: "DDN", name: "Dehradun", city: "Dehradun" },
  { code: "HW", name: "Haridwar Jn", city: "Haridwar" },
  { code: "KGM", name: "Kathgodam", city: "Haldwani", aliases: ["nainital"] },
  { code: "ERS", name: "Ernakulam Jn", city: "Kochi", aliases: ["cochin", "kochi"] },
  { code: "ERN", name: "Ernakulam Town", city: "Kochi" },
  { code: "TVC", name: "Thiruvananthapuram Central", city: "Thiruvananthapuram", aliases: ["trivandrum"] },
  { code: "CLT", name: "Kozhikode", city: "Kozhikode", aliases: ["calicut"] },
  { code: "TCR", name: "Thrissur", city: "Thrissur" },
  { code: "KTYM", name: "Kottayam", city: "Kottayam" },
  { code: "CBE", name: "Coimbatore Jn", city: "Coimbatore" },
  { code: "MDU", name: "Madurai Jn", city: "Madurai" },
  { code: "TPJ", name: "Tiruchchirappalli Jn", city: "Trichy", aliases: ["trichy"] },
  { code: "SA", name: "Salem Jn", city: "Salem" },
  { code: "ED", name: "Erode Jn", city: "Erode" },
  { code: "MAO", name: "Madgaon", city: "Goa", aliases: ["margao", "goa"] },
  { code: "KRMI", name: "Karmali", city: "Goa", aliases: ["goa", "panaji"] },
  { code: "VSG", name: "Vasco da Gama", city: "Goa", aliases: ["goa"] },
  { code: "MAJN", name: "Mangaluru Jn", city: "Mangaluru", aliases: ["mangalore"] },
  { code: "MAQ", name: "Mangaluru Central", city: "Mangaluru", aliases: ["mangalore"] },
  { code: "UBL", name: "SSS Hubballi Jn", city: "Hubballi", aliases: ["hubli"] },
  { code: "MYS", name: "Mysuru Jn", city: "Mysuru", aliases: ["mysore"] },
  { code: "NK", name: "Nashik Road", city: "Nashik" },
  { code: "AWB", name: "Chhatrapati Sambhajinagar", city: "Aurangabad", aliases: ["aurangabad"] },
  { code: "SUR", name: "Solapur", city: "Solapur" },
  { code: "KOP", name: "Kolhapur", city: "Kolhapur" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Ranked local search: exact code → code prefix → name/city/alias prefix → contains. */
export function searchLocalStations(q: string, limit = 8): LocalStation[] {
  const n = norm(q);
  if (!n) return MAJOR_STATIONS.slice(0, limit);
  const scored = MAJOR_STATIONS.map((s) => {
    const code = s.code.toLowerCase();
    const hay = [s.name, s.city, ...(s.aliases || [])].map(norm);
    let score = 0;
    if (code === n) score = 100;
    else if (code.startsWith(n)) score = 80;
    else if (hay.some((h) => h.startsWith(n))) score = 60;
    else if (hay.some((h) => h.split(" ").some((w) => w.startsWith(n)))) score = 45;
    else if (hay.some((h) => h.includes(n))) score = 30;
    return { s, score };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name)).slice(0, limit).map((x) => x.s);
}

export const stationLabel = (s: { code: string; name: string }) => `${s.name} (${s.code})`;
/** Extract a code from "New Delhi (NDLS)" or a bare "NDLS". */
export function parseStationInput(v: string): string | null {
  const m = v.match(/\(([A-Z0-9]{1,6})\)\s*$/i) || v.trim().match(/^([A-Z0-9]{1,6})$/i);
  return m ? m[1].toUpperCase() : null;
}
