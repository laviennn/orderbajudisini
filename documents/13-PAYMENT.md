# Manual Payment System

## Scope

MVP supports manual bank transfer only.

## Admin Payment Settings

Owner can manage active bank accounts: - bank name - account number -
account holder - active/inactive - display order

## Customer Payment Page

Display: - order number - exact total - selected bank account - account
holder - transfer deadline if reservation policy uses one - copy
actions - proof upload - current payment status - WhatsApp confirmation
CTA

## Proof Upload

-   private R2 object
-   accepted types configured; prefer images and optionally PDF
-   strict max size
-   random object key
-   no public bucket URL
-   admin views through short-lived signed URL
-   malware/content scanning can be added if risk/scale warrants it

## Payment Verification

Operator compares: - expected total - proof - destination bank -
order/customer context Actions: - Verify - Reject / request re-upload
Verification writes operator/time and audit log.

## Security

A proof upload is NOT payment confirmation. Never automatically mark
paid solely because a file exists. Never expose proofs in public order
tracking.
