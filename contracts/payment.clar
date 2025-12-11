;; sBTC Payent rolcsor — MAINNET-read
;; Stores invoices, allows payments inSTX SIP tons
;; NOTE: Always audit before mainnet deployment.

(define-data-var invoice-counter uint u0)

(define-map invoices ((id uint))
  ((merchant principal)
   (amount uint)
   (token (buff 8))
   (token-contract (optional principal))
   (paid bool)
   (payer (optional principal))
   (created-at uint)
   (memo (optional (buff 256)))))

(define-constant ERR-NOT-FOUND (err u400))
(define-constant ERR-ALREADY-PAID (err u401))
(define-constant ERR-NOT-MERCHANT (err u402))
(define-constant ERR-TRANSFER-FAILED (err u403))

;; Create invoice: amount is in smallest unit (for STX: microstacks / for sBTC follow token's unit)
(define-public (create-invoice (amount uint) (token (buff 8)) (token-contract (optional principal)) (memo (optional (buff 256))))
  (let ((id (var-get invoice-counter)))
    (begin
      (var-set invoice-counter (+ id u1))
      (map-set invoices ((id (+ id u1))) ((merchant tx-sender) (amount amount) (token token) (token-contract token-contract) (paid false) (payer none) (created-at (get-block-info? block-height)) (memo memo)))
      (ok (+ id u1)))))

(define-read-only (get-invoice (id uint))
  (match (map-get? invoices ((id id))) invoice (ok invoice) ERR-NOT-FOUND))

;; Pay invoice with STX — merchant will receive an STX transfer in the same transaction
(define-public (pay-invoice-stx (id uint) (amount uint))
  (match (map-get? invoices ((id id)))
    invoice
    (begin
      (asserts! (not (get paid invoice)) ERR-ALREADY-PAID)
      ;; transfer STX to merchant
      (let ((merchant (get merchant invoice)))
        (match (stx-transfer? amount tx-sender merchant)
          ok (begin
               (map-set invoices ((id id)) ((merchant merchant) (amount (get amount invoice)) (token (get token invoice)) (token-contract (get token-contract invoice)) (paid true) (payer (some tx-sender)) (created-at (get created-at invoice)) (memo (get memo invoice))))
               (ok true))
          (err e) ERR-TRANSFER-FAILED)))
    ERR-NOT-FOUND))

;; Pay invoice with SIP-010 token
(define-public (pay-invoice-ft (id uint) (token-contract principal) (amount uint))
  (match (map-get? invoices ((id id)))
    invoice
    (begin
      (asserts! (not (get paid invoice)) ERR-ALREADY-PAID)
      (let ((merchant (get merchant invoice)))
        (match (try! (contract-call? token-contract ft-transfer? amount tx-sender merchant))
          val (begin
                (map-set invoices ((id id)) ((merchant merchant) (amount (get amount invoice)) (token (get token invoice)) (token-contract (some token-contract)) (paid true) (payer (some tx-sender)) (created-at (get created-at invoice)) (memo (get memo invoice))))
                (ok true))
          (err e) ERR-TRANSFER-FAILED)))
    ERR-NOT-FOUND))