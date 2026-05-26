// A linha abaixo é o que traz toda a formatação do Tailwind de volta!
import "./globals.css";

export const metadata = {
  title: "M.A.I.A | ACV",
  description: "Sistema de Acompanhamento de Vendas Industrial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}