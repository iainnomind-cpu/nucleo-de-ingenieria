import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, PIN_COLORS, NUCLEO_HQ } from '../lib/maps';

interface MapPinPickerProps {
    lat: number | null;
    lng: number | null;
    onLocationChange: (lat: number, lng: number, address: string) => void;
    height?: string;
}

export default function MapPinPicker({ lat, lng, onLocationChange, height = '250px' }: MapPinPickerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        loadGoogleMaps().then(() => setReady(true)).catch(() => setError(true));
    }, []);

    // Initialize map
    useEffect(() => {
        if (!ready || !mapRef.current) return;

        const initialCenter = lat && lng ? { lat, lng } : NUCLEO_HQ;

        mapInstance.current = new google.maps.Map(mapRef.current, {
            center: initialCenter,
            zoom: lat && lng ? 14 : 9,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
        });

        geocoderRef.current = new google.maps.Geocoder();

        // Place initial marker if coordinates exist
        if (lat && lng) {
            placeMarker({ lat, lng });
        }

        // Click listener
        mapInstance.current.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
                const position = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                placeMarker(position);
                reverseGeocode(position);
            }
        });
    }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync marker when lat/lng prop changes externally (from autocomplete)
    useEffect(() => {
        if (!mapInstance.current || !ready) return;
        if (lat && lng) {
            placeMarker({ lat, lng });
            mapInstance.current.panTo({ lat, lng });
            mapInstance.current.setZoom(14);
        }
    }, [lat, lng, ready]); // eslint-disable-line react-hooks/exhaustive-deps

    function placeMarker(position: { lat: number; lng: number }) {
        if (markerRef.current) {
            markerRef.current.setPosition(position);
        } else if (mapInstance.current) {
            markerRef.current = new google.maps.Marker({
                position,
                map: mapInstance.current,
                draggable: true,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: PIN_COLORS.red,
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 3,
                    scale: 12,
                },
                animation: google.maps.Animation.DROP,
            });

            // Drag end listener
            markerRef.current.addListener('dragend', () => {
                const pos = markerRef.current?.getPosition();
                if (pos) {
                    reverseGeocode({ lat: pos.lat(), lng: pos.lng() });
                }
            });
        }
    }

    function reverseGeocode(position: { lat: number; lng: number }) {
        if (!geocoderRef.current) {
            onLocationChange(position.lat, position.lng, '');
            return;
        }
        geocoderRef.current.geocode({ location: position }, (results, status) => {
            const address = status === 'OK' && results?.[0]
                ? results[0].formatted_address
                : `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
            onLocationChange(position.lat, position.lng, address);
        });
    }

    if (error) {
        return (
            <div className="flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800" style={{ height }}>
                <p className="text-xs text-slate-400">No se pudo cargar el mapa</p>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" style={{ height }}>
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
                    <div className="flex items-center gap-2 text-slate-400">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        <span className="text-xs">Cargando mapa...</span>
                    </div>
                </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
            {ready && (
                <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                    <div className="rounded-md bg-black/60 px-3 py-1.5 text-center text-[10px] text-white backdrop-blur-sm">
                        📍 Haz clic en el mapa para marcar la ubicación · Arrastra el pin para ajustar
                    </div>
                </div>
            )}
        </div>
    );
}
