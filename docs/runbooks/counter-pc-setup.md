# Runbook: setting up a billing counter PC

For whoever sets up the shop's counters (owner or helper). One pass per PC; about 20 minutes.

## You need

- A Windows PC with Google Chrome and internet.
- The 80 mm thermal receipt printer, its driver installed, connected by USB (D-13).
- A USB barcode scanner.
- The shop's web address (`https://pos.<domain>`) and the cashier's own username and password (D-10).

## 1. Printer

1. Windows Settings → Bluetooth & devices → Printers: make the 80 mm printer the **default printer**, and
   turn off "Let Windows manage my default printer".
2. In the printer's preferences: paper 80 mm (roll), margins none, no header or footer.

## 2. The POS shortcut (prints without a dialog)

1. Right-click the desktop → New → Shortcut. Target:
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://pos.<domain>/terminal`
2. Name it "POS". Use only this shortcut for billing. `--kiosk-printing` sends receipts straight to the
   default printer; `--app` opens the POS in its own window.
3. Close every Chrome window, then open "POS". If Chrome was already running, the flag is ignored.

## 3. Sign in and test

1. Sign in with the cashier's own account. The counter stays signed in for 12 idle hours.
2. **Scanner:** click the search box and scan any product. It must be added to the cart (the scanner types
   the code and presses Enter). If nothing happens, set the scanner to "USB keyboard" with an Enter suffix
   (see its manual).
3. **Receipt:** press **Refund** at the top of the terminal, press the printer button (Reprint) on any
   earlier bill, then close the window without refunding. The receipt must print at once, 80 mm wide, with
   no browser header. Do not make a test sale.
4. Remove the item scanned in step 2 from the cart.

## Everyday

- Lock Windows when you leave the counter (Windows key + L).
- If the internet drops, the counter shows "Offline: billing paused" and billing stops until it is back (D-05). It
  reconnects by itself; there is no need to refresh. Use paper bills meanwhile, and enter them later.
- A "Live updates paused, reconnecting…" banner that stays for more than a few minutes: tell the owner ([incident.md](incident.md)).

## Problems

| Problem | Fix |
|---|---|
| A print dialog appears | Chrome was started without the shortcut: close all Chrome windows, open "POS" |
| Receipt prints on the wrong printer, or is cut off | Make the 80 mm printer the default; check paper size and margins (section 1) |
| Scanner adds wrong numbers | Keyboard layout must be English (US); set the scanner to a USB keyboard |
| "Too many attempts. Wait a few minutes…" at sign-in | Wait 15 minutes, or ask an admin to reset the password |
