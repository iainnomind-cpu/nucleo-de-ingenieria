import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\redi_\Downloads\Inventario BODEGA 2026.xlsx', data_only=True)

sql = []

def process_sheet(sheet_name, area, category):
    sheet = wb[sheet_name]
    for row in sheet.iter_rows(min_row=4):
        code = row[0].value
        if not code or str(code).strip() == '' or str(code).strip().startswith('INVENTARIO') or 'codigo' in str(code).strip().lower():
            continue
            
        code = str(code).strip()
        name = str(row[1].value).strip() if row[1].value else 'Sin nombre'
        try:
            unit_cost = float(row[3].value) if row[3].value else 0.0
        except:
            unit_cost = 0.0
        
        # In Excel sheets it's usually column F (index 5) for EXIST.
        try:
            current_stock = float(row[5].value) if row[5].value else 0.0
        except:
            current_stock = 0.0
            
        try:
            max_stock = float(row[7].value) if row[7].value else 0.0
        except:
            max_stock = 0.0
            
        try:
            min_stock = float(row[8].value) if row[8].value else 0.0
        except:
            min_stock = 0.0
        
        name_esc = name.replace("'", "''")
        
        sql.append(f"INSERT INTO inventory_products (code, name, category, unit, current_stock, min_stock, max_stock, unit_cost, area) VALUES ('{code}', '{name_esc}', '{category}', 'pieza', {current_stock}, {min_stock}, {max_stock}, {unit_cost}, '{area}') ON CONFLICT (code) DO NOTHING;")

process_sheet('Materiales p. limpieza de pozos', 'limpieza_pozos', 'consumible')
process_sheet('Equipos de Aforos', 'equipos_aforo', 'herramienta')

with open('import_new_areas.sql', 'w', encoding='utf-8') as f:
    f.write('-- Seed extra areas\n')
    f.write('\n'.join(sql))

print(f'Generated {len(sql)} SQL inserts.')
