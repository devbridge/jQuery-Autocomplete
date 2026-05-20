import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup.js"],
        include: ["test/**/*.test.js"],
        globals: false,
        restoreMocks: true,
        // The `forks` pool (Vitest 4 default on Windows) starves the worker
        // ready handshake when the setup file does heavy synchronous work
        // (jQuery + mockjax + UMD plugin load). `threads` keeps it in-process.
        pool: "threads",
    },
});
