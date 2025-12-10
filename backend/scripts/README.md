# Scripts de Utilidades - Backend

Scripts de desarrollo para mantener la calidad del código y analizar el sistema.

## Scripts Disponibles

### Limpiar Comentarios

Elimina comentarios inline (`//`) de archivos TypeScript, preservando JSDoc, directivas de ESLint y TypeScript.

```bash
npm run clean:comments [ruta]
# O directamente:
npx tsx scripts/clean-comments.ts [ruta]
```

**Ejemplos:**

```bash
# Limpiar todo el directorio src
npm run clean:comments ./src

# Limpiar un archivo específico
npm run clean:comments ./src/domain/MyClass.ts
```

**Preserva:**

- Comentarios JSDoc (`/** */`)
- ESLint directivas (`// eslint-disable-*`)
- TypeScript directivas (`// @ts-*`)
- Prettier directivas (`// prettier-ignore`)
- Regiones (`// #region`, `// #endregion`)
- Copyright

---

### Validar Enums y Strings

Detecta strings literales que deberían ser enums y enums que no se están utilizando.

```bash
npm run validate:enums [opciones]
# O directamente:
npx tsx scripts/validate-string-to-enum.ts [opciones]
```

**Opciones:**

- `--verbose`: Muestra detalles de falsos positivos ignorados
- `--all`: Muestra todos los resultados

**Salida:**

- Reporte en consola con strings que deberían usar enums
- Lista de enums no utilizados
- Archivo `enum-validation-report.json` con reporte completo

---

### Analizar Logs

Analiza archivos de logs de la simulación para estudiar patrones de comportamiento.

```bash
npm run analyze:logs [opciones]
# O directamente:
npx tsx scripts/analyze-logs.ts [opciones]
```

**Opciones:**

- `--file <path>`: Analizar un archivo específico (por defecto usa el más reciente)
- `--stats`: Mostrar estadísticas completas
- `--last <n>`: Mostrar últimas n entradas
- `--category <cat>`: Filtrar por categoría
- `--level <level>`: Filtrar por nivel (info, warn, error, debug)
- `--agent <id>`: Filtrar por ID de agente
- `--search <text>`: Buscar texto en mensajes
- `--export <path>`: Exportar resultados filtrados a un archivo

**Ejemplos:**

```bash
# Ver últimas 50 entradas
npm run analyze:logs -- --last 50

# Ver estadísticas completas
npm run analyze:logs -- --stats

# Filtrar errores
npm run analyze:logs -- --level error --last 20

# Buscar y exportar
npm run analyze:logs -- --search "agent" --export results.jsonl
```

---

## Otros Scripts útiles

### Linting y Formato

```bash
# Ejecutar linter y corregir automáticamente
npm run lint:fix

# Solo verificar sin corregir
npm run lint:check

# Formatear código con Prettier
npm run format

# Verificar formato sin modificar
npm run format:check
```

### Testing

```bash
# Ejecutar tests
npm test

# Ejecutar tests y ver resultados
npm run test:run

# Ejecutar tests en modo watch
npm run test:watch

# Generar reporte de cobertura
npm run test:coverage
```

## Notas

- Todos los scripts crean backups antes de modificar archivos
- Se recomienda revisar los cambios con `git diff` antes de commitear
- Ejecutar `npm run lint` después de usar los scripts de limpieza
