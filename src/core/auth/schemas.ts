import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Zadajte e-mail.").pipe(z.email("Zadajte platný e-mail.")),
  password: z.string().min(1, "Zadajte heslo."),
});
export type SignInValues = z.infer<typeof signInSchema>;

/** 6 digits; spaces the user may type (e.g. "123 456") are removed. */
export const totpCodeSchema = z.object({
  code: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Kód má 6 číslic.")),
});
export type TotpCodeValues = z.input<typeof totpCodeSchema>;

export const PASSWORD_MIN = 12;
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `Heslo musí mať aspoň ${PASSWORD_MIN} znakov.`)
      .max(72, "Heslo môže mať najviac 72 znakov."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Heslá sa nezhodujú." });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const factorNameSchema = z.object({
  name: z.string().trim().min(1, "Pomenujte zariadenie.").max(40, "Najviac 40 znakov."),
});
export type FactorNameValues = z.infer<typeof factorNameSchema>;
