import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup.js"],
        include: ["test/**/*.test.js"],
        globals: false,
        restoreMocks: true,
        // `threads` pool starved the worker handshake once we moved to TS
        // source (transform pushed startup past the 60s timeout). `forks`
        // with isolate:false runs all specs in one process — same shared-
        // module-state model the original Jasmine runner used, so the
        // describe blocks that mutate global jQuery state stay consistent.
        pool: "forks",
        isolate: false,
    },
});
