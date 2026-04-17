import WhatsAppRules from '../WhatsApp/WhatsAppRules';

/**
 * Wrapper que muestra WhatsAppRules en modo "equipo interno" (clientMode=false).
 * Se renderiza dentro de Configuración > Automatizaciones.
 */
export default function TareasTab() {
    return <WhatsAppRules clientMode={false} />;
}
