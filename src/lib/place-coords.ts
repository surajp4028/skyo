/**
 * Approximate coordinates of places used in SKYO tour packages (decimal degrees).
 * Used only to draw the package "Map view" — positions are for orientation, not navigation.
 * Add a place here when a new package uses it; unknown places are simply left off the map.
 */
export const PLACE_COORDS: Record<string, [number, number]> = {
  // Uttarakhand — Garhwal
  haridwar: [29.9457, 78.1642], rishikesh: [30.0869, 78.2676], dehradun: [30.3165, 78.0322], mussoorie: [30.4598, 78.0644],
  devprayag: [30.146, 78.598], srinagar_uk: [30.2245, 78.7836], rudraprayag: [30.2844, 78.9811], guptkashi: [30.5246, 79.0796],
  sonprayag: [30.6316, 79.0021], gaurikund: [30.6526, 79.0262], kedarnath: [30.7352, 79.0669], ukhimath: [30.5196, 79.0928],
  chopta: [30.4856, 79.2072], tungnath: [30.4892, 79.2156], chandrashila: [30.4936, 79.2181], deoria_tal: [30.5228, 79.1286],
  sari: [30.5093, 79.1435], joshimath: [30.555, 79.5643], auli: [30.5286, 79.5689], badrinath: [30.7433, 79.4938], mana: [30.772, 79.495],
  uttarkashi: [30.7268, 78.4354], gangotri: [30.9947, 78.9398], yamunotri: [31.0146, 78.4599], barkot: [30.8107, 78.2058],
  // Uttarakhand — Kumaon
  nainital: [29.3803, 79.4636], almora: [29.5971, 79.6591], ranikhet: [29.6434, 79.4322], kausani: [29.8443, 79.6036], jim_corbett: [29.53, 78.7747],
  // Himachal, J&K, Ladakh
  shimla: [31.1048, 77.1734], manali: [32.2432, 77.1892], kasol: [32.01, 77.315], dharamshala: [32.219, 76.3234], mcleodganj: [32.2426, 76.3213],
  dalhousie: [32.5387, 75.971], spiti: [32.2464, 78.0349], kaza: [32.2276, 78.0712], leh: [34.1526, 77.5771], nubra: [34.6, 77.55], pangong: [33.758, 78.667],
  srinagar: [34.0837, 74.7973], gulmarg: [34.0484, 74.3805], pahalgam: [34.0161, 75.315], sonamarg: [34.3007, 75.2926], katra: [32.9916, 74.9318],
  // North & West
  delhi: [28.6139, 77.209], "new delhi": [28.6139, 77.209], agra: [27.1767, 78.0081], jaipur: [26.9124, 75.7873], udaipur: [24.5854, 73.7125],
  jodhpur: [26.2389, 73.0243], jaisalmer: [26.9157, 70.9083], pushkar: [26.4897, 74.5511], amritsar: [31.634, 74.8723], varanasi: [25.3176, 82.9739],
  ayodhya: [26.7922, 82.1998], prayagraj: [25.4358, 81.8463], mathura: [27.4924, 77.6737], vrindavan: [27.5806, 77.7006], goa: [15.2993, 74.124],
  mumbai: [19.076, 72.8777], lonavala: [18.7546, 73.4062],
  // South & East
  munnar: [10.0889, 77.0595], alleppey: [9.4981, 76.3388], alappuzha: [9.4981, 76.3388], kochi: [9.9312, 76.2673], thekkady: [9.6031, 77.161],
  ooty: [11.4102, 76.695], coorg: [12.3375, 75.8069], mysore: [12.2958, 76.6394], hampi: [15.335, 76.46], pondicherry: [11.9416, 79.8083],
  darjeeling: [27.041, 88.2663], gangtok: [27.3389, 88.6065], shillong: [25.5788, 91.8933], "port blair": [11.6234, 92.7265], havelock: [12.0333, 92.9833],
};

export function placeCoord(name: string): [number, number] | null {
  const k = name.trim().toLowerCase();
  return PLACE_COORDS[k] ?? PLACE_COORDS[k.replace(/\s+/g, "_")] ?? PLACE_COORDS[k.split(/[,(]/)[0].trim()] ?? null;
}

/** Great-circle distance in km. */
export function kmBetween(a: [number, number], b: [number, number]) {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
