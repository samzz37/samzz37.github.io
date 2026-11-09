# Sam Jebaraj S — 3D Portfolio

A responsive portfolio and freelance services site with a CSS 3D animation, your portrait, real GitHub projects, social links, INR offers, a downloadable resume and a Razorpay project-booking page.

## Project booking and payment flow

- `booking.html` collects customer name, email, phone, project type, brief, optional project budget and a customer-selected advance.
- The minimum advance is ₹300. The current maximum is ₹5,00,000 per checkout.
- `functions/api/create-order.js` validates the request and creates a Razorpay order in INR paise.
- `functions/api/verify-payment.js` verifies Razorpay's HMAC signature, checks the payment and order against Razorpay, and confirms only a captured payment.
- Customer and project details are added to Razorpay order notes. This site does not save them to a separate database or send a notification email.
- The Razorpay secret is read only on the server from Cloudflare Pages secrets. Never put it in `config.js`, `booking.js`, or Git.

## Publish on Cloudflare Pages

GitHub Pages can host the static files but cannot run the payment API. Use Cloudflare Pages Git integration so the `/functions` folder runs with the site.

1. Push the contents of this folder to the public GitHub repository `samzz37.github.io`.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git** and select that repository.
3. Set the production branch to `main`, the build command to `exit 0`, and the build output directory to `.`. Keep the repository root as the project root.
4. Deploy. Cloudflare gives the site a `pages.dev` address and publishes later pushes automatically.
5. In the Pages project, open **Settings → Variables and Secrets** and add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` using Razorpay **Test Mode** keys first. Set them as encrypted secrets where available.
6. Confirm automatic payment capture in Razorpay. Complete a test-mode payment before switching the Cloudflare production secrets to Live Mode keys.
7. Before live use, add a Cloudflare rate-limiting rule for `/api/create-order` to reduce automated order spam. Cloudflare Free supports path-based rules counted by IP.

Cloudflare Pages Functions require Git integration or Wrangler deployment; dashboard Direct Upload does not deploy the `/functions` folder.

## Razorpay setup

Create or activate a Razorpay merchant account, generate API keys in Test Mode, then add them to Cloudflare as described above. The Key ID is returned to the checkout page; the Key Secret stays in the server environment. Before accepting real payments, finish a test checkout and verify that Razorpay shows the payment as captured. Follow Razorpay's [Standard Checkout integration steps](https://razorpay.com/docs/server-integration/python/test-app/) and Cloudflare's [Pages Functions guide](https://developers.cloudflare.com/pages/functions/get-started/).

Live payment processing is not active until valid merchant keys are set in Cloudflare. Do not paste API secrets into chat or commit them to the repository.

## Personal settings

Edit `config.js` to update your profile, social links, resume path and prices. Your portrait is `assets/sam-profile.jpg`, and the downloadable resume is `assets/sam-jebaraj-s-resume.pdf`. Project cards link to public repositories and read public language/star counts from GitHub; they do not access private repositories.

## Pricing and domain

Starting offers are ₹500, ₹2,500 and ₹5,000. Booking advances start at ₹300 and can be changed by the customer. The final project quote depends on scope. Domain registration and third-party services are separate. A `.com` needs paid registration and renewal; the free host provides a `pages.dev` address.
