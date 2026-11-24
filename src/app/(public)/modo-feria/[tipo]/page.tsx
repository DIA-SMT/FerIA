import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VistaSelloPropio } from "@/components/public/vista-sello-propio";
import { propuestasPublicadas } from "@/lib/consultas-sello-propio";
import { TIPOS_SELLO_PROPIO, tipoDesdeSegmento } from "@/lib/sello-propio";

type Parametros = { params: Promise<{ tipo: string }> };

export async function generateMetadata({
  params,
}: Parametros): Promise<Metadata> {
  const tipo = tipoDesdeSegmento((await params).tipo);
  if (!tipo) return {};
  const { titulo, bajada } = TIPOS_SELLO_PROPIO[tipo];
  return {
    title: `${titulo} — Modo Feria`,
    description: `${bajada} Consultá directo por WhatsApp.`,
  };
}

/** «Regalos con sello propio» y «Servicios con sello propio». */
export default async function PaginaTipoModoFeria({ params }: Parametros) {
  const tipo = tipoDesdeSegmento((await params).tipo);
  if (!tipo) notFound();

  const propuestas = await propuestasPublicadas(tipo);

  return <VistaSelloPropio tipo={tipo} propuestas={propuestas} />;
}
