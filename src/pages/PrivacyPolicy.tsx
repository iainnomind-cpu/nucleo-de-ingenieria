export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-slate-900">
            <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Política de Privacidad
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div className="prose prose-slate prose-sm sm:prose-base dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 space-y-6">
                    <p>
                        <strong>Núcleo de Ingeniería</strong> ("nosotros", "nuestro" o "la Empresa") respeta su privacidad y está comprometido con la protección de sus datos personales. Esta Política de Privacidad explica cómo recopilamos, usamos, compartimos y protegemos su información en relación con nuestras plataformas y servicios de comunicación, incluyendo nuestro contacto a través de WhatsApp.
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        1. Información que Recopilamos
                    </h2>
                    <p>
                        Podemos recopilar y procesar los siguientes datos:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Información de contacto (nombre, número de teléfono de WhatsApp, correo electrónico).</li>
                        <li>Contenido de los mensajes y documentos intercambiados a través de WhatsApp y/o otros canales de comunicación.</li>
                        <li>Datos técnicos y de ubicación proporcionados de forma voluntaria al solicitar nuestros servicios técnicos u operativos.</li>
                    </ul>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        2. Uso de la Información
                    </h2>
                    <p>
                        Utilizamos la información recopilada para:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Proporcionar y gestionar la prestación de nuestros servicios de ingeniería, mantenimiento y proyectos.</li>
                        <li>Responder a sus consultas, brindar soporte técnico y enviar notificaciones importantes sobre sus servicios, proyectos o facturación.</li>
                        <li>Enviar alertas y comunicaciones relevantes solicitadas y autorizadas mediante nuestros canales oficiales (como WhatsApp).</li>
                    </ul>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        3. Compartición de Información con Terceros
                    </h2>
                    <p>
                        <strong>Núcleo de Ingeniería no vende ni alquila su información personal a terceros.</strong> Para la operación de nuestro canal de WhatsApp, utilizamos plataformas provistas por Meta (WhatsApp Cloud API) y nuestros propios servidores. La información se procesa únicamente para brindarle nuestros propios servicios.
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        4. Seguridad de sus Datos
                    </h2>
                    <p>
                        Contamos con controles y procedimientos técnicos y organizativos para salvaguardar y asegurar la información que recopilamos, con el objetivo de prevenir el acceso no autorizado, el uso indebido o la alteración.
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        5. Retención de Datos
                    </h2>
                    <p>
                        Conservaremos sus datos personales durante el tiempo que sea necesario para cumplir con los fines para los cuales fueron recopilados, incluidos los requisitos legales, contables o de informes.
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        6. Sus Derechos
                    </h2>
                    <p>
                        Usted tiene derecho a solicitar el acceso a, la corrección y eliminación de sus datos personales. Si desea ejercer alguno de estos derechos o dejar de recibir comunicaciones por WhatsApp, simplemente envíenos un mensaje indicándolo o contacte a nuestro equipo de soporte.
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">
                        7. Contacto
                    </h2>
                    <p>
                        Si tiene alguna duda o pregunta sobre esta Política de Privacidad, por favor comuníquese con nuestro equipo a través de nuestros canales oficiales de contacto provistos a nuestros clientes.
                    </p>
                </div>
            </div>
        </div>
    );
}
