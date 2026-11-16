// Terminal client for TIL sandbox
// Initialized via htmx.onLoad so it works after HTMX swaps

(function () {
    "use strict";

    const TERMINAL_ATTR = "data-terminal";
    const INIT_ATTR = "data-terminal-init";

    function createTerminal(element) {
        if (element.hasAttribute(INIT_ATTR)) {
            return; // Already initialized
        }
        element.setAttribute(INIT_ATTR, "true");

        // Create xterm terminal
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", "Monospace"',
            theme: {
                background: "#1e1e1e",
                foreground: "#d4d4d4",
                cursor: "#ffffff",
                selectionBackground: "#264f78",
            },
            convertEol: true,
            scrollback: 1000,
        });

        // Load fit addon
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        // Open terminal in the element
        term.open(element);

        // Fit to element size
        fitAddon.fit();

        // Handle resize
        let resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
            const dims = term._core._renderService.dimensions;
            if (dims && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
            }
        });
        resizeObserver.observe(element);

        // Also handle window resize
        window.addEventListener("resize", () => {
            fitAddon.fit();
            const dims = term._core._renderService.dimensions;
            if (dims && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
            }
        });

        // Connect to WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            // Send initial resize
            const dims = term._core._renderService.dimensions;
            if (dims) {
                ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
            }
        };

        ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(event.data));
            } else if (typeof event.data === "string") {
                term.write(event.data);
            } else if (event.data instanceof Blob) {
                event.data.arrayBuffer().then((buf) => {
                    term.write(new Uint8Array(buf));
                });
            }
        };

        ws.onclose = (event) => {
            // Show disconnected message
            term.write("\r\n\x1b[31m[disconnected]\x1b[0m ");
            if (event.code !== 1000) {
                term.write(`(code ${event.code}: ${event.reason || "no reason"})`);
            }
            term.write("\r\n");

            // Offer reconnect
            const reconnectBtn = document.createElement("button");
            reconnectBtn.textContent = "Reconnect";
            reconnectBtn.style.cssText = "margin-top: 8px; padding: 4px 12px;";
            reconnectBtn.onclick = () => {
                reconnectBtn.remove();
                term.write("\r\n\x1b[33m[reconnecting...]\x1b[0m\r\n");
                // Re-initialize by removing the init attribute and letting htmx.onLoad re-run
                element.removeAttribute(INIT_ATTR);
                // Trigger a re-init by dispatching a custom event
                window.dispatchEvent(new CustomEvent("til:terminal-reconnect", { detail: { element } }));
            };
            term.write("\r\n");
            // We can't easily insert a button into xterm, so we'll use a different approach
            // Just log to console and let the user refresh or htmx will re-swap
            console.log("[terminal] Disconnected. Click 'Reconnect' or refresh the page.");
        };

        ws.onerror = (err) => {
            console.error("[terminal] WebSocket error:", err);
        };

        // Send input to server
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "input", data }));
            }
        });

        // Cleanup on element removal (htmx:beforeCleanupElement)
        function cleanup() {
            resizeObserver.disconnect();
            window.removeEventListener("resize", resizeHandler);
            ws.close(1000, "client cleanup");
            term.dispose();
            element.removeAttribute(INIT_ATTR);
            element.removeEventListener("htmx:beforeCleanupElement", cleanup);
        }

        function resizeHandler() {
            fitAddon.fit();
            const dims = term._core._renderService.dimensions;
            if (dims && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
            }
        }

        element.addEventListener("htmx:beforeCleanupElement", cleanup);

        // Store references for potential reconnect
        element._tilTerminal = { term, ws, fitAddon, resizeObserver, cleanup };
    }

    // Initialize all terminals on htmx:load (works after swaps)
    document.body.addEventListener("htmx:load", () => {
        document.querySelectorAll(`[${TERMINAL_ATTR}]`).forEach(createTerminal);
    });

    // Also initialize on initial page load (in case htmx:load doesn't fire for initial content)
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            document.querySelectorAll(`[${TERMINAL_ATTR}]`).forEach(createTerminal);
        });
    } else {
        document.querySelectorAll(`[${TERMINAL_ATTR}]`).forEach(createTerminal);
    }

    // Handle reconnect event
    window.addEventListener("til:terminal-reconnect", (e) => {
        if (e.detail?.element) {
            createTerminal(e.detail.element);
        }
    });
})();