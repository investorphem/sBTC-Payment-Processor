;; sBTC Payment Processor
;; handles STX and SIP-010 (sBTC) payments with on-chain indexing
;; + programmable treasury routing: merchants can auto-split each
;;   incoming payment between an instantly-liquid payout and a
;;   time-locked on-chain reserve (tax/savings/runway).

;; Trait definition for SIP-010 (Standard for sBTC and other tokens)
(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVOICE-NOT-FOUND (err u101))
(define-constant ERR-ALREADY-PAID (err u102))
(define-constant ERR-AMOUNT-MISMATCH (err u103))
(define-constant ERR-INVALID-BPS (err u104))
(define-constant ERR-RESERVE-LOCKED (err u105))
(define-constant ERR-NO-RESERVE (err u106))

;; 10000 basis points = 100%
(define-constant BPS-DENOM u10000)

;; --- Data Maps ---

(define-map Invoices
  uint
  {
    merchant: principal,
    amount: uint,
    token: (buff 12), ;; "STX" or "sBTC"
    token-contract: (optional principal),
    memo: (optional (buff 34)),
    paid: bool
  }
)

;; Per-merchant routing preference, set once and applied to every future payment.
;; reserve-bps: what fraction (out of 10000) of each payment is auto-locked instead
;;              of paid out immediately. 0 = unchanged legacy behavior (100% liquid).
;; lock-blocks: how many blocks a newly-locked reserve amount must wait before
;;              the merchant can withdraw it.
(define-map RoutingRules
  principal
  { reserve-bps: uint, lock-blocks: uint }
)

;; Locked reserve balances held by this contract on behalf of each merchant.
(define-map ReserveSTX principal { locked: uint, unlock-height: uint })
(define-map ReserveSBTC principal { locked: uint, unlock-height: uint })

(define-data-var last-invoice-id uint u0)

;; --- Read Only ---

(define-read-only (get-invoice (id uint))
  (map-get? Invoices id)
)

(define-read-only (get-last-id)
  (var-get last-invoice-id)
)

(define-read-only (get-routing-rules (merchant principal))
  (default-to { reserve-bps: u0, lock-blocks: u0 } (map-get? RoutingRules merchant))
)

(define-read-only (get-reserve-stx (merchant principal))
  (default-to { locked: u0, unlock-height: u0 } (map-get? ReserveSTX merchant))
)

(define-read-only (get-reserve-sbtc (merchant principal))
  (default-to { locked: u0, unlock-height: u0 } (map-get? ReserveSBTC merchant))
)

;; --- Public Functions ---

;; 0. Merchant sets (or updates) their treasury routing preference.
;;    reserve-bps must be between 0 and 10000 (0% - 100%).
(define-public (set-routing-rules (reserve-bps uint) (lock-blocks uint))
  (begin
    (asserts! (<= reserve-bps BPS-DENOM) ERR-INVALID-BPS)
    (map-set RoutingRules tx-sender { reserve-bps: reserve-bps, lock-blocks: lock-blocks })
    (print { event: "routing-rules-set", merchant: tx-sender, reserve-bps: reserve-bps, lock-blocks: lock-blocks })
    (ok true)
  )
)

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
;;    If the merchant has a reserve-bps > 0 routing rule, the payment is
;;    automatically split: (100% - reserve-bps) goes straight to the merchant,
;;    reserve-bps goes into this contract's locked reserve for that merchant.
(define-public (pay-invoice-stx (id uint) (amount uint))
  (let
    (
      (invoice (unwrap! (get-invoice id) ERR-INVOICE-NOT-FOUND))
      (merchant (get merchant invoice))
      (rules (get-routing-rules merchant))
      (reserve-bps (get reserve-bps rules))
      (reserve-amount (/ (* amount reserve-bps) BPS-DENOM))
      (liquid-amount (- amount reserve-amount))
    )
    (asserts! (is-eq (get paid invoice) false) ERR-ALREADY-PAID)
    (asserts! (is-eq (get amount invoice) amount) ERR-AMOUNT-MISMATCH)
    (asserts! (is-eq (get token invoice) 0x535458) ERR-NOT-AUTHORIZED)

    (if (> liquid-amount u0)
      (try! (stx-transfer? liquid-amount tx-sender merchant))
      true
    )

    (if (> reserve-amount u0)
      (begin
        (try! (stx-transfer? reserve-amount tx-sender (as-contract tx-sender)))
        (map-set ReserveSTX merchant {
          locked: (+ reserve-amount (get locked (get-reserve-stx merchant))),
          unlock-height: (+ block-height (get lock-blocks rules))
        })
        true
      )
      true
    )

    (map-set Invoices id (merge invoice { paid: true }))
    (print { event: "invoice-paid", id: id, payer: tx-sender, method: "STX", liquid: liquid-amount, reserved: reserve-amount })
    (ok true)
  )
)

;; 3. Pay with SIP-010 (sBTC) -- same split/lock behavior as STX above.
(define-public (pay-invoice-ft (id uint) (token-trait <ft-trait>) (amount uint))
  (let
    (
      (invoice (unwrap! (get-invoice id) ERR-INVOICE-NOT-FOUND))
      (merchant (get merchant invoice))
      (required-token (unwrap! (get token-contract invoice) ERR-NOT-AUTHORIZED))
      (rules (get-routing-rules merchant))
      (reserve-bps (get reserve-bps rules))
      (reserve-amount (/ (* amount reserve-bps) BPS-DENOM))
      (liquid-amount (- amount reserve-amount))
    )
    (asserts! (is-eq (get paid invoice) false) ERR-ALREADY-PAID)
    (asserts! (is-eq (contract-of token-trait) required-token) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get amount invoice) amount) ERR-AMOUNT-MISMATCH)

    (if (> liquid-amount u0)
      (try! (contract-call? token-trait transfer liquid-amount tx-sender merchant (get memo invoice)))
      true
    )

    (if (> reserve-amount u0)
      (begin
        (try! (contract-call? token-trait transfer reserve-amount tx-sender (as-contract tx-sender) none))
        (map-set ReserveSBTC merchant {
          locked: (+ reserve-amount (get locked (get-reserve-sbtc merchant))),
          unlock-height: (+ block-height (get lock-blocks rules))
        })
        true
      )
      true
    )

    (map-set Invoices id (merge invoice { paid: true }))
    (print { event: "invoice-paid", id: id, payer: tx-sender, method: "FT", liquid: liquid-amount, reserved: reserve-amount })
    (ok true)
  )
)

;; 4. Merchant withdraws their unlocked STX reserve once the lock period has passed.
(define-public (withdraw-reserve-stx)
  (let
    (
      (merchant tx-sender)
      (reserve (get-reserve-stx merchant))
      (amount (get locked reserve))
    )
    (asserts! (> amount u0) ERR-NO-RESERVE)
    (asserts! (>= block-height (get unlock-height reserve)) ERR-RESERVE-LOCKED)
    (map-set ReserveSTX merchant { locked: u0, unlock-height: u0 })
    (try! (as-contract (stx-transfer? amount tx-sender merchant)))
    (print { event: "reserve-withdrawn", merchant: merchant, amount: amount, token: "STX" })
    (ok amount)
  )
)

;; 5. Merchant withdraws their unlocked sBTC (or other SIP-010) reserve.
(define-public (withdraw-reserve-ft (token-trait <ft-trait>))
  (let
    (
      (merchant tx-sender)
      (reserve (get-reserve-sbtc merchant))
      (amount (get locked reserve))
    )
    (asserts! (> amount u0) ERR-NO-RESERVE)
    (asserts! (>= block-height (get unlock-height reserve)) ERR-RESERVE-LOCKED)
    (map-set ReserveSBTC merchant { locked: u0, unlock-height: u0 })
    (try! (as-contract (contract-call? token-trait transfer amount tx-sender merchant none)))
    (print { event: "reserve-withdrawn", merchant: merchant, amount: amount, token: "sBTC" })
    (ok amount)
  )
)
