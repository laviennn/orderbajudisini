import { z } from "zod";
const profile = (hosts: string[]) =>
  z
    .url()
    .max(500)
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        hosts.includes(url.hostname)
      );
    })
    .nullable();
export const socialInput = z
  .object({
    instagram: profile(["instagram.com", "www.instagram.com"]),
    tiktok: profile(["tiktok.com", "www.tiktok.com"]),
    facebook: profile(["facebook.com", "www.facebook.com", "m.facebook.com"]),
    whatsapp: z
      .string()
      .regex(/^62[1-9][0-9]{7,12}$/)
      .nullable(),
  })
  .strict();
export type SocialSettings = z.infer<typeof socialInput>;
export function socialLinks(value: SocialSettings | null | undefined) {
  if (!value) return [];
  return (
    [
      ["Instagram", value.instagram],
      ["TikTok", value.tiktok],
      ["Facebook", value.facebook],
      ["WhatsApp", value.whatsapp ? `https://wa.me/${value.whatsapp}` : null],
    ] as const
  ).filter(
    (
      p,
    ): p is readonly [
      "Instagram" | "TikTok" | "Facebook" | "WhatsApp",
      string,
    ] => Boolean(p[1]),
  );
}
