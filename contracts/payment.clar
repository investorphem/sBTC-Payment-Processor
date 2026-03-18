;; sBTC Payment Processor
;; handles STX and SIP-010 (sBTC) payments with on-chain indexing

;; Trait definition for SIP-010 (Standard for sBTC and other tokens)
(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVOICE-NOT-FOUND (err u101))
(define-constant ERR-ALREADY-PAID (err u102))
(define-constant ERR-AMOUNT-MISMATCH (err u103))

;; Data Maps
(define-map Invoices
  uint 
  {
    merchant: principal,
    amount: uint,
    token: (buff 12), ;; "STX" or "sBTC"
    token-contract: (optional principal),
    memo: (optional (buff 34)), ;; FIXED: Standard transfer memo size
    paid: bool
  }
)

(define-data-var last-invoice-id uint u0)

;; --- Read Only ---

(define-read-only (get-invoice (id uint))
  (map-get? Invoices id)
)

(define-read-only (get-last-id)
  (var-get last-invoice-id)
)

;; --- Public Functions ---

;; 1. Create an Invoice
(define-public (create-invoice (amount uint) (token (buff 12)) (token-contract (optional principal)) (memo (optional (buff 34))))
  (let
    (
      (id (+ (var-get last-invoice-id) u1))
    )
    (map-set Invoices id {
      merchant: tx-sender,
      amount: amount,
      token: token,
      token-contract: token-contract,
      memo: memo,
      paid: false
    })
    (var-set last-invoice-id id)
    (print { event: "invoice-created", id: id, merchant: tx-sender, amount: amount, token: token })
    (ok id)
  )
)

;; 2. Pay with STX
(define-public (pay-invoice-stx (id uint) (amount uint))
  (let
    (
      (invoice (unwrap! (get-invoice id) ERR-INVOICE-NOT-FOUND))
    )
    (asserts! (is-eq (get paid invoice) false) ERR-ALREADY-PAID)
    (asserts! (is-eq (get amount invoice) amount) ERR-AMOUNT-MISMATCH)
    ;; Check if token is "STX" (Hex for STX)
    (asserts! (is-eq (get token invoice) 0x535458) ERR-NOT-AUTHORIZED) 

    (try! (stx-transfer? amount tx-sender (get merchant invoice)))
    
    (map-set Invoices id (merge invoice { paid: true }))
    (print { event: "invoice-paid", id: id, payer: tx-sender, method: "STX" })
    (ok true)
  )
)

;; 3. Pay with SIP-010 (sBTC)
(define-public (pay-invoice-ft (id uint) (token-trait <ft-trait>) (amount uint))
  (let
    (
      (invoice (unwrap! (get-invoice id) ERR-INVOICE-NOT-FOUND))
      (required-token (unwrap! (get token-contract invoice) ERR-NOT-AUTHORIZED))
    )
    (asserts! (is-eq (get paid invoice) false) ERR-ALREADY-PAID)
    ;; Ensure the token contract being used matches the one in the invoice
    (asserts! (is-eq (contract-of token-trait) required-token) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get amount invoice) amount) ERR-AMOUNT-MISMATCH)

    ;; Transfer the FT (sBTC) to the merchant
    (try! (contract-call? token-trait transfer amount tx-sender (get merchant invoice) (get memo invoice)))
    
    (map-set Invoices id (merge invoice { paid: true }))
    (print { event: "invoice-paid", id: id, payer: tx-sender, method: "FT" })
    (ok true)
  )
)
