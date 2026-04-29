import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { Order } from './api';

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function buildInvoiceHtml(order: Order): string {
  const htAmount = order.total / 1.2;
  const tva = order.total - htAmount;
  const invoiceNum = order.id.slice(0, 8).toUpperCase();

  const itemRows = (order.items ?? []).map((item) => `
    <tr>
      <td>${item.productName || item.productId}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${item.price.toFixed(2)} €</td>
      <td style="text-align:right">${(item.price * item.quantity).toFixed(2)} €</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 40px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo { font-size: 32px; font-weight: 900; color: #3b12a3; letter-spacing: 4px; }
    .company-info { font-size: 11px; color: #666; line-height: 1.6; text-align: right; }

    .invoice-title { font-size: 22px; font-weight: 700; color: #3b12a3; margin-bottom: 6px; }
    .invoice-meta { color: #666; font-size: 12px; margin-bottom: 32px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background-color: #3b12a3; color: #fff; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    tbody tr:nth-child(even) { background-color: #f8f5ff; }
    tbody td { padding: 9px 12px; border-bottom: 1px solid #eee; }

    .totals { margin-left: auto; width: 260px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
    .total-row.grand { font-weight: 800; font-size: 15px; color: #3b12a3; border-bottom: none; padding-top: 10px; }

    .footer { margin-top: 48px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">CYNA</div>
    <div class="company-info">
      CYNA SAS<br/>
      Solutions de cybersécurité managées<br/>
      contact@cyna.fr
    </div>
  </div>

  <div class="invoice-title">FACTURE</div>
  <div class="invoice-meta">
    N° ${invoiceNum} &nbsp;·&nbsp; Date : ${formatDate(order.date)}
  </div>

  <table>
    <thead>
      <tr>
        <th>Service</th>
        <th>Qté</th>
        <th>P.U. HT</th>
        <th>Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="4" style="padding:12px;color:#aaa;text-align:center">Détail non disponible</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Sous-total HT</span><span>${htAmount.toFixed(2)} €</span></div>
    <div class="total-row"><span>TVA (20%)</span><span>${tva.toFixed(2)} €</span></div>
    <div class="total-row grand"><span>Total TTC</span><span>${order.total.toFixed(2)} €</span></div>
  </div>

  <div class="footer">
    Merci pour votre confiance. Ce document fait office de facture.
  </div>
</body>
</html>`;
}

export async function downloadOrderPdf(order: Order): Promise<void> {
  try {
    const html = buildInvoiceHtml(order);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Facture #${order.id.slice(0, 8).toUpperCase()}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF généré', `Le fichier a été créé : ${uri}`);
    }
  } catch {
    Alert.alert('Erreur', 'Impossible de générer le PDF. Veuillez réessayer.');
  }
}
