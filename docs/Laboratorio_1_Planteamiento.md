# Laboratorio 1: Planteamiento del Tema y Prototipo

## 1. Título de la Propuesta
**Sendero Vivo 3D: Prototipo de Aplicación Inmersiva de Ecoturismo Comunitario y Naturaleza Accesible**

---

## 2. Resumen del Concepto
**Sendero Vivo 3D** es una aplicación web inmersiva en 3D que permite recorrer un entorno natural y rural comunitario (bosque de niebla, huerta de plantas medicinales, cascada y espacio de economía solidaria local) guiado por relatos de la comunidad que habita el territorio.

El proyecto parte de una premisa de **justicia espacial e intercultural**: el acceso al disfrute de la naturaleza, al turismo rural y al encuentro con otras culturas suele estar restringido por barreras físicas, geográficas, económicas y sensoriales. Mediante un entorno 3D accesible desde cualquier navegador (sin requerir visores de realidad virtual costosos), la aplicación acerca el territorio a personas que no pueden desplazarse físicamente, fortaleciendo a la vez la visibilidad y economía de las comunidades anfitrionas.

---

## 3. Selección del Grupo Vulnerable
### Grupo principal seleccionado
**Personas con movilidad reducida (particularmente usuarios de silla de ruedas, bastón o andador) y adultos mayores con limitaciones físicas o de desplazamiento.**

### Delimitación y contexto de vulnerabilidad
En muchos países y contextos locales, los espacios de turismo natural, senderos rurales y comunidades anfitrionas presentan terrenos irregulares, pendientes pronunciadas, ausencia de pasarelas adaptadas, falta de transporte accesible y distancias largas desde centros urbanos. Esto genera una exclusión múltiple:
1. **Exclusión física y recreativa:** se restringe su derecho al ocio, descanso y contacto con la naturaleza.
2. **Aislamiento social y territorial:** especialmente en adultos mayores que permanecen confinados en entornos urbanos o en sus domicilios.
3. **Brecha de acceso cultural:** pierden la oportunidad de conocer de primera mano modos de vida rurales, saberes comunitarios y patrimonios bioculturales vivos.

---

## 4. Definición de Necesidades del Grupo Vulnerable

| Dimensión | Necesidad identificada | Cómo responde el prototipo (*Sendero Vivo 3D*) |
| :--- | :--- | :--- |
| **Física / Motora** | Navegar un entorno natural sin depender de destreza motriz fina, combinaciones complejas de teclas ni desplazamientos prolongados. | Teletransporte directo entre estaciones, botones grandes de avance/retroceso, atajos simples de teclado y modo **Paseo Guiado Automático**. |
| **Sensorial y Vestibular** | Evitar mareos o cinetosis (*motion sickness*) por movimientos bruscos de cámara; facilitar lectura a personas con presbicia o baja visión leve. | Transiciones suaves de cámara, opción de reducir movimiento, **selector de tamaño de texto** (Normal / Grande / Extra Grande) y **modo Alto Contraste**. |
| **Auditiva / Cognitiva** | Comprender relatos culturales sin saturación de texto técnico ni controles confusos; contar con apoyo auditivo cuando la lectura cansa la vista. | **Lectura en voz alta** (síntesis de voz en español) con control de pausa y velocidad, acompañada de texto claro en pantalla y paisaje sonoro natural regulable. |
| **Tecnológica y Económica** | Acceder sin comprar gafas VR ni computadoras de gama alta, y sin instalaciones complejas. | Aplicación **Web 3D ligera**, ejecutable desde navegador estándar en PC, laptop o tableta. |
| **Intercultural y Social** | Conectar con comunidades rurales desde el respeto y el diálogo horizontal, evitando la folclorización o el aislamiento. | Relatos centrados en la voz de guías comunitarios, explicación de saberes medicinales, cuidado del agua y economía local solidaria, además de perspectiva ergonómica adaptable (altura de silla de ruedas vs. vista de pie). |

---

## 5. Enfoque Intercultural del Proyecto
El proyecto aborda la **interculturalidad** desde tres ejes:
1. **Territorio como sujeto vivo, no mero paisaje:** los relatos muestran la relación espiritual, ecológica y cotidiana de la comunidad con el bosque, las plantas y el agua.
2. **Diálogo de saberes:** en la estación de la huerta comunitaria se presentan plantas medicinales tradicionales articulando el conocimiento ancestral con su uso responsable actual.
3. **Visibilización de economías locales y accesibilidad universal:** se promueve el turismo comunitario inclusivo como oportunidad para que las comunidades rurales adapten sus rutas y amplíen su alcance hacia públicos históricamente excluidos.

---

## 6. Alcance del Prototipo (MVP – Laboratorio 1)
El prototipo funcional implementa un recorrido 3D interactivo de **250 metros con 6 estaciones conectadas mediante una pasarela de madera accesible**:
1. **Estación 1 – Mirador de la Neblina:** Bienvenida comunitaria, mapa botánico ilustrado y vista panorámica del valle.
2. **Estación 2 – Paso de los Árboles Abuelos:** Bosque primario con árbol centenario de raíces musgosas rodeado por la pasarela elevada.
3. **Estación 3 – Huerta Elevada de Saberes Medicinales:** Bancales elevados accesibles para silla de ruedas con especies nativas y relatos sobre medicina tradicional.
4. **Estación 4 – Quebrada y Cascada del Agua Viva:** Entorno hídrico texturizado con sonido adaptativo, caída animada de agua y reflexión sobre las fuentes hídricas.
5. **Estación 5 – Mirador de Aves y Descanso Accesible:** Pérgola sombreada con banca accesible, bahía para silla de ruedas y aves en vuelo suave.
6. **Estación 6 – Ramada de Oficios y Economía Solidaria:** Punto de encuentro con tapices tejidos andinos, cerámica y cierre del recorrido inclusivo.

### Funciones inclusivas implementadas en el prototipo
* **Navegación multimodal accesible:** clic en estación, avance/retroceso continuo tramo a tramo (`W`/`S`, flechas o botones), atajos `1`–`6`, controles de mirada sin arrastre e iconografía SVG personalizada.
* **Perspectiva ergonómica seleccionable:** vista a altura de silla de ruedas (`1.15 m`) o vista estándar (`1.65 m`).
* **Panel de Accesibilidad en tiempo real:** tamaño de fuente, alto contraste, reducción de movimiento, audio ambiental natural (Web Audio API) y narración en voz alta (Web Speech API).
