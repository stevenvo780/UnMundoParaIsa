# Scripts de Utilidades

Scripts de desarrollo para mantener la calidad del código.

## Uso

### Limpiar Comentarios
Elimina comentarios inline (`//`) de archivos TypeScript, preservando JSDoc, directivas de ESLint y TypeScript.

```bash
npx tsx scripts/clean-comments.ts [ruta]
```

**Ejemplos:**
```bash
# Limpiar todo el directorio src
npx tsx scripts/clean-comments.ts ./src

# Limpiar un archivo específico
npx tsx scripts/clean-comments.ts ./src/domain/MyClass.ts
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
npx tsx scripts/validate-string-to-enum.ts [opciones]
```

**Opciones:**
- `--verbose`: Muestra detalles de falsos positivos ignorados
- `--all`: Muestra todos los resultados

**Salida:**
- Reporte en consola con strings que deberían usar enums
- Lista de enums no utilizados
- Archivo `enum-validation-report.json` con reporte completo
