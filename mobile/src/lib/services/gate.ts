import { Alert } from 'react-native';
import { showRewardedAd } from './ads';
import type { Usage } from '../types';

type GateKind = 'wash' | 'receipt' | 'quote';

/**
 * Decide se a ação pode prosseguir. Para o plano free acima do limite,
 * pede ao usuário para assistir um vídeo recompensado.
 *
 * Retorna:
 *   { allow: true,  adWatched: boolean }  -> prossiga; envie ad_watched=adWatched ao backend
 *   { allow: false }                       -> usuário recusou o anúncio
 */
export async function gateAction(
  kind: GateKind,
  usage: Usage | null
): Promise<{ allow: boolean; adWatched: boolean }> {
  // Premium ou sem dados de uso ainda -> libera direto.
  if (!usage || usage.isPremium) return { allow: true, adWatched: false };

  const section = kind === 'wash' ? usage.washes : kind === 'quote' ? usage.quotes : usage.receipts;
  if (!section.requiresAd) return { allow: true, adWatched: false };

  const labels: Record<GateKind, string> = {
    wash: 'registrar mais uma lavagem hoje',
    receipt: 'emitir mais um recibo',
    quote: 'emitir mais um orçamento',
  };

  const confirmed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Limite do plano gratuito',
      `Você atingiu o limite gratuito. Assista a um vídeo rápido para ${labels[kind]}, ou assine o Premium para liberar tudo sem anúncios.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Assistir vídeo', onPress: () => resolve(true) },
      ]
    );
  });

  if (!confirmed) return { allow: false, adWatched: false };

  const earned = await showRewardedAd();
  if (!earned) {
    Alert.alert('Vídeo não concluído', 'É preciso assistir o vídeo até o fim para liberar a ação.');
    return { allow: false, adWatched: false };
  }
  return { allow: true, adWatched: true };
}
