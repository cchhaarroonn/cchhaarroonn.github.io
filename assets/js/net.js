// Multiplayer without a server.
// Visitors connect to each other peer-to-peer (WebRTC, found through public Nostr relays via Trystero).
// BroadcastChannel is used too, so two tabs in the same browser always see each other.
(() => {
    const APP_ID = "charon.gay/world/v1";
    const ROOM = "overworld";
    const TRYSTERO = "https://esm.run/trystero@0.25.4";

    const id = Math.random().toString(36).slice(2, 10);
    const handlers = {};
    const seen = new Set();
    let seq = 0, started = false, bc = null, action = null, online = false;

    function emit(type, data, from) {
        (handlers[type] || []).forEach((fn) => {
            try { fn(data, from); } catch (e) { console.error(e); }
        });
    }

    function deliver(msg) {
        if (!msg || typeof msg !== "object" || msg.from === id) return;
        if (msg.to && msg.to !== id) return;
        if (msg.u) {
            if (seen.has(msg.u)) return;           // same message via both channels
            seen.add(msg.u);
            if (seen.size > 5000) seen.clear();
        }
        emit(msg.type, msg.data, msg.from);
    }

    function send(type, data, to) {
        if (!started) return;
        const msg = { type, data, from: id, u: `${id}:${++seq}` };
        if (to) msg.to = to;
        if (bc) try { bc.postMessage(msg); } catch {}
        if (action) action.send(msg).catch(() => {});
    }

    async function start() {
        if (started) return;
        started = true;
        try {
            bc = new BroadcastChannel(APP_ID);
            bc.onmessage = (e) => deliver(e.data);
        } catch {}
        try {
            const { joinRoom } = await import(TRYSTERO);
            const room = joinRoom({ appId: APP_ID }, ROOM);
            action = room.makeAction("m");
            action.onMessage = (data) => deliver(data);
            room.onPeerJoin = () => emit("peer");
            online = true;
            emit("online");
        } catch (e) {
            console.warn("Multiplayer: internet peers unavailable, same-browser tabs only.", e);
        }
        addEventListener("pagehide", () => send("bye", {}));
    }

    window.Net = {
        id,
        start,
        send,
        on: (type, fn) => (handlers[type] = handlers[type] || []).push(fn),
        started: () => started,
        online: () => online,
    };
})();
