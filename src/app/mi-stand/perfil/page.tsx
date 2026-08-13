import { FormularioPerfil } from "@/components/vendedor/formulario-perfil";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Mi vidriera" };

export default async function PaginaPerfil() {
  const { vendedor } = await requerirVendedorAprobado();

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Mi vidriera
        </h1>
        <p className="mt-1 text-slate-600">
          Así te van a ver los vecinos en el market municipal.
        </p>
      </header>

      <FormularioPerfil
        perfil={{
          emprendimiento: vendedor.emprendimiento,
          rubro: vendedor.rubro,
          descripcion: vendedor.descripcion,
          whatsapp: vendedor.whatsapp,
          telefono: vendedor.telefono,
          email: vendedor.email,
          instagram: vendedor.instagram,
          facebook: vendedor.facebook,
          sitioWeb: vendedor.sitioWeb,
          direccion: vendedor.direccion,
          imagenPortada: vendedor.imagenPortada,
          logo: vendedor.logo,
        }}
      />
    </>
  );
}
