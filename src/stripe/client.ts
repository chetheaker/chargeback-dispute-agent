import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.warn(
    "[stripe] STRIPE_SECRET_KEY not set — submission calls will fail.",
  );
}

export const stripe = new Stripe(key ?? "sk_test_missing", {
  apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
});
