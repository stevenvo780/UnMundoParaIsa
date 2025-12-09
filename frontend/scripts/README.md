# Scripts de Utilidad - Frontend

Este directorio contiene scripts de utilidad para el desarrollo y mantenimiento del código.

## Scripts Disponibles

### clean-comments.ts

Elimina comentarios inline (`//`) del código TypeScript de manera segura.

**Características:**
- Solo elimina comentarios `//` que no estén dentro de strings o regex
- Preserva JSDoc, directivas de ESLint/TypeScript, y comentarios importantes
- Crea backups automáticos antes de modificar archivos
- Excluye directorios como `node_modules`, `dist`, `.git`, etc.

**Uso:**
```bash
npm run clean:comments [ruta]
```

Si no se especifica una ruta, procesa `./src` por defecto.

**Ejemplo:**
```bash
# Limpiar todos los archivos en src/
npm run clean:comments

# Limpiar un archivo específico
npm run clean:comments src/core/World.ts

# Limpiar un directorio específico
npm run clean:comments src/systems
```

## Notas

- Todos los scripts crean backups antes de modificar archivos
- Se recomienda revisar los cambios con `git diff` antes de commitear
- Ejecutar `npm run lint` después de usar los scripts de limpieza
