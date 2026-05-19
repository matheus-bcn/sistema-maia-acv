import { describe, it, expect } from 'vitest';
import { buildMaiaBriefing } from './dashboard';

describe('Dashboard Data Layer - M.A.I.A Briefing', () => {
  
  it('deve calcular a porcentagem corretamente quando a meta é atingida pela metade', () => {
    const briefing = buildMaiaBriefing(75000, 150000);
    expect(briefing).toContain('50.0%');
    expect(briefing).toContain('75.000');
  });

  it('deve lidar corretamente com o cenário de meta zerada (evitando divisão por zero)', () => {
    const briefing = buildMaiaBriefing(10000, 0);
    // Como a meta é 0, a nossa regra de negócio diz que a porcentagem exibida deve ser 0
    expect(briefing).toContain('0%');
  });

  it('deve exibir mais de 100% caso a equipe ultrapasse a meta global', () => {
    const briefing = buildMaiaBriefing(300000, 150000);
    expect(briefing).toContain('200.0%');
  });

  it('deve formatar valores monetários corretamente para o padrão brasileiro', () => {
    const briefing = buildMaiaBriefing(1234567.89, 2000000);
    // Verifica se os pontos e vírgulas da moeda local foram aplicados
    expect(briefing).toContain('1.234.567,89');
  });

});