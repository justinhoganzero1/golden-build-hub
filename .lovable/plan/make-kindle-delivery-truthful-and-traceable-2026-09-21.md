# Make Kindle delivery truthful and traceable

## Goal
Fix the missing test delivery and stop the app from claiming a book reached Kindle when only the email service accepted it.

## Changes
- Pin every Kindle email to the verified sender `kindle@kindle.oracle-lunar.online`, matching the address already approved in Amazon.
- Validate the EPUB itself before sending, including its file signature and the existing safe size limit.
- Record the email service’s message ID, sender, recipient, filename, size, time, and delivery stage for every attempt.
- Replace “Delivered” with accurate stages: queued, accepted by the receiving mail server, delayed, bounced, or failed.
- Add a secure delivery-status callback so later bounces and delays update the original send instead of disappearing.
- Show the latest status inside the Send to Kindle window with a clear retry action and manual fallback.
- Send a fresh, valid test EPUB to the Kindle address already supplied, then inspect the real provider result rather than assuming success.

## Technical details
- Add a private `kindle_deliveries` table with authenticated owner-only access and service-role callback updates.
- Update `send-to-kindle` to use one fixed verified sender, preserve the returned provider message ID, log structured results, and return `queued` rather than `delivered`.
- Add a verified Resend webhook function for delivery, delay, and bounce events; configure its signing secret securely if available.
- Update the Story Writer dialog to display delivery status and remove the false success wording.
- Add regression tests for sender stability, EPUB validation, size handling, and status wording.

## Verification
- Confirm the app builds cleanly.
- Run the Kindle delivery tests.
- Perform a signed-in send from Story Writer and verify the exact sender, recipient, provider message ID, and resulting status.
- Report separately whether Amazon accepted the email and whether the book appeared on the Kindle; never conflate those states.
