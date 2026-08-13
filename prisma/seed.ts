/**
 * Datos de ejemplo — Ferias Municipales de San Miguel de Tucumán.
 *
 * Se ejecuta con `npm run db:seed`. Borra todo lo existente y vuelve a cargar
 * un escenario realista: cinco ferias en puntos reales de la ciudad, con
 * ediciones pasadas, en curso y próximas, feriantes en distintos estados de
 * aprobación, catálogos y pagos de canon (algunos al día, otros vencidos).
 *
 * El script es autocontenido a propósito (no importa nada de `src/`): así
 * corre bajo `tsx` sin depender de los alias de rutas de TypeScript.
 */

import {
  CategoriaFeria,
  EstadoEdicion,
  EstadoPago,
  EstadoVendedor,
  MedioPago,
  PrismaClient,
  Rol,
  Rubro,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Completá el archivo .env antes de correr el seed.`,
    );
  }
  return valor;
}

/**
 * Cliente con la service role key: crea los usuarios en `auth.users`, les
 * asigna el rol en `app_metadata` y prepara los buckets de Storage.
 */
const supabase = createClient(
  requerido("NEXT_PUBLIC_SUPABASE_URL"),
  requerido("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// --------------------------------------------------------------------------
// Credenciales de ejemplo (documentadas en el README)
// --------------------------------------------------------------------------
const PASSWORD_ADMIN = "Ferias.2026";
const PASSWORD_FERIANTE = "Feriante.2026";

// --------------------------------------------------------------------------
// Utilidades
// --------------------------------------------------------------------------

/** Fecha a medianoche UTC desplazada N días respecto de hoy (columnas `DATE`). */
function dia(offset: number): Date {
  const hoy = new Date();
  const base = Date.UTC(
    hoy.getUTCFullYear(),
    hoy.getUTCMonth(),
    hoy.getUTCDate(),
  );
  return new Date(base + offset * 24 * 60 * 60 * 1000);
}

/**
 * Escribe la geometría PostGIS de una feria.
 * Prisma no puede escribir columnas `Unsupported`, así que va por SQL crudo.
 * Las funciones van calificadas porque en Supabase PostGIS vive en `extensions`.
 */
async function guardarUbicacion(
  feriaId: string,
  latitud: number,
  longitud: number,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ferias"
    SET "ubicacion" = extensions.ST_SetSRID(
          extensions.ST_MakePoint(${longitud}::double precision, ${latitud}::double precision),
          4326
        ),
        "latitud"   = ${latitud}::double precision,
        "longitud"  = ${longitud}::double precision
    WHERE "id" = ${feriaId}
  `;
}

/** Crea los buckets de Storage si todavía no existen. */
async function asegurarBuckets(): Promise<void> {
  const buckets = [
    { nombre: "ferias", publico: true },
    { nombre: "vendedores", publico: true },
    { nombre: "productos", publico: true },
    // Los comprobantes de canon son documentación administrativa: se sirven
    // con URL firmada a través de /api/comprobantes.
    { nombre: "comprobantes", publico: false },
  ];

  for (const bucket of buckets) {
    const { error } = await supabase.storage.createBucket(bucket.nombre, {
      public: bucket.publico,
      fileSizeLimit: 5 * 1024 * 1024,
    });

    // "already exists" es el caso normal al re-ejecutar el seed.
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(
        `No se pudo crear el bucket "${bucket.nombre}": ${error.message}`,
      );
    }
  }
}

/**
 * Crea un usuario en Supabase Auth, borrando antes el que existiera con ese
 * correo (para que el seed sea reejecutable). Devuelve el UUID.
 */
async function crearUsuarioAuth(
  email: string,
  password: string,
  nombre: string,
  rol: Rol,
): Promise<string> {
  const { data: existentes } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const previo = existentes?.users.find((usuario) => usuario.email === email);
  if (previo) await supabase.auth.admin.deleteUser(previo.id);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    // Sin confirmación por correo: la verificación real la hace la Dirección
    // de Ferias al aprobar la solicitud, y así el seed no depende de un SMTP.
    email_confirm: true,
    // `app_metadata` sólo se puede escribir con la service role key, así que
    // el rol viaja seguro en el JWT y el middleware puede leerlo en el Edge.
    app_metadata: { rol },
    user_metadata: { nombre },
  });

  if (error || !data.user) {
    throw new Error(
      `No se pudo crear el usuario ${email}: ${error?.message ?? "sin detalle"}`,
    );
  }

  return data.user.id;
}

// --------------------------------------------------------------------------
// Definición de los datos
// --------------------------------------------------------------------------

interface DatosEdicion {
  nombre?: string;
  inicio: number;
  fin: number;
  horario: string;
  estado: EstadoEdicion;
  cantidadStands: number;
  montoCanon: number;
  vencimiento?: number;
}

interface DatosFeria {
  nombre: string;
  slug: string;
  descripcion: string;
  categoria: CategoriaFeria;
  direccion: string;
  latitud: number;
  longitud: number;
  ediciones: DatosEdicion[];
}

const FERIAS: DatosFeria[] = [
  {
    nombre: "Feria de Artesanos — Parque 9 de Julio",
    slug: "feria-de-artesanos-parque-9-de-julio",
    descripcion:
      "La feria más tradicional de la ciudad, en el corazón del Parque 9 de Julio. Artesanos y artesanas de toda la provincia exponen telares, cerámica, platería, tallado en madera y trabajos en cuero. Un paseo al aire libre entre los lapachos, ideal para recorrer en familia los fines de semana.",
    categoria: CategoriaFeria.ARTESANIAS,
    direccion: "Parque 9 de Julio, Av. Benjamín Aráoz y Av. Soldati",
    latitud: -26.8285,
    longitud: -65.1888,
    ediciones: [
      {
        nombre: "Edición de Invierno",
        inicio: -60,
        fin: -58,
        horario: "Viernes a domingo de 16 a 21 h",
        estado: EstadoEdicion.FINALIZADA,
        cantidadStands: 24,
        montoCanon: 12000,
        vencimiento: -65,
      },
      {
        nombre: "Edición Agosto",
        inicio: -1,
        fin: 2,
        horario: "Jueves a domingo de 17 a 22 h",
        estado: EstadoEdicion.EN_CURSO,
        cantidadStands: 28,
        montoCanon: 15000,
        vencimiento: -6,
      },
      {
        nombre: "Edición Primavera",
        inicio: 25,
        fin: 27,
        horario: "Viernes a domingo de 17 a 22 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 28,
        montoCanon: 15000,
        vencimiento: 18,
      },
    ],
  },
  {
    nombre: "Paseo de Emprendedores — Plaza Urquiza",
    slug: "paseo-de-emprendedores-plaza-urquiza",
    descripcion:
      "Emprendimientos jóvenes de San Miguel de Tucumán se dan cita en Plaza Urquiza: indumentaria de autor, bijouterie, cosmética natural, decoración y objetos de diseño. Una vidriera para quienes están dando sus primeros pasos con su marca.",
    categoria: CategoriaFeria.EMPRENDEDORES,
    direccion: "Plaza Urquiza, Av. Sarmiento y Congreso",
    latitud: -26.8267,
    longitud: -65.2076,
    ediciones: [
      {
        nombre: "Edición Agosto",
        inicio: 0,
        fin: 1,
        horario: "Sábados y domingos de 10 a 20 h",
        estado: EstadoEdicion.EN_CURSO,
        cantidadStands: 20,
        montoCanon: 10000,
        vencimiento: -4,
      },
      {
        nombre: "Edición Septiembre",
        inicio: 14,
        fin: 15,
        horario: "Sábados y domingos de 10 a 20 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 20,
        montoCanon: 10000,
        vencimiento: 7,
      },
    ],
  },
  {
    nombre: "Feria Gastronómica — Parque Avellaneda",
    slug: "feria-gastronomica-parque-avellaneda",
    descripcion:
      "Cocina tucumana en el Parque Avellaneda: empanadas al horno de barro, locro, tamales, humita en chala y los dulces regionales de siempre. Con mesas comunitarias, música en vivo y espacio para las infancias.",
    categoria: CategoriaFeria.GASTRONOMIA,
    direccion: "Parque Avellaneda, Av. Néstor Kirchner y Juan B. Justo",
    latitud: -26.8525,
    longitud: -65.2192,
    ediciones: [
      {
        nombre: "Edición Sabores del Norte",
        inicio: 9,
        fin: 11,
        horario: "Viernes de 18 a 24 h, sábados y domingos de 12 a 24 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 16,
        montoCanon: 20000,
        vencimiento: 4,
      },
      {
        nombre: "Edición Fin de Año",
        inicio: 60,
        fin: 62,
        horario: "A confirmar",
        estado: EstadoEdicion.BORRADOR,
        cantidadStands: 16,
        montoCanon: 0,
      },
    ],
  },
  {
    nombre: "Feria del Libro y las Artes — Plaza Independencia",
    slug: "feria-del-libro-y-las-artes-plaza-independencia",
    descripcion:
      "Editoriales independientes, librerías de usados, ilustradores y talleres de arte se instalan en la plaza principal de la ciudad. Con lecturas, presentaciones y actividades para escuelas durante toda la semana.",
    categoria: CategoriaFeria.LIBROS_Y_ARTE,
    direccion: "Plaza Independencia, 25 de Mayo y San Martín",
    latitud: -26.8354,
    longitud: -65.2038,
    ediciones: [
      {
        nombre: "Edición Aniversario",
        inicio: 40,
        fin: 44,
        horario: "Todos los días de 10 a 21 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 18,
        montoCanon: 8000,
        vencimiento: 33,
      },
    ],
  },
  {
    nombre: "Feria Regional del Norte — Plaza Alberdi",
    slug: "feria-regional-del-norte-plaza-alberdi",
    descripcion:
      "Productores de los valles y del pedemonte tucumano acercan a la ciudad dulces artesanales, quesos, conservas, miel, nueces y plantas nativas. Venta directa del productor al vecino.",
    categoria: CategoriaFeria.PRODUCTOS_REGIONALES,
    direccion: "Plaza Alberdi, Av. Sáenz Peña y Corrientes",
    latitud: -26.8305,
    longitud: -65.1992,
    ediciones: [
      {
        nombre: "Edición Julio",
        inicio: -30,
        fin: -28,
        horario: "Viernes a domingo de 9 a 18 h",
        estado: EstadoEdicion.FINALIZADA,
        cantidadStands: 14,
        montoCanon: 11000,
        vencimiento: -35,
      },
    ],
  },
];

interface DatosProducto {
  nombre: string;
  descripcion: string;
  precio: number;
  disponible?: boolean;
  destacado?: boolean;
}

interface DatosVendedor {
  nombre: string;
  email: string;
  emprendimiento: string;
  slug: string;
  rubro: Rubro;
  descripcion: string;
  whatsapp: string;
  telefono?: string;
  instagram?: string;
  facebook?: string;
  sitioWeb?: string;
  estado: EstadoVendedor;
  motivoRechazo?: string;
  productos: DatosProducto[];
}

const VENDEDORES: DatosVendedor[] = [
  {
    nombre: "María Elena Quiroga",
    email: "tejidosdelcerro@example.com",
    emprendimiento: "Tejidos del Cerro",
    slug: "tejidos-del-cerro",
    rubro: Rubro.ARTESANIAS,
    descripcion:
      "Telar criollo y a dos agujas con lana de oveja hilada a mano. Trabajamos con vellón teñido con tintes naturales de nogal, cebolla y cochinilla. Cada pieza es única y lleva entre dos y tres semanas de trabajo.",
    whatsapp: "5493815551201",
    telefono: "381 455-1201",
    instagram: "tejidosdelcerro",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Poncho de lana de oveja",
        descripcion:
          "Tejido en telar criollo con lana hilada a mano, teñida con nogal. Talle único.",
        precio: 145000,
        destacado: true,
      },
      {
        nombre: "Ruana tejida a dos agujas",
        descripcion: "Lana natural sin teñir, con fleco trenzado a mano.",
        precio: 98000,
      },
      {
        nombre: "Bufanda de telar",
        descripcion: "Diseño en franjas, disponible en varias combinaciones.",
        precio: 32000,
      },
      {
        nombre: "Almohadón de lana",
        descripcion: "Funda tejida en telar con relleno de vellón. 40 x 40 cm.",
        precio: 28000,
      },
    ],
  },
  {
    nombre: "Julio César Paz",
    email: "alfarerialacienaga@example.com",
    emprendimiento: "Alfarería La Ciénaga",
    slug: "alfareria-la-cienaga",
    rubro: Rubro.ARTESANIAS,
    descripcion:
      "Cerámica utilitaria y decorativa cocida a leña, con motivos inspirados en la iconografía de los pueblos originarios del noroeste. Todas las piezas son aptas para uso alimentario.",
    whatsapp: "5493815551202",
    instagram: "alfareria.lacienaga",
    facebook: "alfarerialacienaga",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Juego de mates de cerámica",
        descripcion: "Set de dos mates con bombilla de alpaca. Motivos calchaquíes.",
        precio: 46000,
        destacado: true,
      },
      {
        nombre: "Fuente de barro cocido",
        descripcion: "Apta para horno. 32 cm de diámetro.",
        precio: 38000,
      },
      {
        nombre: "Vasija decorativa grande",
        descripcion: "Pieza única, engobe rojo bruñido a piedra. 45 cm de alto.",
        precio: 120000,
      },
    ],
  },
  {
    nombre: "Rosa Beatriz Medina",
    email: "empanadasdoniarosa@example.com",
    emprendimiento: "Empanadas Doña Rosa",
    slug: "empanadas-donia-rosa",
    rubro: Rubro.GASTRONOMIA,
    descripcion:
      "Empanadas tucumanas de horno de barro, con la receta de la abuela: carne cortada a cuchillo, mucha cebolla de verdeo y comino. Hacemos también tamales y humita en chala por encargo.",
    whatsapp: "5493815551203",
    telefono: "381 421-3344",
    instagram: "empanadasdoniarosa",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Docena de empanadas de carne",
        descripcion: "Cortadas a cuchillo, al horno de barro. Se venden por docena.",
        precio: 18000,
        destacado: true,
      },
      {
        nombre: "Docena de empanadas de pollo",
        descripcion: "Con cebolla de verdeo y huevo.",
        precio: 17000,
      },
      {
        nombre: "Tamales (unidad)",
        descripcion: "Con carne de cerdo y maíz pelado. Mínimo media docena.",
        precio: 2200,
      },
      {
        nombre: "Humita en chala (unidad)",
        descripcion: "Choclo rallado, queso y albahaca.",
        precio: 2000,
      },
    ],
  },
  {
    nombre: "Ana Lucía Sosa",
    email: "dulcesdelvalle@example.com",
    emprendimiento: "Dulces del Valle",
    slug: "dulces-del-valle",
    rubro: Rubro.PRODUCTOS_REGIONALES,
    descripcion:
      "Dulces artesanales de los Valles Calchaquíes elaborados con fruta de estación: cayote, higo, membrillo y tuna. Producción propia, sin conservantes ni colorantes.",
    whatsapp: "5493815551204",
    instagram: "dulcesdelvalle.tuc",
    sitioWeb: "https://dulcesdelvalle.example.com",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Dulce de cayote (500 g)",
        descripcion: "Con nueces de la zona. Frasco de vidrio.",
        precio: 9500,
        destacado: true,
      },
      {
        nombre: "Dulce de higo (500 g)",
        descripcion: "Higos enteros en almíbar liviano.",
        precio: 9800,
      },
      {
        nombre: "Alfajores de dulce de cayote (caja x 6)",
        descripcion: "Masa de maicena con coco rallado.",
        precio: 12000,
      },
      {
        nombre: "Miel de monte (1 kg)",
        descripcion: "Cosecha de primavera del pedemonte tucumano.",
        precio: 15000,
      },
    ],
  },
  {
    nombre: "Ramón Alberto Juárez",
    email: "cueroymonte@example.com",
    emprendimiento: "Cuero y Monte",
    slug: "cuero-y-monte",
    rubro: Rubro.MARROQUINERIA,
    descripcion:
      "Marroquinería en cuero vacuno curtido al vegetal, cosida a mano con hilo encerado. Trabajamos a medida: cintos, carteras, mochilas y fundas de cuchillo.",
    whatsapp: "5493815551205",
    telefono: "381 466-8899",
    instagram: "cueroymonte",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Cinto de cuero repujado",
        descripcion: "Curtido vegetal, hebilla de alpaca. Todos los talles.",
        precio: 42000,
        destacado: true,
      },
      {
        nombre: "Cartera de mano",
        descripcion: "Cuero natural cosido a mano, forro de tela criolla.",
        precio: 135000,
      },
      {
        nombre: "Funda de cuchillo",
        descripcion: "A medida, con repujado personalizado.",
        precio: 35000,
      },
    ],
  },
  {
    nombre: "Carolina Ferreyra",
    email: "yerbabuenanatural@example.com",
    emprendimiento: "Yerbabuena Natural",
    slug: "yerbabuena-natural",
    rubro: Rubro.COSMETICA_NATURAL,
    descripcion:
      "Cosmética natural elaborada en Yerba Buena con aceites vegetales prensados en frío y hierbas del pedemonte. Sin parabenos, sin testeo en animales y con envases retornables.",
    whatsapp: "5493815551206",
    instagram: "yerbabuenanatural",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Jabón de caléndula y avena",
        descripcion: "Para pieles sensibles. Saponificado en frío. 100 g.",
        precio: 6500,
        destacado: true,
      },
      {
        nombre: "Crema de karité y lavanda",
        descripcion: "Hidratación intensa para manos y cuerpo. 200 ml.",
        precio: 16500,
      },
      {
        nombre: "Aceite de romero para el cabello",
        descripcion: "Macerado en frío durante 40 días. 100 ml.",
        precio: 13000,
      },
      {
        nombre: "Bálsamo labial de cera de abeja",
        descripcion: "Con manteca de cacao y vitamina E.",
        precio: 4800,
        disponible: false,
      },
    ],
  },
  {
    nombre: "Sebastián Ruiz",
    email: "platadelnorte@example.com",
    emprendimiento: "Plata del Norte",
    slug: "plata-del-norte",
    rubro: Rubro.JOYERIA_Y_BIJOUTERIE,
    descripcion:
      "Orfebrería en plata 925 y alpaca con piedras de la región: rodocrosita, ónix y turquesa. Diseños contemporáneos con guiños a la iconografía andina. Hacemos alianzas y piezas a pedido.",
    whatsapp: "5493815551207",
    instagram: "platadelnorte.joyas",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Anillo de plata con rodocrosita",
        descripcion: "Plata 925 con piedra nacional engarzada a mano.",
        precio: 78000,
        destacado: true,
      },
      {
        nombre: "Aros de alpaca martillada",
        descripcion: "Livianos, terminación mate.",
        precio: 24000,
      },
      {
        nombre: "Colgante calchaquí",
        descripcion: "Plata 925 con motivo grabado a buril.",
        precio: 62000,
      },
    ],
  },
  {
    nombre: "Gustavo Nieva",
    email: "maderanativa@example.com",
    emprendimiento: "Madera Nativa",
    slug: "madera-nativa",
    rubro: Rubro.DECORACION,
    descripcion:
      "Objetos de decoración en madera de algarrobo, cedro y palo santo, con madera de recuperación y poda urbana. Terminaciones con aceite de lino, sin barnices sintéticos.",
    whatsapp: "5493815551208",
    instagram: "maderanativa.tuc",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Tabla de algarrobo",
        descripcion: "Para asado o picada. 45 x 30 cm, con canaleta.",
        precio: 52000,
        destacado: true,
      },
      {
        nombre: "Bandeja de cedro",
        descripcion: "Con manijas de cuero. 40 x 25 cm.",
        precio: 44000,
      },
      {
        nombre: "Portavelas de palo santo",
        descripcion: "Juego de tres alturas.",
        precio: 21000,
      },
    ],
  },
  {
    nombre: "Miguel Ángel Coronel",
    email: "saboresdeltucuman@example.com",
    emprendimiento: "Sabores del Tucumán",
    slug: "sabores-del-tucuman",
    rubro: Rubro.GASTRONOMIA,
    descripcion:
      "Comida regional para llevar: locro, guiso de mondongo, tamales y pastelitos de dulce de membrillo. Elaboración diaria con habilitación bromatológica municipal.",
    whatsapp: "5493815551209",
    telefono: "381 430-7712",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Locro tucumano (porción)",
        descripcion: "Con maíz blanco, panceta, chorizo colorado y quiaquiño.",
        precio: 11000,
        destacado: true,
      },
      {
        nombre: "Pastelitos de membrillo (docena)",
        descripcion: "Fritos en el momento, con azúcar y grana.",
        precio: 9000,
      },
      {
        nombre: "Guiso de mondongo (porción)",
        descripcion: "Receta casera, con porotos y verduras de estación.",
        precio: 10500,
      },
    ],
  },
  {
    nombre: "Silvina Gómez",
    email: "viverolslapachos@example.com",
    emprendimiento: "Vivero Los Lapachos",
    slug: "vivero-los-lapachos",
    rubro: Rubro.HUERTA_Y_VIVERO,
    descripcion:
      "Plantines de especies nativas del pedemonte tucumano, aromáticas y hortalizas de estación. Asesoramos sobre huerta agroecológica en balcones y patios.",
    whatsapp: "5493815551210",
    instagram: "viverolslapachos",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Plantín de lapacho rosado",
        descripcion: "Especie nativa. Altura 40 cm, en maceta de 2 litros.",
        precio: 8500,
        destacado: true,
      },
      {
        nombre: "Kit de aromáticas",
        descripcion: "Albahaca, romero, tomillo y menta en macetas de 12 cm.",
        precio: 14000,
      },
      {
        nombre: "Compost orgánico (5 kg)",
        descripcion: "Elaborado con residuos de poda y verdulería.",
        precio: 6000,
      },
    ],
  },
  {
    nombre: "Federico Albornoz",
    email: "librosdeljardin@example.com",
    emprendimiento: "Libros del Jardín",
    slug: "libros-del-jardin",
    rubro: Rubro.LIBROS_Y_ARTE,
    descripcion:
      "Librería independiente especializada en autores del NOA, poesía y libro álbum infantil. También conseguimos títulos por encargo.",
    whatsapp: "5493815551211",
    instagram: "librosdeljardin",
    estado: EstadoVendedor.APROBADO,
    productos: [
      {
        nombre: "Antología de poesía tucumana",
        descripcion: "Edición independiente, tapa blanda, 180 páginas.",
        precio: 22000,
        destacado: true,
      },
      {
        nombre: "Libro álbum infantil ilustrado",
        descripcion: "Historias del monte para primeros lectores.",
        precio: 18500,
      },
    ],
  },
  {
    nombre: "Lorena Villagra",
    email: "telarandino@example.com",
    emprendimiento: "Telar Andino",
    slug: "telar-andino",
    rubro: Rubro.INDUMENTARIA,
    descripcion:
      "Indumentaria de autor confeccionada con telas tejidas en telar y algodón orgánico. Producción de temporada corta y talles amplios.",
    whatsapp: "5493815551212",
    instagram: "telarandino.ok",
    estado: EstadoVendedor.PENDIENTE,
    productos: [],
  },
  {
    nombre: "Diego Sánchez",
    email: "juguetesdepalosanto@example.com",
    emprendimiento: "Juguetes de Palo Santo",
    slug: "juguetes-de-palo-santo",
    rubro: Rubro.JUGUETES,
    descripcion:
      "Juguetes de madera para primera infancia: encastres, rompecabezas y móviles, con maderas nativas de manejo sustentable y pinturas al agua.",
    whatsapp: "5493815551213",
    estado: EstadoVendedor.PENDIENTE,
    productos: [],
  },
  {
    nombre: "Hernán Ledesma",
    email: "importadoslh@example.com",
    emprendimiento: "Importados LH",
    slug: "importados-lh",
    rubro: Rubro.OTROS,
    descripcion: "Venta de artículos de bazar y electrónica importada.",
    whatsapp: "5493815551214",
    estado: EstadoVendedor.RECHAZADO,
    motivoRechazo:
      "Las ferias municipales están destinadas a la producción artesanal y a emprendimientos locales. La reventa de artículos importados no cumple con el reglamento vigente (Ord. 4.812, art. 5).",
    productos: [],
  },
];

/**
 * Asignaciones de stands: para cada edición, qué feriantes participan.
 * Se identifican por slug para que el seed se lea sin tener que mirar IDs.
 */
const ASIGNACIONES: Record<string, string[]> = {
  // Artesanos — Edición de Invierno (finalizada)
  "feria-de-artesanos-parque-9-de-julio::Edición de Invierno": [
    "tejidos-del-cerro",
    "alfareria-la-cienaga",
    "cuero-y-monte",
    "plata-del-norte",
    "madera-nativa",
  ],
  // Artesanos — Edición Agosto (en curso)
  "feria-de-artesanos-parque-9-de-julio::Edición Agosto": [
    "tejidos-del-cerro",
    "alfareria-la-cienaga",
    "cuero-y-monte",
    "plata-del-norte",
    "madera-nativa",
    "yerbabuena-natural",
  ],
  // Artesanos — Edición Primavera (publicada)
  "feria-de-artesanos-parque-9-de-julio::Edición Primavera": [
    "tejidos-del-cerro",
    "alfareria-la-cienaga",
    "plata-del-norte",
  ],
  // Emprendedores — Edición Agosto (en curso)
  "paseo-de-emprendedores-plaza-urquiza::Edición Agosto": [
    "yerbabuena-natural",
    "plata-del-norte",
    "madera-nativa",
    "libros-del-jardin",
  ],
  // Emprendedores — Edición Septiembre (publicada)
  "paseo-de-emprendedores-plaza-urquiza::Edición Septiembre": [
    "yerbabuena-natural",
    "madera-nativa",
  ],
  // Gastronómica — Sabores del Norte (publicada)
  "feria-gastronomica-parque-avellaneda::Edición Sabores del Norte": [
    "empanadas-donia-rosa",
    "sabores-del-tucuman",
    "dulces-del-valle",
  ],
  // Libro y las Artes — Aniversario (publicada)
  "feria-del-libro-y-las-artes-plaza-independencia::Edición Aniversario": [
    "libros-del-jardin",
    "madera-nativa",
  ],
  // Regional del Norte — Julio (finalizada)
  "feria-regional-del-norte-plaza-alberdi::Edición Julio": [
    "dulces-del-valle",
    "vivero-los-lapachos",
    "sabores-del-tucuman",
  ],
};

/**
 * Estado del canon de cada feriante por edición.
 * `pagado` deja el pago saldado; `pendiente` lo deja impago (si la edición ya
 * venció, la plataforma lo muestra como moroso).
 */
const CANON_IMPAGO = new Set([
  // Dos morosos en la edición en curso de Artesanos (vencimiento pasado).
  "feria-de-artesanos-parque-9-de-julio::Edición Agosto::madera-nativa",
  "feria-de-artesanos-parque-9-de-julio::Edición Agosto::yerbabuena-natural",
  // Uno moroso en Emprendedores en curso.
  "paseo-de-emprendedores-plaza-urquiza::Edición Agosto::libros-del-jardin",
  // Pendientes de ediciones futuras (todavía dentro del plazo).
  "feria-de-artesanos-parque-9-de-julio::Edición Primavera::tejidos-del-cerro",
  "feria-de-artesanos-parque-9-de-julio::Edición Primavera::alfareria-la-cienaga",
  "feria-de-artesanos-parque-9-de-julio::Edición Primavera::plata-del-norte",
  "paseo-de-emprendedores-plaza-urquiza::Edición Septiembre::yerbabuena-natural",
  "paseo-de-emprendedores-plaza-urquiza::Edición Septiembre::madera-nativa",
  "feria-gastronomica-parque-avellaneda::Edición Sabores del Norte::dulces-del-valle",
  "feria-del-libro-y-las-artes-plaza-independencia::Edición Aniversario::libros-del-jardin",
  "feria-del-libro-y-las-artes-plaza-independencia::Edición Aniversario::madera-nativa",
]);

const MEDIOS: MedioPago[] = [
  MedioPago.TRANSFERENCIA,
  MedioPago.EFECTIVO,
  MedioPago.TARJETA_DEBITO,
  MedioPago.TRANSFERENCIA,
  MedioPago.EFECTIVO,
];

// --------------------------------------------------------------------------
// Ejecución
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("→ Preparando los buckets de Storage…");
  await asegurarBuckets();

  console.log("→ Limpiando datos existentes…");
  // El orden respeta las claves foráneas (aunque hay cascada, así es explícito).
  await prisma.pagoCanon.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.stand.deleteMany();
  await prisma.edicionFeria.deleteMany();
  await prisma.feria.deleteMany();
  await prisma.vendedor.deleteMany();
  await prisma.usuario.deleteMany();

  console.log("→ Creando usuario administrador…");
  const idAdmin = await crearUsuarioAuth(
    "admin@smt.gob.ar",
    PASSWORD_ADMIN,
    "Dirección de Ferias y Mercados",
    Rol.ADMIN,
  );

  await prisma.usuario.create({
    data: {
      id: idAdmin,
      email: "admin@smt.gob.ar",
      nombre: "Dirección de Ferias y Mercados",
      rol: Rol.ADMIN,
    },
  });

  console.log("→ Creando ferias, ediciones y stands…");
  // edicionesPorClave["slug-feria::Nombre edición"] = { id, montoCanon, vencimiento }
  const edicionesPorClave = new Map<
    string,
    { id: string; montoCanon: number; vencimiento: Date | null }
  >();

  for (const datosFeria of FERIAS) {
    const feria = await prisma.feria.create({
      data: {
        nombre: datosFeria.nombre,
        slug: datosFeria.slug,
        descripcion: datosFeria.descripcion,
        categoria: datosFeria.categoria,
        direccion: datosFeria.direccion,
        latitud: datosFeria.latitud,
        longitud: datosFeria.longitud,
        activa: true,
      },
    });

    // La geometría PostGIS se escribe aparte: Prisma no maneja `Unsupported`.
    await guardarUbicacion(feria.id, datosFeria.latitud, datosFeria.longitud);

    for (const datosEdicion of datosFeria.ediciones) {
      const vencimiento =
        datosEdicion.vencimiento === undefined
          ? null
          : dia(datosEdicion.vencimiento);

      const edicion = await prisma.edicionFeria.create({
        data: {
          feriaId: feria.id,
          nombre: datosEdicion.nombre ?? null,
          fechaInicio: dia(datosEdicion.inicio),
          fechaFin: dia(datosEdicion.fin),
          horario: datosEdicion.horario,
          estado: datosEdicion.estado,
          cantidadStands: datosEdicion.cantidadStands,
          montoCanon: datosEdicion.montoCanon,
          vencimientoCanon: vencimiento,
        },
      });

      // Grilla de stands vacíos.
      if (datosEdicion.cantidadStands > 0) {
        await prisma.stand.createMany({
          data: Array.from(
            { length: datosEdicion.cantidadStands },
            (_, indice) => ({
              edicionId: edicion.id,
              numero: indice + 1,
            }),
          ),
        });
      }

      if (datosEdicion.nombre) {
        edicionesPorClave.set(`${datosFeria.slug}::${datosEdicion.nombre}`, {
          id: edicion.id,
          montoCanon: datosEdicion.montoCanon,
          vencimiento,
        });
      }
    }
  }

  console.log("→ Creando feriantes y catálogos…");
  const vendedoresPorSlug = new Map<string, string>();

  for (const datos of VENDEDORES) {
    const idUsuario = await crearUsuarioAuth(
      datos.email,
      PASSWORD_FERIANTE,
      datos.nombre,
      Rol.VENDEDOR,
    );

    await prisma.usuario.create({
      data: {
        id: idUsuario,
        email: datos.email,
        nombre: datos.nombre,
        rol: Rol.VENDEDOR,
      },
    });

    const yaRevisado = datos.estado !== EstadoVendedor.PENDIENTE;

    const vendedor = await prisma.vendedor.create({
      data: {
        usuarioId: idUsuario,
        emprendimiento: datos.emprendimiento,
        slug: datos.slug,
        rubro: datos.rubro,
        descripcion: datos.descripcion,
        whatsapp: datos.whatsapp,
        telefono: datos.telefono ?? null,
        email: datos.email,
        instagram: datos.instagram ?? null,
        facebook: datos.facebook ?? null,
        sitioWeb: datos.sitioWeb ?? null,
        estado: datos.estado,
        motivoRechazo: datos.motivoRechazo ?? null,
        revisadoEn: yaRevisado ? dia(-40) : null,
      },
    });

    vendedoresPorSlug.set(datos.slug, vendedor.id);

    if (datos.productos.length > 0) {
      await prisma.producto.createMany({
        data: datos.productos.map((producto) => ({
          vendedorId: vendedor.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio,
          disponible: producto.disponible ?? true,
          destacado: producto.destacado ?? false,
        })),
      });
    }
  }

  console.log("→ Asignando stands y registrando canon…");
  let indiceMedio = 0;

  for (const [claveEdicion, slugs] of Object.entries(ASIGNACIONES)) {
    const edicion = edicionesPorClave.get(claveEdicion);
    if (!edicion) {
      throw new Error(`No se encontró la edición "${claveEdicion}".`);
    }

    // Stands libres de esa edición, en orden de numeración.
    const standsLibres = await prisma.stand.findMany({
      where: { edicionId: edicion.id, vendedorId: null },
      orderBy: { numero: "asc" },
    });

    for (const [indice, slug] of slugs.entries()) {
      const vendedorId = vendedoresPorSlug.get(slug);
      if (!vendedorId) throw new Error(`No se encontró el feriante "${slug}".`);

      const stand = standsLibres[indice];
      if (!stand) {
        throw new Error(
          `La edición "${claveEdicion}" no tiene stands suficientes.`,
        );
      }

      await prisma.stand.update({
        where: { id: stand.id },
        data: { vendedorId, asignadoEn: dia(-10) },
      });

      // Canon correspondiente a esa participación.
      if (edicion.montoCanon > 0) {
        const impago = CANON_IMPAGO.has(`${claveEdicion}::${slug}`);
        const medio = MEDIOS[indiceMedio % MEDIOS.length] ?? MedioPago.EFECTIVO;
        indiceMedio++;

        await prisma.pagoCanon.create({
          data: {
            vendedorId,
            edicionId: edicion.id,
            monto: edicion.montoCanon,
            estado: impago ? EstadoPago.PENDIENTE : EstadoPago.PAGADO,
            fechaPago: impago ? null : dia(-12),
            medio: impago ? null : medio,
            observaciones: impago
              ? "Pendiente de regularización."
              : `Canon abonado — ${claveEdicion.split("::")[1] ?? ""}`.trim(),
          },
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  const [ferias, ediciones, stands, ocupados, vendedores, productos, pagos] =
    await Promise.all([
      prisma.feria.count(),
      prisma.edicionFeria.count(),
      prisma.stand.count(),
      prisma.stand.count({ where: { vendedorId: { not: null } } }),
      prisma.vendedor.count(),
      prisma.producto.count(),
      prisma.pagoCanon.count(),
    ]);

  console.log(`
✔ Datos de ejemplo cargados

  Ferias        ${ferias}
  Ediciones     ${ediciones}
  Stands        ${stands} (${ocupados} ocupados, ${stands - ocupados} libres)
  Feriantes     ${vendedores}
  Productos     ${productos}
  Pagos canon   ${pagos}

  Acceso al panel municipal
    admin@smt.gob.ar / ${PASSWORD_ADMIN}

  Acceso de feriante (cualquiera de los correos de ejemplo)
    tejidosdelcerro@example.com / ${PASSWORD_FERIANTE}   (aprobado)
    telarandino@example.com     / ${PASSWORD_FERIANTE}   (pendiente de aprobación)
    importadoslh@example.com    / ${PASSWORD_FERIANTE}   (rechazado)
`);
}

main()
  .catch((error) => {
    console.error("✖ Error al cargar los datos de ejemplo:");
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
