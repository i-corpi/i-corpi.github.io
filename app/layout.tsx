import type { Metadata } from "next";
import { sitePath } from "../lib/site-path";
import "./globals.css";

const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://i-corpi.chatgpt.site";
const socialImage = `${origin}${sitePath("/og.png")}`;

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "i corpi — humanoid models, clearly indexed",
    template: "%s · i corpi",
  },
  description: "A source-first archive for humanoid robot and parametric human body models.",
  openGraph: {
    type: "website",
    url: sitePath("/"),
    title: "i corpi — humanoid models, clearly indexed",
    description: "Robot descriptions and parametric human bodies, with formats, provenance, access, and exact licence terms.",
    images: [{ url: socialImage, width: 1672, height: 941, alt: "i corpi — one geometric robot and one parametric human body" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "i corpi — humanoid models, clearly indexed",
    description: "A source-first archive for robot descriptions and parametric human bodies.",
    images: [socialImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
