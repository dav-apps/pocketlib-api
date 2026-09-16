import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/unit/**/*.test.ts", "tests/http/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
		restoreMocks: true,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: ["src/scripts/**", "src/standardebooks.ts", "src/types.ts"],
			reporter: ["text", "html"]
		}
	}
})
