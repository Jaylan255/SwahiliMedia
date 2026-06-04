(function () {
    const endpoint = "/swamedia2/api/security/log-client-event.php";
    const loggedRecently = new Map();

    const shouldSkip = () => {
        const path = window.location.pathname.toLowerCase();
        return path.includes("/admin");
    };

    if (shouldSkip()) {
        return;
    }

    const sendEvent = (eventType, details = {}) => {
        const key = `${eventType}:${details.key || ""}`;
        const now = Date.now();
        const previous = loggedRecently.get(key) || 0;

        if (now - previous < 5000) {
            return;
        }

        loggedRecently.set(key, now);
        const payload = JSON.stringify({
            eventType,
            details: {
                ...details,
                path: window.location.pathname,
                timestamp: now,
            },
        });

        if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
            return;
        }

        fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
            credentials: "same-origin",
        }).catch(() => {});
    };

    document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        sendEvent("context_menu");
    });

    document.addEventListener("copy", (event) => {
        event.preventDefault();
        sendEvent("copy_attempt");
    });

    document.addEventListener("selectstart", (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            return;
        }

        event.preventDefault();
        sendEvent("selection_attempt");
    });

    document.addEventListener("dragstart", (event) => {
        const target = event.target;
        if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
            event.preventDefault();
        }
    });

    window.addEventListener("keydown", (event) => {
        const key = String(event.key || "").toLowerCase();
        const ctrlOrMeta = event.ctrlKey || event.metaKey;

        if (ctrlOrMeta && (key === "c" || key === "s" || key === "p" || key === "u")) {
            event.preventDefault();
            const eventType = key === "c" ? "copy_attempt" : key === "p" ? "print_shortcut" : "save_shortcut";
            sendEvent(eventType, { key });
            return;
        }

        if (key === "f12" || (ctrlOrMeta && event.shiftKey && ["i", "j", "c"].includes(key))) {
            event.preventDefault();
            sendEvent("devtools_shortcut", { key });
        }
    });
})();
