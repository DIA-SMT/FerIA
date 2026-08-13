import { z } from "zod";

import { email, password } from "@/lib/validations/comunes";

/** Credenciales del formulario de ingreso (las consume Auth.js). */
export const credencialesSchema = z.object({
  email,
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export type Credenciales = z.infer<typeof credencialesSchema>;

/** Cambio de contraseña desde el panel del feriante. */
export const cambioPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, "Ingresá tu contraseña actual."),
    passwordNueva: password,
    confirmarPassword: z.string().min(1, "Repetí la contraseña nueva."),
  })
  .refine((datos) => datos.passwordNueva === datos.confirmarPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmarPassword"],
  });

export { email, password };
