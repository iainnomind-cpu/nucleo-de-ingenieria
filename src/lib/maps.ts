// ─── Google Maps API Service Layer ───
// Centralized utility for all Maps API operations

const MAPS_API_KEY = 'AIzaSyCnpONcNQf8EaAGx0B2wy3Gziyw38WtdHw';

// Cd. Guzmán, Jalisco — base de operaciones de Núcleo de Ingeniería
export const NUCLEO_HQ = { lat: 19.7053, lng: -103.4617, label: 'Cd. Guzmán, Jalisco' };

// ─── Script Loader ───
let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
    if (window.google?.maps) return Promise.resolve();
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places,geometry&callback=__gmInit`;
        script.async = true;
        script.defer = true;
        (window as unknown as Record<string, unknown>).__gmInit = () => {
            delete (window as unknown as Record<string, unknown>).__gmInit;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
    });
    return loadPromise;
}

// ─── Geocoding ───
export interface GeoResult {
    lat: number;
    lng: number;
    formatted_address: string;
}

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
    await loadGoogleMaps();
    return new Promise(resolve => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address, region: 'MX' }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const loc = results[0].geometry.location;
                resolve({
                    lat: loc.lat(),
                    lng: loc.lng(),
                    formatted_address: results[0].formatted_address,
                });
            } else {
                resolve(null);
            }
        });
    });
}

// ─── Distance Matrix ───
export interface DistanceResult {
    distance_km: number;
    duration_minutes: number;
    duration_text: string;
    distance_text: string;
}

export async function calculateDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): Promise<DistanceResult | null> {
    // Try Distance Matrix API first, fallback to Haversine
    try {
        await loadGoogleMaps();
        const result = await new Promise<DistanceResult | null>(resolve => {
            const service = new google.maps.DistanceMatrixService();
            service.getDistanceMatrix(
                {
                    origins: [new google.maps.LatLng(origin.lat, origin.lng)],
                    destinations: [new google.maps.LatLng(destination.lat, destination.lng)],
                    travelMode: google.maps.TravelMode.DRIVING,
                    unitSystem: google.maps.UnitSystem.METRIC,
                },
                (response, status) => {
                    if (status === 'OK' && response) {
                        const element = response.rows[0]?.elements[0];
                        if (element?.status === 'OK') {
                            resolve({
                                distance_km: Math.round((element.distance.value / 1000) * 10) / 10,
                                duration_minutes: Math.round(element.duration.value / 60),
                                duration_text: element.duration.text,
                                distance_text: element.distance.text,
                            });
                        } else resolve(null);
                    } else resolve(null);
                }
            );
        });
        if (result) return result;
    } catch {
        // API not available, fall through to Haversine
    }

    // Haversine fallback (straight-line * 1.3 driving factor)
    const straightKm = haversineKm(origin, destination);
    const drivingKm = Math.round(straightKm * 1.3 * 10) / 10;
    const estimatedMinutes = Math.round(drivingKm / 60 * 60); // ~60 km/h avg
    return {
        distance_km: drivingKm,
        duration_minutes: estimatedMinutes,
        duration_text: `~${estimatedMinutes} min (est.)`,
        distance_text: `~${drivingKm} km (est.)`,
    };
}

// ─── Directions ───
export async function getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: { lat: number; lng: number }[]
): Promise<google.maps.DirectionsResult | null> {
    await loadGoogleMaps();
    return new Promise(resolve => {
        const service = new google.maps.DirectionsService();
        service.route(
            {
                origin: new google.maps.LatLng(origin.lat, origin.lng),
                destination: new google.maps.LatLng(destination.lat, destination.lng),
                waypoints: waypoints?.map(wp => ({
                    location: new google.maps.LatLng(wp.lat, wp.lng),
                    stopover: true,
                })),
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === 'OK' && result) resolve(result);
                else resolve(null);
            }
        );
    });
}

// ─── Places Autocomplete Attach ───
export async function attachAutocomplete(
    inputElement: HTMLInputElement,
    onSelect: (result: GeoResult) => void,
    options?: { country?: string }
): Promise<google.maps.places.Autocomplete> {
    await loadGoogleMaps();
    const autocomplete = new google.maps.places.Autocomplete(inputElement, {
        componentRestrictions: { country: options?.country || 'MX' },
        fields: ['geometry', 'formatted_address'],
        types: ['address'],
    });
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
            onSelect({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                formatted_address: place.formatted_address || '',
            });
        }
    });
    return autocomplete;
}

// ─── Static Map Image URL ───
export function getStaticMapUrl(
    lat: number,
    lng: number,
    opts?: { zoom?: number; width?: number; height?: number; markers?: { lat: number; lng: number; color?: string; label?: string }[] }
): string {
    const zoom = opts?.zoom || 14;
    const w = opts?.width || 600;
    const h = opts?.height || 300;
    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&scale=2&maptype=roadmap&key=${MAPS_API_KEY}`;

    if (opts?.markers) {
        for (const m of opts.markers) {
            url += `&markers=color:${m.color || 'red'}|label:${m.label || ''}|${m.lat},${m.lng}`;
        }
    } else {
        url += `&markers=color:red|${lat},${lng}`;
    }
    return url;
}

// ─── Google Maps Navigation URL ───
export function getNavigationUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

// ─── Geolocation (device GPS) ───
export function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ─── Pin Color Helpers ───
export type PinColor = 'green' | 'yellow' | 'red' | 'black' | 'blue' | 'orange' | 'purple';

export const PIN_COLORS: Record<PinColor, string> = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    black: '#374151',
    blue: '#3b82f6',
    orange: '#f97316',
    purple: '#8b5cf6',
};

// ─── Haversine Distance (offline fallback) ───
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
