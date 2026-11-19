---
name: ocr-documentos-peru
description: Extrae, normaliza y estructura datos mediante OCR de documentos de identidad de Perú (DNI Azul, DNI Electrónico - DNIe y Carné de Extranjería - CE), unificando sus etiquetas dispares en un esquema JSON estándar. Usar siempre que se procesen imágenes, PDF o texto crudo de OCR de documentos de identidad peruanos para registro de personal, planillas o validación de identidad.
---

# Extracción y Normalización OCR de Documentos de Identidad (Perú)

Este skill estandariza la lectura OCR de tres tipos de documentos oficiales en Perú: **DNI Azul**, **DNI Electrónico (DNIe)** y **Carné de Extranjería (CE)**, resolviendo las diferencias de nomenclatura entre anverso y reverso.

## Flujo de Trabajo

1. **Clasificar el tipo de documento** a partir de encabezados y estructura visual/textual:
   - `DNI_AZUL`: Encabezado *"Documento Nacional de Identidad"*, fondo celeste/azul, campos separados para *"Primer Apellido"*, *"Segundo Apellido"* y *"Pre Nombres"*.
   - `DNI_ELECTRONICO`: Encabezado *"Documento Nacional de Identidad Electrónico"* o chip visible, campos agrupados como *"Apellidos"* y *"Prenombres"*, incluye *"Nacionalidad"*.
   - `CARNET_EXTRANJERIA`: Encabezado *"Carné de Extranjería"* (Migraciones), número de 9 dígitos bajo *"CARNÉ DE EXTRANJERÍA N°"*, campos *"Emisión"* y *"Caducidad"* sin prefijo "Fecha de".
2. **Extraer y mapear los 13 campos obligatorios** siguiendo las reglas de correspondencia exacta.
3. **Normalizar formatos** (fechas a `DD/MM/AAAA`, textos en mayúsculas sin ruido de lectura OCR, ceros a la izquierda preservados en el número de documento).
4. **Validar cruzadamente con la zona MRZ** (si está presente en el texto OCR) para corregir errores de lectura en números o letras afectadas por hologramas.
5. **Devolver el resultado estructurado** estrictamente bajo el esquema JSON definido. Si un campo no es legible o corresponde a una cara no proporcionada (ej. falta el reverso para dirección/ubigeo), asignar `null`.

---

## Tabla de Mapeo Exacto por Tipo de Documento

| # | Campo Estándar (JSON) | DNI Azul | DNI Electrónico (DNIe) | Carné de Extranjería (CE) |
|---|---|---|---|---|
| 1 | `primer_apellido_o_apellidos` | Etiqueta: **Primer Apellido** | Etiqueta: **Apellidos** | Etiqueta: **Apellidos** / **Primer Apellido** |
| 2 | `segundo_apellido_o_prenombres` | Etiqueta: **Segundo Apellido** | Etiqueta: **Prenombres** | Etiqueta: **Nombres** / **Prenombres** |
| 3 | `sexo` | Etiqueta: **Sexo** (`M` / `F`) | Etiqueta: **Sexo** (`M` / `F`) | Etiqueta: **Sexo** (`M` / `F`) |
| 4 | `estado_civil` | Etiqueta: **Estado Civil** | Etiqueta: **Estado Civil** | Etiqueta: **Estado Civil** |
| 5 | `fecha_nacimiento` | Etiqueta: **Nacimiento** | Etiqueta: **Fecha de Nacimiento** | Etiqueta: **Fecha de Nacimiento** |
| 6 | `fecha_emision` | Etiqueta: **Fecha de Emisión** | Etiqueta: **Fecha de Emisión** | Etiqueta: **Emisión** |
| 7 | `fecha_caducidad` | Etiqueta: **Fecha de Caducidad** | Etiqueta: **Fecha de Caducidad** | Etiqueta: **Caducidad** |
| 8 | `numero_documento` | Etiqueta: **DNI** (8 dígitos: `"00000000"`) | Etiqueta: **DNI** (8 dígitos: `"00000000"`) | Etiqueta: **CARNET DE EXTRANJERIA N°** (9 dígitos: `"000000000"`) |
| 9 | `nacionalidad` | **Valor fijo:** `"PERU"` (no figura impreso) | Etiqueta: **Nacionalidad** (ej. `"PER"`, `"PERUANA"`) | Etiqueta: **Nacionalidad** (ej. `"VEN"`, `"COL"`, etc.) |
| 10 | `direccion` | Reverso — Etiqueta: **Dirección** | Reverso — Etiqueta: **Dirección** | Reverso — Etiqueta: **Dirección** / **Domicilio** |
| 11 | `departamento` | Reverso — Etiqueta: **Departamento** | Reverso — Etiqueta: **Departamento** | Reverso — Etiqueta: **Departamento** |
| 12 | `provincia` | Reverso — Etiqueta: **Provincia** | Reverso — Etiqueta: **Provincia** | Reverso — Etiqueta: **Provincia** |
| 13 | `distrito` | Reverso — Etiqueta: **Distrito** | Reverso — Etiqueta: **Distrito** | Reverso — Etiqueta: **Distrito** |

> **Nota sobre DNI Azul:** En el DNI Azul, el campo **Pre Nombres** existe en el documento físico, pero los campos 1 y 2 capturan específicamente `Primer Apellido` y `Segundo Apellido`. Si el documento es `DNI_AZUL`, capturar adicionalmente los prenombres en el campo auxiliar `prenombres_dni_azul` (para `DNI_ELECTRONICO` y `CARNET_EXTRANJERIA` dejarlo en `null`).

---

## Esquema de Salida JSON

Responder siempre con esta estructura limpia y sin texto adicional innecesario:

```json
{
  "tipo_documento": "DNI_AZUL | DNI_ELECTRONICO | CARNET_EXTRANJERIA",
  "datos": {
    "primer_apellido_o_apellidos": "",
    "segundo_apellido_o_prenombres": "",
    "prenombres_dni_azul": null,
    "sexo": "",
    "estado_civil": "",
    "fecha_nacimiento": "DD/MM/AAAA",
    "fecha_emision": "DD/MM/AAAA",
    "fecha_caducidad": "DD/MM/AAAA",
    "numero_documento": "",
    "nacionalidad": "",
    "direccion": "",
    "departamento": "",
    "provincia": "",
    "distrito": ""
  },
  "observaciones_ocr": []
}
```

