# Stripe Membership Setup

Required Vercel variables:

- STRIPE_SECRET_KEY
- STRIPE_PRICE_ID
- STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SUPABASE_URL

Webhook URL:

https://storytuner.vercel.app/api/stripe/webhook

Events:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

The app reads membership from Supabase. Stripe webhooks are the source of truth.
