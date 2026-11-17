/**
 * Recorrido ampliado de 6 estaciones para "Sendero Vivo 3D".
 * Traza una ruta ecológica continua de aproximadamente 250 metros sobre pasarela universal,
 * integrando naturaleza, accesibilidad ergonómica e interculturalidad comunitaria.
 */
export const STATIONS = [
  {
    id: 'mirador',
    number: 1,
    shortTitle: 'Mirador',
    title: 'Mirador de la Neblina',
    subtitle: 'Bienvenida comunitaria y lectura viva del territorio',
    guideName: 'Doña Rosa Gualinga',
    guideRole: 'Guía mayor de la comunidad anfitriona',
    territoryTag: 'Inicio · Altitud 1.950 m',
    boardwalkPoint: { x: -58, z: 56 },
    lookAt: { x: -42, y: 4.0, z: 38 },
    waterProximity: 0.1,
    storyParagraphs: [
      'Bienvenido al inicio del sendero comunitario. Para nuestra comunidad, la montaña no es solo un paisaje para mirar de paso: es un hogar vivo que guarda memoria, agua y alimento.',
      'En la realidad, llegar hasta este mirador requiere subir cuestas empinadas de tierra húmeda. Con esta pasarela digital accesible de 250 metros, cualquier persona en silla de ruedas o adulto mayor puede recorrer el bosque sin esfuerzo ni riesgo de caídas.'
    ],
    culturalNote:
      'En el diálogo intercultural, el territorio se concibe como un espacio de reciprocidad: quien visita agradece y respeta el ritmo de la naturaleza antes de adentrarse en el bosque.',
    accessibilityHighlight:
      'Plataforma inicial amplia para giro completo (1,80 m libres), señalética clara y pasarela continua sin escalones desde el primer metro.',
    highlights: [
      { label: 'Pasarela universal', detail: '250 m continuos sin escalones ni pendientes bruscas' },
      { label: 'Vista ergonómica', detail: 'Altura ajustable entre silla de ruedas (1,15 m) y de pie' }
    ]
  },
  {
    id: 'abuelos',
    number: 2,
    shortTitle: 'Árboles Abuelos',
    title: 'Paso de los Árboles Abuelos',
    subtitle: 'Bosque primario, memoria ecológica y raíces ancestrales',
    guideName: 'Taita Mateo Chimbo',
    guideRole: 'Guardabosques comunitario y narrador oral',
    territoryTag: 'Bosque Primario · Tramo 60 m',
    boardwalkPoint: { x: -26, z: 26 },
    lookAt: { x: -18, y: 5.5, z: 19 },
    waterProximity: 0.18,
    storyParagraphs: [
      'Detente junto a este árbol centenario. Sus raíces musgosas protegen el suelo de la erosión y sostienen en sus ramas orquídeas, bromelias y helechos que filtran la neblina matinal.',
      'En un sendero convencional, las raíces expuestas y el barro impiden el paso de ruedas o bastones. Aquí la pasarela elevada rodea con respeto al árbol abuelo sin compactar su suelo.'
    ],
    culturalNote:
      'Los árboles mayores son considerados guardianes de la memoria del territorio: marcan tiempos de siembra, refugian aves y unen generaciones bajo su sombra.',
    accessibilityHighlight:
      'Trazado curvo alrededor del árbol sin obstáculos en el piso, con botones de mirada lateral para contemplar la copa sin esfuerzo cervical ni arrastre de ratón.',
    highlights: [
      { label: 'Conservación activa', detail: 'Pasarela elevada que protege raíces y musgo' },
      { label: 'Ritmo sin prisa', detail: 'Avance libre por tramos o recorrido guiado' }
    ]
  },
  {
    id: 'huerta',
    number: 3,
    shortTitle: 'Huerta Medicinal',
    title: 'Huerta Elevada de Saberes Medicinales',
    subtitle: 'Bancales accesibles y diálogo de saberes ancestrales',
    guideName: 'Don Segundo Morales',
    guideRole: 'Conocedor de plantas medicinales y agricultura limpia',
    territoryTag: 'Saberes Ancestrales · Tramo 115 m',
    boardwalkPoint: { x: -4, z: 10 },
    lookAt: { x: 1.5, y: 3.3, z: 7.5 },
    waterProximity: 0.3,
    storyParagraphs: [
      'Aquí cultivamos plantas que nuestras abuelas usaban para aliviar el cansancio, el frío y las preocupaciones: hierba luisa, romero, ruda y hojas aromáticas del monte.',
      'Diseñamos estos bancales elevados para demostrar cómo un jardín comunitario puede adaptarse en la vida real: a 80 centímetros de altura, una persona usuaria de silla de ruedas o alguien que no puede agacharse toca y huele cada planta con comodidad.'
    ],
    culturalNote:
      'El encuentro intercultural une el conocimiento botánico tradicional con prácticas agroecológicas actuales, reconociendo a los mayores de la comunidad como portadores de ciencia viva.',
    accessibilityHighlight:
      'Bancales elevados libres de obstáculos inferiores, contraste claro entre sendero y vegetación, y lectura en voz alta para evitar fatiga visual.',
    highlights: [
      { label: 'Hierba Luisa y Romero', detail: 'Usos tradicionales para descanso y alivio respiratorio' },
      { label: 'Bancal adaptado', detail: 'Altura ergonómica accesible a 80 cm del suelo' }
    ]
  },
  {
    id: 'cascada',
    number: 4,
    shortTitle: 'Cascada Viva',
    title: 'Quebrada y Cascada del Agua Viva',
    subtitle: 'Inmersión sonora y cuidado comunitario de vertientes',
    guideName: 'María Quintero',
    guideRole: 'Joven guardiana de vertientes y guía de turismo rural',
    territoryTag: 'Zona Hídrica · Tramo 165 m',
    boardwalkPoint: { x: 16, z: -9 },
    lookAt: { x: 25.5, y: 5.0, z: -18.5 },
    waterProximity: 1.0,
    storyParagraphs: [
      'Escucha el golpe constante del agua sobre la piedra. Esta vertiente abastece a treinta familias río abajo, por eso toda la comunidad organiza mingas para proteger los árboles que nacen en la orilla.',
      'Este puente amplio con barandas seguras permite detenerse frente a la cascada, escuchar el paisaje sonoro del bosque y sentir calma incluso desde una habitación en la ciudad.'
    ],
    culturalNote:
      'Para muchas comunidades rurales y pueblos originarios, el agua es un bien común sagrado y no una mercancía; protegerla garantiza la vida de las próximas generaciones.',
    accessibilityHighlight:
      'Audio espacial adaptativo (el sonido del agua crece al acercarse al puente y puede regularse o silenciarse al instante) con opción de reducir movimiento.',
    highlights: [
      { label: 'Audio adaptativo', detail: 'Sonido natural de cascada regulable según cercanía' },
      { label: 'Puente nivelado', detail: 'Cruce ancho con barandas protectoras continuas' }
    ]
  },
  {
    id: 'mirador_aves',
    number: 5,
    shortTitle: 'Pérgola de Aves',
    title: 'Mirador de Aves y Descanso Accesible',
    subtitle: 'Pausa contemplativa y avistamiento de fauna silvestre',
    guideName: 'Lucía Andrade',
    guideRole: 'Intérprete ambiental e investigadora comunitaria',
    territoryTag: 'Avistamiento · Tramo 215 m',
    boardwalkPoint: { x: 40, z: 7 },
    lookAt: { x: 47.5, y: 4.8, z: 5.5 },
    waterProximity: 0.35,
    storyParagraphs: [
      'En los recorridos largos, las zonas de descanso no son un lujo: son una necesidad básica para adultos mayores y personas con fatiga crónica.',
      'Esta pérgola sombreada ofrece bancas con espacio contiguo para silla de ruedas y permite observar colibríes y aves del bosque de niebla entre árboles floridos sin apuros ni aglomeraciones.'
    ],
    culturalNote:
      'El avistamiento responsable reemplaza la extracción de fauna por el orgullo comunitario de cuidar polinizadores esenciales para los cultivos locales.',
    accessibilityHighlight:
      'Refugio intermedio de descanso con techo protector, botones grandes de pausa y cantos suaves de aves sin estímulos estridentes.',
    highlights: [
      { label: 'Descanso universal', detail: 'Banca accesible con bahía libre para silla de ruedas' },
      { label: 'Fauna del bosque', detail: 'Aves en vuelo suave junto a árboles nativos en flor' }
    ]
  },
  {
    id: 'ramada',
    number: 6,
    shortTitle: 'Ramada Comunitaria',
    title: 'Ramada de Oficios y Economía Solidaria',
    subtitle: 'Artesanías locales, intercambio justo y cierre del recorrido',
    guideName: 'Taller Textil Sumak',
    guideRole: 'Asociación de mujeres artesanas y productoras locales',
    territoryTag: 'Cierre · Tramo 250 m',
    boardwalkPoint: { x: 60, z: 29 },
    lookAt: { x: 63.5, y: 4.0, z: 30.5 },
    waterProximity: 0.15,
    storyParagraphs: [
      'Llegamos al cierre del sendero en la ramada comunitaria. Aquí las familias comparten textiles teñidos con cortezas del bosque, café cosechado bajo sombra y relatos tejidos en cada figura geométrica.',
      'El ecoturismo accesible también abre oportunidades económicas reales: cuando una ruta se vuelve inclusiva para adultos mayores y personas con movilidad reducida, más visitantes conocen y apoyan directamente el trabajo local.'
    ],
    culturalNote:
      'Cada tejido narra caminos, montañas y ríos. Visibilizar estos oficios desde la dignidad fomenta un intercambio justo sin intermediarios ni estereotipos folclóricos.',
    accessibilityHighlight:
      'Entrada plana sin escalones desde la pasarela, iluminación cálida sin deslumbramiento, alto contraste y reinicio rápido del recorrido.',
    highlights: [
      { label: 'Tejido ancestral', detail: 'Textiles locales con motivos de montaña y agua' },
      { label: 'Economía solidaria', detail: 'Beneficio directo para 18 familias anfitrionas' }
    ]
  }
];
