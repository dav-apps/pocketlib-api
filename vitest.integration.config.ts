import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/integration/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
		restoreMocks: true,
		fileParallelism: false,
		hookTimeout: 15000
	}
})
