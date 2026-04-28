interface CardData {
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  name: string;
}

export async function createStripeToken(card: CardData, publishableKey: string): Promise<string> {
  if (!publishableKey || publishableKey.startsWith('pk_test_...')) {
    throw new Error('Stripe non configuré — ajoutez EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY dans .env');
  }

  const params = new URLSearchParams({
    'card[number]':    card.number.replace(/\s/g, ''),
    'card[exp_month]': card.expMonth.trim(),
    'card[exp_year]':  card.expYear.trim().length === 2 ? `20${card.expYear.trim()}` : card.expYear.trim(),
    'card[cvc]':       card.cvc.trim(),
    'card[name]':      card.name.trim(),
  });

  const res = await fetch('https://api.stripe.com/v1/tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? 'Échec de la tokenisation Stripe');
  }
  return data.id as string;
}
