# Sam Jebaraj S — 3D Portfolio

A responsive portfolio and freelance services site with a CSS 3D animation, profile photo, GitHub projects, social links, INR offers, downloadable resume, direct UPI booking, and a private customer project portal.

## UPI booking and private project delivery

- `booking.html` collects customer details, project scope, and an advance from ₹300 to ₹5,00,000. It creates a project request in Cloudflare D1 and displays the UPI ID from `config.js`.
- A customer submits the UPI transaction reference (UTR) on their private `project.html?token=...` link. A submitted reference remains unverified; it does not count as money received.
- Sam uses `admin.html` to compare each UTR with the actual bank transaction. Only an admin-confirmed transfer updates the paid total.
- Set the agreed total project price and private preview/final video keys for each booking in the admin page.
- The preview video is served from private R2 only after a verified advance. The final video is served only when verified payments reach the agreed total.
- The customer portal is a private bearer link. Keep it private. The final file becomes available in the portal after full payment is verified; this setup does not send email notifications or prevent screen recording.

## Required Cloudflare setup

The booking and media pages need Cloudflare Pages Functions, a D1 database, a private R2 bucket, and an encrypted admin secret. The pages.dev site can load without these bindings, but booking, payment reports, and video delivery will show setup messages until they are connected.

1. In Cloudflare **Storage & databases → D1 SQL Database**, create a database named `sam-project-portal`.
2. Open its SQL console, paste the contents of `migrations/0001_project_portal.sql`, and run it.
3. In **Storage & databases → R2 Object Storage**, create a bucket such as `sam-project-videos`. Keep public access disabled.
4. Open the Pages project `samzz37-github-io` → **Settings → Bindings → Add**. Bind the D1 database with variable name `DB`, then bind the R2 bucket with variable name `PROJECT_MEDIA`.
5. In **Settings → Variables and Secrets**, add the encrypted production secret `PORTAL_ADMIN_KEY`. Use a random value with at least 32 characters and keep it private.
6. Redeploy the Pages project so its Functions receive the new bindings and secret.
7. Open `https://samzz37-github-io.pages.dev/admin.html` and enter the admin key.

Cloudflare's [Pages bindings guide](https://developers.cloudflare.com/pages/functions/bindings/) describes adding D1 and R2 bindings. The R2 bucket must remain private; the video Function checks each project token and payment state before serving media.

Cloudflare currently includes a monthly R2 free allowance, including 10 GB-month of Standard storage, with usage charges above the included amounts. D1 has free-plan storage and daily-query limits. Check the current [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) before uploading many large videos or growing usage.

## Customer and project workflow

1. The customer submits the booking form, pays the requested advance to `samjebaraj2412-1@oksbi`, and saves the private project page link shown after booking.
2. The customer submits the UTR on the project page. This is a payment report only.
3. Sam opens `admin.html`, confirms the transfer in the bank account, and selects **Verify after bank check**.
4. Sam sets the agreed total project price and uploads the preview and final MP4 files to the private R2 bucket. Use R2 keys such as `<project-id>/preview.mp4` and `<project-id>/final.mp4`, then save those keys in the project card.
5. Once the advance is verified, the customer portal can show the preview video and balance. After each later transfer is manually confirmed, the balance updates. When verified payments reach the agreed total, the final video becomes playable and downloadable in the same portal.

The admin page does not verify payments with UPI or Razorpay. Always check the actual bank transaction before confirming a UTR; a customer-submitted reference is not proof of payment. The UPI app link may only open on a phone with a compatible UPI app. On desktop, the customer can copy the UPI ID and pay from their phone.

## Publish on Cloudflare Pages

1. Push the contents of this folder to the GitHub repository `samzz37.github.io`.
2. Connect that repository to a **Pages** project through Cloudflare Pages Git integration.
3. Use production branch `main`, build command `exit 0`, and build output directory `.` with the repository root selected.
4. The production site is `https://samzz37-github-io.pages.dev`. New pushes to `main` deploy automatically.

GitHub Pages cannot run these Cloudflare Pages Functions. A `.com` domain requires paid registration and renewal; Cloudflare provides the free `pages.dev` subdomain.

## Personal settings

Edit `config.js` to update the profile, social links, UPI ID, resume path, and prices. The profile photo is `assets/sam-profile.jpg`, and the downloadable resume is `assets/sam-jebaraj-s-resume.pdf`. Project cards link to public repositories and read public language/star counts from GitHub; they do not access private repositories.
