# Referencia de Codificación ZCodex

ZCodex es el lenguaje de marcado personalizado utilizado en Alquímico (MisNotas). A continuación se explica cada etiqueta disponible y cómo se utiliza para dar formato a tus notas.

## Encabezados
Permiten estructurar el documento con títulos de diferente jerarquía.
- **`..t1 texto`**: Crea un título principal (Heading 1). Se recomienda usar uno por nota.
- **`..t2 texto`**: Crea un subtítulo (Heading 2).
- **`..t3 texto`**: Crea un título de tercer nivel (Heading 3).

## Formato de Texto Básico
- **`..n texto n..`**: Aplica **negrita** al texto encerrado.
- **`..c texto c..`**: Aplica *cursiva* al texto encerrado.
- **`..r texto r..`**: Resalta el texto con un fondo color verde fluorescente.
- **`..r::HEX texto r..`**: Resalta el texto con un color de fondo personalizado usando código hexadecimal (sin #). Ejemplo: `..r::FF0000 texto r..`.
- **`..p texto p..`**: Define un bloque de párrafo.
- **`..s`**: Inserta un salto de línea en medio de un texto sin crear un nuevo bloque.

## Listas
- **`..l texto`**: Elemento de lista desordenada (viñeta).
- **`..lo texto`**: Elemento de lista ordenada (numerada).
- **`..m [ ] texto`**: Elemento de lista de tareas sin marcar.
- **`..m [x] texto`**: Elemento de lista de tareas marcado.

## Citas y Separadores
- **`..b texto b..`**: Crea un bloque de cita (Blockquote) estilizado, ideal para resaltar frases o notas importantes.
- **`..h`**: Inserta una línea horizontal divisoria.

## Código
- **`..cl texto c..`**: Formatea el texto como código en línea (ej. nombres de variables o comandos cortos).
- **`..c`**
  `Bloque de código`
  `c..`: Formatea un bloque de texto multilínea como código preformateado.

## Enlaces e Imágenes
- **`..e ::Url::texto:: e..`**: Inserta un enlace web (Hyperlink). Por ejemplo: `..e ::https://ejemplo.com::Mi Enlace:: e..`
- **`..ei ::Url::texto:: ei..`**: Incrusta una imagen desde una URL externa.
- **`..edir ::NombreArchivo.jpg::texto Alternativo:: edir..`**: Incrusta una imagen local guardada en el directorio de la nota actual (carpeta `img/`).

## Tablas
Para crear tablas, simplemente encierra los elementos entre dobles barras `//`. 
Por ejemplo:
```text
// Título 1 // Título 2 // Título 3 //  - Titulos de columna
// <- // <-> // -> // - Alineacion de texto columnas
:: Dato 1 :: Dato 2 :: Dato 3 ::  - Datos
:: Total ::  :: = :: - Total
```
dentro de las tablas los numeros se representan con un afterisco antes del numero (*1.45), en modo lectura se muestra sin el asterisco.
si dentro de una celda hay un *= mostrara el total de la columna, considerando solo los numeros de la columna definidos con el asterisco al inicio. Las filas de datos se encierran con ::