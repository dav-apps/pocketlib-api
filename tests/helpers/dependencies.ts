import { vi } from "vitest"
import type { AppDependencies } from "../../src/appDependencies.js"

export function testDependencies(): AppDependencies {
	return {
		// These methods must never be reached by unauthenticated requests.
		prisma: {
			publisher: {
				findFirst: vi.fn(() => {
					throw new Error("Unexpected database read")
				}),
				create: vi.fn(() => {
					throw new Error("Unexpected database write")
				})
			}
		} as unknown as AppDependencies["prisma"],
		redis: {
			get: vi.fn(() => {
				throw new Error("Unexpected cache access")
			})
		} as unknown as AppDependencies["redis"],
		resend: {
			emails: {
				send: vi.fn(() => {
					throw new Error("Unexpected email")
				})
			}
		} as unknown as AppDependencies["resend"],
		stripe: {} as AppDependencies["stripe"],
		webhookKey: "test-webhook-key"
	}
}
