import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MAIA - ACV",
  description: "Sistema de Acompanhamento de Vendas Industrial",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MAIA ACV",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark"> 
      <body className={cn(
        inter.className,
        "min-h-screen bg-neutral-950 text-white selection:bg-white selection:text-black"
      )}>
        {/* Background Animado Subtil */}
        <div className="fixed inset-0 -z-10 h-full w-full bg-neutral-950">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-white opacity-5 blur-[100px]"></div>
        </div>
        
        {children}
      </body>
    </html>
  );
}