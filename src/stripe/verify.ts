import type Stripe from "stripe";
import { stripe } from "./client.ts";

export async function verifyWebhook(
  rawBody: string,
  signature: string | null,
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return (await stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    secret,
  )) as Stripe.Event;
}
