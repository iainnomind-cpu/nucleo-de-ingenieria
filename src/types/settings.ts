export interface OperationalDefaults {
    cost_per_km: number;
    viaticos_per_person: number;
    insurance_cost: number;
    vehicle_wear: number;
    maniobra_cost: number;
    margin_percent: number;
    tax_percent: number;
    crew_size: number;
    estimated_days: number;
    max_voltage_unbalance: number;
    max_amperage_unbalance: number;
}

export const DEFAULT_OPERATIONAL_VALUES: OperationalDefaults = {
    cost_per_km: 5.50,
    viaticos_per_person: 850,
    insurance_cost: 0,
    vehicle_wear: 0,
    maniobra_cost: 0,
    margin_percent: 20,
    tax_percent: 16,
    crew_size: 2,
    estimated_days: 1,
    max_voltage_unbalance: 3,
    max_amperage_unbalance: 10,
};

export interface SystemSetting {
    id: string;
    key: string;
    value: Record<string, unknown>;
    description: string | null;
    updated_at: string;
}

// Labels para la UI
export const OPERATIONAL_FIELD_LABELS: Record<keyof OperationalDefaults, { label: string; unit: string; icon: string; description: string }> = {
    cost_per_km: {
        label: 'Costo por Kilómetro',
        unit: '$/km',
        icon: 'local_shipping',
        description: 'Costo de traslado por cada kilómetro recorrido (ida). Se multiplica ×2 en cotización (ida y vuelta).',
    },
    viaticos_per_person: {
        label: 'Viático Diario por Persona',
        unit: '$/persona/día',
        icon: 'restaurant',
        description: 'Monto diario de viáticos para alimentación y hospedaje por cada miembro de la cuadrilla.',
    },
    insurance_cost: {
        label: 'Seguro Vehicular',
        unit: '$',
        icon: 'verified_user',
        description: 'Monto fijo de seguro vehicular aplicado por cada cotización. Puede variar por proyecto.',
    },
    vehicle_wear: {
        label: 'Desgaste de Vehículo',
        unit: '$',
        icon: 'directions_car',
        description: 'Costo estimado por desgaste vehicular (llantas, mantenimiento, depreciación).',
    },
    maniobra_cost: {
        label: 'Costo de Maniobras',
        unit: '$',
        icon: 'precision_manufacturing',
        description: 'Costo base por maniobra de carga/descarga de equipo pesado.',
    },
    margin_percent: {
        label: 'Margen de Utilidad',
        unit: '%',
        icon: 'trending_up',
        description: 'Porcentaje de margen de utilidad aplicado por defecto sobre el subtotal.',
    },
    tax_percent: {
        label: 'IVA',
        unit: '%',
        icon: 'receipt_long',
        description: 'Porcentaje de IVA vigente. Normalmente 16% en México.',
    },
    crew_size: {
        label: 'Tamaño de Cuadrilla',
        unit: 'personas',
        icon: 'group',
        description: 'Número de personas por defecto en la cuadrilla de trabajo.',
    },
    estimated_days: {
        label: 'Días Estimados',
        unit: 'días',
        icon: 'calendar_today',
        description: 'Número de días estimados por defecto para un servicio estándar.',
    },
    max_voltage_unbalance: {
        label: 'Desbalance Máximo de Voltaje',
        unit: '%',
        icon: 'bolt',
        description: 'Límite aceptable de desbalance entre las 3 fases de tensión (Norma NEMA recomendada: 3%).',
    },
    max_amperage_unbalance: {
        label: 'Desbalance Máximo de Corriente',
        unit: '%',
        icon: 'speed',
        description: 'Límite aceptable de desbalance entre las 3 fases de corriente (Norma NEMA recomendada: 10%).',
    },
};
