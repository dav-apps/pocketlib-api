import type Stripe from "stripe"
import type { ResolverContext } from "./types.js"

export interface AppDependencies
	extends Pick<ResolverContext, "prisma" | "redis" | "resend"> {
	stripe: Stripe
	webhookKey: string
}
