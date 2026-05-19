import type { Seller } from "@/types";

/** CSV: vendedor_email ou vendedor_nome, valor */
export function parseSalesCsv(
  text: string,
  sellers: Seller[]
): { rows: { seller_id: string; amount: number }[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const errors: string[] = [];
  const rows: { seller_id: string; amount: number }[] = [];

  if (lines.length < 2) {
    return { rows: [], errors: ["Arquivo vazio ou sem dados."] };
  }

  const header = lines[0].toLowerCase();
  const sep = header.includes(";") ? ";" : ",";
  const cols = lines[0].split(sep).map((c) => c.trim().toLowerCase());

  const emailIdx = cols.findIndex((c) => c.includes("email"));
  const nameIdx = cols.findIndex((c) => c.includes("vendedor") || c.includes("nome"));
  const amountIdx = cols.findIndex((c) => c.includes("valor") || c.includes("amount"));

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((p) => p.trim());
    const amountRaw = parts[amountIdx >= 0 ? amountIdx : parts.length - 1];
    const amount = parseFloat(
      amountRaw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
    );

    if (isNaN(amount) || amount <= 0) {
      errors.push(`Linha ${i + 1}: valor inválido`);
      continue;
    }

    const email = emailIdx >= 0 ? parts[emailIdx]?.toLowerCase() : "";
    const name = nameIdx >= 0 ? parts[nameIdx]?.toLowerCase() : "";

    const seller = sellers.find(
      (s) =>
        (email && s.email.toLowerCase() === email) ||
        (name && s.name.toLowerCase() === name)
    );

    if (!seller) {
      errors.push(`Linha ${i + 1}: vendedor não encontrado`);
      continue;
    }

    rows.push({ seller_id: seller.id, amount });
  }

  return { rows, errors };
}
