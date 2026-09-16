import { defineConfig } from "vitest/config"
export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/system/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
		fileParallelism: false,
		hookTimeout: 20000
	}
})
