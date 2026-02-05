# Algorithm Diagram Specification

## Overview

Este documento define el formato estandar para generar diagramas de algoritmos automaticamente. La funcion `generateDiagramFromSpec()` convierte un spec declarativo en un objeto `diagram` con nodos y edges posicionados automaticamente.

## Funcion Disponible

```javascript
// En el frontend (process_manager.js)
window.generateDiagramFromSpec(spec, options)

// Retorna: { nodes: [...], edges: [...] }
```

## Formato del Spec

```javascript
const spec = {
    id: 'algorithm_id',      // ID unico del algoritmo
    name: 'Algorithm Name',  // Nombre para display
    flow: [
        // Array de pasos del algoritmo
    ]
};
```

## Formato de cada Flow Item

```javascript
{
    id: 'step_id',           // ID unico del paso (required)
    type: 'process',         // Tipo de nodo (required)
    label: 'Step Name',      // Texto a mostrar (required)
    from: 'previous_id',     // ID del paso anterior (optional)
    branch: 'Label'          // Label del edge si viene de decision (optional)
}
```

### Tipos de Nodo

| Type | Descripcion | Forma Visual |
|------|-------------|--------------|
| `input` | Entrada del algoritmo | Rectangulo redondeado (verde) |
| `process` | Paso de procesamiento | Rectangulo (azul) |
| `decision` | Punto de decision/branch | Diamante (amarillo) |
| `output` | Salida del algoritmo | Rectangulo redondeado (morado) |

### Propiedad `from`

- **String**: Un solo origen - `from: 'step_a'`
- **Array**: Multiples origenes (merge) - `from: ['step_a', 'step_b']`
- **Omitido**: Nodo inicial sin dependencias

### Propiedad `branch`

Usado cuando el paso viene de un nodo `decision`. Define el label del edge.

```javascript
{ id: 'fast', type: 'process', label: 'Fast Mode', from: 'decision', branch: 'Fast' }
{ id: 'slow', type: 'process', label: 'Slow Mode', from: 'decision', branch: 'Slow' }
```

## Ejemplos Completos

### Ejemplo 1: IRIS (Receipt Scanner)

```javascript
const IRIS_SPEC = {
    id: 'iris',
    name: 'IRIS Receipt Scanner',
    flow: [
        { id: 'input', type: 'input', label: 'Image/PDF' },
        { id: 'detect', type: 'process', label: 'Detect Format', from: 'input' },
        { id: 'mode', type: 'decision', label: 'Mode?', from: 'detect' },
        { id: 'fast', type: 'process', label: 'GPT-4o-mini', from: 'mode', branch: 'Fast' },
        { id: 'heavy', type: 'process', label: 'GPT-4o', from: 'mode', branch: 'Heavy' },
        { id: 'extract', type: 'process', label: 'Extract Fields', from: ['fast', 'heavy'] },
        { id: 'output', type: 'output', label: 'vendor, amount, date', from: 'extract' }
    ]
};

const diagram = generateDiagramFromSpec(IRIS_SPEC);
```

### Ejemplo 2: ATLAS (Expense Categorizer)

```javascript
const ATLAS_SPEC = {
    id: 'atlas',
    name: 'ATLAS Expense Categorizer',
    flow: [
        { id: 'input', type: 'input', label: 'Expense Data' },
        { id: 'context', type: 'process', label: 'Load Context', from: 'input' },
        { id: 'mode', type: 'decision', label: 'Mode?', from: 'context' },
        { id: 'standard', type: 'process', label: 'GPT-4o-mini', from: 'mode', branch: 'Standard' },
        { id: 'deep', type: 'process', label: 'GPT-4o', from: 'mode', branch: 'Deep' },
        { id: 'match', type: 'process', label: 'Match History', from: ['standard', 'deep'] },
        { id: 'confidence', type: 'decision', label: 'Confidence?', from: 'match' },
        { id: 'output', type: 'output', label: 'category', from: 'confidence', branch: '>70%' },
        { id: 'suggestions', type: 'output', label: 'suggestions[]', from: 'confidence', branch: '<70%' }
    ]
};

const diagram = generateDiagramFromSpec(ATLAS_SPEC);
```

### Ejemplo 3: Pipeline Simple

```javascript
const SIMPLE_SPEC = {
    id: 'simple_pipeline',
    name: 'Simple Pipeline',
    flow: [
        { id: 'start', type: 'input', label: 'Request' },
        { id: 'validate', type: 'process', label: 'Validate', from: 'start' },
        { id: 'process', type: 'process', label: 'Process', from: 'validate' },
        { id: 'save', type: 'process', label: 'Save to DB', from: 'process' },
        { id: 'end', type: 'output', label: 'Response', from: 'save' }
    ]
};
```

## Opciones de Layout

```javascript
generateDiagramFromSpec(spec, {
    width: 400,         // Ancho del canvas (default 400)
    nodeSpacingY: 80,   // Espacio vertical entre layers (default 80)
    nodeSpacingX: 120   // Espacio horizontal entre nodos en mismo layer (default 120)
});
```

## Output: Diagram Object

La funcion retorna un objeto con la estructura esperada por `renderDiagramSvg()`:

```javascript
{
    nodes: [
        { id: 'input', label: 'Image/PDF', type: 'input', x: 200, y: 50 },
        { id: 'detect', label: 'Detect Format', type: 'process', x: 200, y: 130 },
        // ...
    ],
    edges: [
        { from: 'input', to: 'detect' },
        { from: 'mode', to: 'fast', label: 'Fast' },
        // ...
    ]
}
```

## Uso con Claude

Cuando el usuario pida generar un diagrama para un algoritmo:

1. Analizar el codigo/descripcion del algoritmo
2. Identificar inputs, outputs, procesos y decisiones
3. Crear el spec siguiendo este formato
4. Llamar a `generateDiagramFromSpec(spec)`
5. El resultado se puede asignar directamente a `node.diagram`

### Prompt Pattern

```
Genera el AlgorithmSpec para [nombre del algoritmo]:
- Inputs: [lista de inputs]
- Proceso: [descripcion del flujo]
- Decisiones: [puntos de decision]
- Outputs: [lista de outputs]
```

## Notas de Implementacion

- Los layers se calculan automaticamente con topological sort
- Los nodos se centran horizontalmente en cada layer
- Multiple origenes (merge) funcionan correctamente
- Los branches de decisiones se posicionan lado a lado
- La altura total se ajusta segun numero de layers
