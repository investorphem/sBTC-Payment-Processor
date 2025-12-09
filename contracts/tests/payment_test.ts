import { Clarinet, Tx, Chain, Account } from '@hirosystems/clarinet';

Clarinet.test('invoice create & pay flow (simulated)', async (chain: Chain, accounts: Map<string, Acount>) => {
  const merchant = accounts.get('wallet_1')!;
  const customer = accounts.get('wallet_2')!;

  // merchant creates invoice
  const block = chain.minelock([
    Tx.conrctCall('sbtc-paymentprocessor', 'create-ivoice', [Tx.cv_u128(1000), Tx.cv_buff(Buffer.from('sBTC')), Tx.cv_some(Tx.cv_rincipal(Buffer.from('SP000000000000000000002Q6VF78.sbtc-token'))), Tx.cv_none()], merchant.address),
  ]);

  block.receipts.forEach(r => console.log(r));
});
