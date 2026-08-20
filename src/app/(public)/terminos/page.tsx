import type { ReactNode } from "react";

/**
 * Términos y condiciones de uso.
 *
 * El registro es deliberadamente formal: es el texto que queda como respaldo y
 * el que revisa Legales. La versión llana de lo mismo vive donde el vecino la
 * cruza sin buscarla —el pie de todas las páginas— y enlaza acá.
 *
 * ⚠️ Este texto lo redactó el equipo de desarrollo y **tiene que pasar por el
 * área de Legales del municipio antes de publicarse**. La sección de reclamos
 * está sin canal de contacto a propósito: hay que completarla con el correo o la
 * oficina oficial en lugar de inventar uno.
 */

export const metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones de uso de la plataforma de ferias municipales de San Miguel de Tucumán: alcance del servicio, uso de inteligencia artificial, responsabilidad comercial y tratamiento de datos personales.",
};

/** Fecha de la última revisión del texto. Actualizar al editarlo. */
const ULTIMA_ACTUALIZACION = "20 de agosto de 2026";

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        {titulo}
      </h2>
      <div className="mt-3 space-y-3 text-slate-700">{children}</div>
    </section>
  );
}

export default function PaginaTerminos() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="text-xs font-medium tracking-widest text-municipal-600 uppercase">
        Municipalidad de San Miguel de Tucumán
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Términos y condiciones de uso
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        Última actualización: {ULTIMA_ACTUALIZACION}
      </p>

      <Seccion titulo="1. Alcance de la plataforma">
        <p>
          Esta plataforma es un servicio de la Municipalidad de San Miguel de
          Tucumán que difunde las ferias itinerantes organizadas por el municipio
          y publica el catálogo de las personas habilitadas para participar en
          ellas.
        </p>
        <p>
          Su función es informativa y de contacto. No es una tienda en línea: no
          se realizan operaciones de compra, no se procesan pagos y no se
          gestionan envíos a través de este sitio.
        </p>
      </Seccion>

      <Seccion titulo="2. Uso de inteligencia artificial">
        <p>
          La plataforma pone a disposición de las personas feriantes
          herramientas de inteligencia artificial para preparar sus
          publicaciones. Su uso es opcional y la decisión de aplicarlas es de
          cada feriante.
        </p>
        <p>
          <strong className="font-semibold text-slate-900">
            Las fotografías de los productos pueden haber sido editadas o
            recompuestas mediante inteligencia artificial.
          </strong>{" "}
          En esos casos la imagen debe entenderse como ilustrativa: puede diferir
          del producto real en fondo, iluminación, encuadre, escenario y
          terminaciones. Antes de concretar una compra, se recomienda consultar
          al feriante por las características concretas del producto.
        </p>
        <p>
          Las descripciones de los emprendimientos pueden haber sido redactadas
          con asistencia de inteligencia artificial. En todos los casos el texto
          final es revisado y aceptado por la persona feriante, que es
          responsable de su contenido.
        </p>
        <p>
          La presencia del isologo municipal en una imagen identifica a esta
          plataforma como el medio de publicación.{" "}
          <strong className="font-semibold text-slate-900">
            No constituye certificación, control de calidad ni aval del municipio
            sobre el producto exhibido.
          </strong>
        </p>
      </Seccion>

      <Seccion titulo="3. Responsabilidad comercial">
        <p>
          Las operaciones se acuerdan y se concretan de forma directa entre la
          persona interesada y la persona feriante. La Municipalidad de San
          Miguel de Tucumán no interviene como parte, intermediaria ni garante en
          la venta, el precio, el pago, la entrega ni la posventa.
        </p>
        <p>
          El municipio no garantiza la disponibilidad, el stock, la calidad, la
          aptitud para un fin determinado ni la exactitud de las características
          publicadas de los productos.
        </p>
        <p>
          La plataforma no publica precios. Cualquier valor se acuerda
          directamente entre las partes por los canales de contacto que cada
          feriante informa.
        </p>
      </Seccion>

      <Seccion titulo="4. Contenido publicado por las personas feriantes">
        <p>
          Los nombres de emprendimiento, descripciones, fotografías, datos de
          contacto y demás contenidos de cada stand son provistos por la persona
          feriante, que declara contar con los derechos necesarios para
          publicarlos y es responsable de su veracidad, licitud y actualización.
        </p>
        <p>
          El municipio habilita la participación en las ferias y administra la
          plataforma, pero no audita cada publicación de forma previa. Puede
          editar, despublicar o dar de baja contenidos que incumplan estas
          condiciones, la normativa vigente o las reglas de las ferias
          municipales.
        </p>
      </Seccion>

      <Seccion titulo="5. Datos personales">
        <p>
          Los datos de contacto que aparecen en cada stand —teléfono, WhatsApp,
          correo electrónico y redes sociales— son informados por la propia
          persona feriante con la finalidad de recibir consultas del público.
        </p>
        <p>
          Las conversaciones iniciadas desde los botones de contacto continúan en
          servicios de terceros, ajenos a esta plataforma y sujetos a sus propias
          políticas. El municipio no accede al contenido de esas conversaciones.
        </p>
        <p>
          Los datos que el municipio recaba para la gestión de las ferias se
          tratan conforme a la normativa aplicable en materia de protección de
          datos personales. La persona titular puede solicitar el acceso, la
          rectificación o la supresión de sus datos ante la Dirección de Ferias y
          Mercados.
        </p>
      </Seccion>

      <Seccion titulo="6. Consultas y reclamos">
        <p>
          Las consultas sobre el funcionamiento de la plataforma, los reclamos
          por contenidos publicados y los pedidos vinculados a datos personales
          se reciben en la Dirección de Ferias y Mercados de la Municipalidad de
          San Miguel de Tucumán.
        </p>
        <p>
          Los reclamos por una operación concreta —producto, precio, entrega o
          posventa— deben dirigirse a la persona feriante, que es quien la
          realiza.
        </p>
      </Seccion>

      <Seccion titulo="7. Modificaciones">
        <p>
          Estas condiciones pueden actualizarse para reflejar cambios en el
          servicio o en la normativa aplicable. La fecha de la última revisión se
          indica al comienzo de esta página.
        </p>
      </Seccion>
    </div>
  );
}
