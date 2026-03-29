import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, PIN_COLORS, PinColor } from '../lib/maps';

export interface MapPin {
    id: string;
    lat: number;
    lng: number;
    title: string;
    color: PinColor;
    label?: string;
    icon?: string;
    info?: React.ReactNode;
}

interface GoogleMapProps {
    pins: MapPin[];
    center?: { lat: number; lng: number };
    zoom?: number;
    height?: string;
    className?: string;
    onPinClick?: (pin: MapPin) => void;
    showInfoOnClick?: boolean;
    fitBounds?: boolean;
}

export default function GoogleMapView({
    pins,
    center,
    zoom = 10,
    height = '400px',
    className = '',
    onPinClick,
    showInfoOnClick = true,
    fitBounds = true,
}: GoogleMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(false);

    // Load Google Maps
    useEffect(() => {
        loadGoogleMaps().then(() => setReady(true)).catch(() => setError(true));
    }, []);

    // Initialize map
    useEffect(() => {
        if (!ready || !mapRef.current) return;

        const defaultCenter = center || (pins.length > 0 ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 19.7053, lng: -103.4617 });
        mapInstance.current = new google.maps.Map(mapRef.current, {
            center: defaultCenter,
            zoom,
            mapTypeControl: true,
            mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
        });
        infoWindowRef.current = new google.maps.InfoWindow();
    }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update markers
    useEffect(() => {
        if (!mapInstance.current || !ready) return;

        // Clear old markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        pins.forEach(pin => {
            const marker = new google.maps.Marker({
                position: { lat: pin.lat, lng: pin.lng },
                map: mapInstance.current!,
                title: pin.title,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: PIN_COLORS[pin.color] || PIN_COLORS.blue,
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                    scale: 10,
                },
                label: pin.label ? { text: pin.label, color: '#fff', fontSize: '10px', fontWeight: 'bold' } : undefined,
            });

            marker.addListener('click', () => {
                if (onPinClick) onPinClick(pin);
                if (showInfoOnClick && infoWindowRef.current) {
                    // Create info content
                    const div = document.createElement('div');
                    div.style.cssText = 'min-width:180px;font-family:Inter,sans-serif;';
                    div.innerHTML = `
                        <div style="padding:4px 0">
                            <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px 0">${pin.title}</p>
                            ${pin.info ? `<div style="font-size:12px;color:#64748b">${pin.info}</div>` : ''}
                        </div>
                    `;
                    infoWindowRef.current!.setContent(div);
                    infoWindowRef.current!.open(mapInstance.current!, marker);
                }
            });

            bounds.extend(marker.getPosition()!);
            markersRef.current.push(marker);
        });

        if (fitBounds && pins.length > 1) {
            mapInstance.current.fitBounds(bounds, 60);
        } else if (pins.length === 1) {
            mapInstance.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
            mapInstance.current.setZoom(zoom);
        }
    }, [pins, ready]); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        return (
            <div className={`flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 ${className}`} style={{ height }}>
                <div className="text-center text-slate-400">
                    <span className="material-symbols-outlined text-[36px] mb-2">cloud_off</span>
                    <p className="text-sm">No se pudo cargar Google Maps</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 ${className}`} style={{ height }}>
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
                    <div className="flex items-center gap-2 text-slate-400">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        <span className="text-sm">Cargando mapa...</span>
                    </div>
                </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
        </div>
    );
}
