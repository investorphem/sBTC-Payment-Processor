import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "FULL FLOW: Merchant creates sBTC invoice and Customer pays via pay-invoice-ft",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const merchant = accounts.get('wallet_1')!;
    const customer = accounts.get('wallet_2')!;

    // Must match the contract name in your project
    const contractName = 'payment'; 
    const sbtcAsset = `${deployer.address}.sbtc-token`;

    // 1. MERCHANT CREATES INVOICE
    let block = chain.mineBlock([
      Tx.contractCall(
        contractName, 
        'create-invoice', 
        [
          types.uint(1000000),                         
          types.buff(Buffer.from("sBTC")),             // Corrected: buff instead of ascii
          types.some(types.principal(sbtcAsset)),      
          types.some(types.buff(Buffer.from("INV001"))) // Corrected: buff instead of ascii
        ], 
        merchant.address
      ),
    ]);

    // Assert: Check if invoice was created (returns ok invoice-id)
    block.receipts[0].result.expectOk().expectUint(1);
    console.log("✅ Invoice Created Successfully (ID: u1)");

    // 2. CUSTOMER PAYS INVOICE (Using your pay-invoice-ft function)
    let payBlock = chain.mineBlock([
      Tx.contractCall(
        contractName,
        'pay-invoice-ft', // Corrected: matching your contract function name
        [
          types.uint(1),               // id
          types.principal(sbtcAsset),  // token-trait
          types.uint(1000000)          // amount
        ],
        customer.address
      )
    ]);

    // Assert: Check for successful payment
    payBlock.receipts[0].result.expectOk().expectBool(true);
    console.log("✅ sBTC Invoice Paid and Settled Successfully");
  },
});

Clarinet.test({
    name: "SECURITY CHECK: Should fail if paying with wrong amount (ERR-AMOUNT-MISMATCH)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const merchant = accounts.get('wallet_1')!;
        const customer = accounts.get('wallet_2')!;
        const deployer = accounts.get('deployer')!;
        const contractName = 'payment';

        // 1. Create invoice first to have it in the map
        chain.mineBlock([
            Tx.contractCall(contractName, 'create-invoice', [
                types.uint(5000), 
                types.buff(Buffer.from("STX")), 
                types.none(), 
                types.none()
            ], merchant.address)
        ]);

        // 2. Try to pay with wrong amount (u1000 instead of u5000)
        let block = chain.mineBlock([
            Tx.contractCall(
                contractName,
                'pay-invoice-stx',
                [
                    types.uint(1), // id
                    types.uint(1000) // Wrong amount!
                ],
                customer.address
            )
        ]);

        // Assert: Expect ERR-AMOUNT-MISMATCH (u103) from your contract constants
        block.receipts[0].result.expectErr().expectUint(103);
        console.log("✅ Security Check Passed: Wrong amount rejected with u103");
    }
});
