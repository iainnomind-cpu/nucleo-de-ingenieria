import re

with open('src/pages/WhatsApp/AutomationRules.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the WA navigation tabs array
content = re.sub(r"const tabs = \[\n\s*\{\s*label:\s*'Dashboard'.*?\{\s*label:\s*'Reportes'.*?\n\s*\];\n", "", content, flags=re.DOTALL)

# Remove the Header block that renders the tabs.
new_header = """            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         <span className="material-symbols-outlined text-emerald-500">bolt</span>
                         Automatizaciones Internas
                    </h3>
                    <p className="text-sm text-slate-500">Notificaciones de equipo vía WhatsApp cuando ocurren eventos en los módulos</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Regla
                </button>
            </div>"""

content = re.sub(r"\{\/\*\s*Header\s*\*\/\}.*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>", new_header, content, flags=re.DOTALL)

# Rename function
content = content.replace("export default function AutomationRules()", "export default function TareasTab()")

# Remove the outer flex-1 overflow-y-auto block
content = content.replace('<div className="flex-1 overflow-y-auto">', '<div>')

# Save as TareasTab.tsx
with open('src/pages/Settings/TareasTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
