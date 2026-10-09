import { it, expect } from "vitest";
import { socialInput, socialLinks } from "@/lib/social-settings";
it("allows only configured platform links and normalized Indonesian WhatsApp numbers", () => {
  const value = {
    instagram: "https://www.instagram.com/test",
    tiktok: null,
    facebook: null,
    whatsapp: "6281234567890",
  };
  expect(socialLinks(socialInput.parse(value))).toEqual([
    ["Instagram", value.instagram],
    ["WhatsApp", "https://wa.me/6281234567890"],
  ]);
  expect(socialLinks(null)).toEqual([]);
  for (const instagram of [
    "javascript:alert(1)",
    "http://instagram.com/test",
    "https://instagram.com.evil.invalid",
    "https://user:password@instagram.com",
  ])
    expect(socialInput.safeParse({ ...value, instagram }).success).toBe(false);
  expect(
    socialInput.safeParse({ ...value, whatsapp: "081234567890" }).success,
  ).toBe(false);
});
