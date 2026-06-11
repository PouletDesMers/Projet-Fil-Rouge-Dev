export interface CardData {
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  name: string;
}

export function parseCardData(
  cardNumber: string,
  cardExpiry: string,
  cardCvc: string,
  cardName: string,
): CardData {
  const [expMonth = '', expRaw = ''] = cardExpiry.split('/');
  const expYear = expRaw.trim().length === 2 ? `20${expRaw.trim()}` : expRaw.trim();
  return {
    number:   cardNumber.replace(/\s/g, ''),
    expMonth: expMonth.trim(),
    expYear,
    cvc:      cardCvc.trim(),
    name:     cardName.trim(),
  };
}
