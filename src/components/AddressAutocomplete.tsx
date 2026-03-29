import { useEffect, useRef } from 'react';
import { attachAutocomplete, GeoResult } from '../lib/maps';

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (result: GeoResult) => void;
    placeholder?: string;
    className?: string;
}

export default function AddressAutocomplete({
    value,
    onChange,
    onSelect,
    placeholder = 'Buscar dirección...',
    className = '',
}: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        if (!inputRef.current || autocompleteRef.current) return;
        attachAutocomplete(inputRef.current, (result) => {
            onChange(result.formatted_address);
            onSelect(result);
        }).then(ac => { autocompleteRef.current = ac; }).catch(() => {/* Maps not loaded yet */ });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const defaultClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

    return (
        <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">location_on</span>
            <input
                ref={inputRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={`${className || defaultClass} pl-10`}
            />
        </div>
    );
}
