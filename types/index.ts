export type SaleStatus = "Aprovado" | "Pendente" | "Cancelado";

export type SellerStatus = "Ativo" | "Inativo";

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: SellerStatus;
  avatar: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Sale {
  id: string;
  seller_id: string | null;
  amount: number;
  status: SaleStatus;
  created_at: string;
  seller?: Seller | null;
}

export interface Goal {
  id: string;
  type: "equipe" | "individual";
  target_value: number;
  seller_id: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: "reuniao" | "campanha" | "fechamento";
  event_day: number;
  month: number;
  year: number;
}

export interface SellerRanking {
  seller: Seller;
  totalSales: number;
  salesCount: number;
  position: number;
}

export interface DashboardStats {
  totalFaturado: number;
  qtdVendas: number;
  metaGlobal: number;
  topSeller: SellerRanking | null;
}

export interface ChartPoint {
  dia: string;
  atual: number;
  anterior: number;
}

export interface VendedorPerfil {
  name: string;
  value: string;
  sales: number;
  status: string;
}

export interface InsightItem {
  id: number;
  tipo: "sucesso" | "alerta" | "info";
  titulo: string;
  mensagem: string;
  corTexto: string;
  corIcone: string;
}
