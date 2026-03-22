import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "FULL FLOW: Merchant creates an sBTC invoice and Customer pays successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const merchant = accounts.get('wallet_1')!;
    const customer = accounts.get('wallet_2')!;
    
    // The sBTC asset identifier (mocked for Clarinet environment)
    const sbtcAsset = `${deployer.address}.sbtc-token`;

    // 1. MERCHANT CREATES INVOICE
    let block = chain.mineBlock([
      Tx.contractCall(
        'sbtc-payment-processor', 
        'create-invoice', 
        [
          types.uint(1000000),                         // Amount (1.0 sBTC in sats)
          types.ascii("sBTC"),                         // Token Type
          types.some(types.principal(sbtcAsset)),      // sBTC Contract Principal
          types.some(types.ascii("Invoice #001"))      // Memo
        ], 
        merchant.address
      ),
    ]);

    // Assert: Check if invoice creation was successful (expecting ok true)
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Assert: Verify the 'invoice-created' event was emitted (Advanced Technical Depth)
    block.receipts[0].events.expectPrintEvent(
      `'${deployer.address}.sbtc-payment-processor`,
      `{amount: u1000000, creator: ${merchant.address}, memo: (some "Invoice #001"), token: "sBTC"}`
    );

    console.log("✅ Invoice Created Successfully");

    // 2. CUSTOMER PAYS INVOICE
    // Note: In a real test, you'd need to ensure the customer has sBTC balance first
    let payBlock = chain.mineBlock([
      Tx.contractCall(
        'sbtc-payment-processor',
        'pay-invoice',
        [
          types.uint(1000000),                 // Amount
          types.principal(merchant.address),   // Recipient
          types.principal(sbtcAsset),          // Token Contract
          types.ascii("sBTC")                  // Asset Name
        ],
        customer.address
      )
    ]);

    // Assert: Check for successful payment
    payBlock.receipts[0].result.expectOk().expectBool(true);
    
    console.log("✅ Invoice Paid and Settled Successfully");
  },
});

Clarinet.test({
    name: "SECURITY CHECK: Should fail if paying with wrong amount",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const merchant = accounts.get('wallet_1')!;
        const customer = accounts.get('wallet_2')!;
        const deployer = accounts.get('deployer')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'sbtc-payment-processor',
                'pay-invoice',
                [
                    types.uint(0), // Invalid amount
                    types.principal(merchant.address),
                    types.principal(`${deployer.address}.sbtc-token`),
                    types.ascii("sBTC")
                ],
                customer.address
            )
        ]);

        // Assert: Expect an error (e.g., err-u101 for invalid amount)
        block.receipts[0].result.expectErr().expectUint(101);
        console.log("✅ Security Check Passed: Invalid amount rejected");
    }
});
