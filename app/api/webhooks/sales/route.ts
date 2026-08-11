import { NextResponse } from 'next/server';

// Definição da estrutura que esperamos receber do banco de dados (Supabase Webhook)
interface SaleWebhookPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: {
    id: string;
    amount: number;
    seller_id: string;
    status: string;
  };
}

export async function POST(request: Request) {
  try {
    // 1. Validação de Segurança (Secret Token)
    // Isso garante que apenas o SEU Supabase pode chamar essa URL
    const authHeader = request.headers.get('Authorization');
    if (!process.env.WEBHOOK_SECRET || authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload: SaleWebhookPayload = await request.json();

    // 2. Filtro: Só queremos alertar vendas novas e que foram Aprovadas
    if (payload.type === 'INSERT' && payload.record.status === 'Aprovado') {
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(payload.record.amount);

      // 3. Montagem da Mensagem
      const mensagem = `🚀 *NOVA VENDA REGISTRADA!*\n\nValor: *${valorFormatado}*\nStatus: Aprovado ✅\n\n_M.A.I.A System_`;

      // 4. Integração com Slack / Discord / WhatsApp (Substitua a URL abaixo pela sua)
      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      
      if (slackWebhookUrl) {
        await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: mensagem })
        });
      }

      console.log(`[Webhook] Alerta de venda disparado: ${payload.record.id}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Falha interna no webhook' }, { status: 500 });
  }
}