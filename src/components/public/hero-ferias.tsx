import Image from "next/image";
import Link from "next/link";

import { BuscadorHero } from "@/components/public/buscador-hero";
import { hayPedidos } from "@/lib/marketplace";
import estilos from "./hero-ferias.module.css";

const carpeta = "/hero-ferias";

const informacion = [
  ["ubicacion", "Ferias barriales en toda la ciudad"],
  ["personas", "Productores y emprendedores locales"],
  ["hoja", "Productos con identidad tucumana"],
] as const;

export function HeroFerias() {
  const accesos = [
    ["ubicacion", "Dónde quedan", "/ferias"],
    ["personas", hayPedidos() ? "Tienda" : "Emprendedores", "/stands"],
    ["tienda", "Cómo participar", "/registro"],
  ] as const;

  return (
    <div className={estilos.marco}>
      <section className={estilos.hero} aria-labelledby="titulo-ferias">
        <div className={estilos.fondo} aria-hidden="true">
          <Image
            src={`${carpeta}/feria-panorama.webp`}
            alt=""
            fill
            priority
            quality={90}
            sizes="(max-width: 719px) max(100vw, 600px), (max-width: 1720px) 100vw, 1720px"
          />
        </div>
        <Image
          className={estilos.migue}
          src={`${carpeta}/migue-apoyado.webp`}
          alt=""
          width={492}
          height={1113}
          quality={90}
          sizes="(max-width: 719px) 24vw, (max-width: 1099px) 20vw, (max-width: 1720px) 17vw, 290px"
        />
        <div className={estilos.centro}>
          <div className={estilos.panel}>
            <h1 id="titulo-ferias">
              <span className={estilos.titulo}>
                Ferias de la ciudad
                <Image src={`${carpeta}/rayos-amarillos.svg`} width={34} height={34} alt="" />
              </span>{" "}
              <span className={estilos.ciudad}>de San Miguel de Tucumán</span>
            </h1>
            <p>Descubrí productos, productores y ferias barriales.</p>
          </div>
          <BuscadorHero />
          <nav aria-label="Accesos rápidos">
            {accesos.map(([icono, nombre, destino]) => (
              <Link key={icono} href={destino}>
                <Image src={`${carpeta}/${icono}.svg`} width={20} height={20} alt="" />
                {nombre}
              </Link>
            ))}
          </nav>
        </div>
        <aside aria-label="Sobre las ferias">
          {informacion.map(([icono, texto]) => (
            <div key={icono}>
              <Image src={`${carpeta}/${icono}.svg`} width={20} height={20} alt="" />
              {texto}
            </div>
          ))}
        </aside>
      </section>
    </div>
  );
}
