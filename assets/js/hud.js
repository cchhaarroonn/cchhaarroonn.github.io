// Minecraft-style HUD: hearts, hunger, XP bar, hotbar, chat and a 3D first-person held item.
// All pixel art is original and drawn in code - no external textures.
(() => {
    /* ================= settings ================= */
    const LEVEL = 69;          // number above the XP bar
    const XP_FILL = 0.62;      // 0..1
    const HEARTS = 10;
    const FOOD = 10;

    // player heads - clicking one opens the link
    const HEADS = {
        steam:   { name: "Steam",   color: "#1b2838", logo: "charon/assets/img/steam.png",
                   url: "https://steamcommunity.com/id/charongod/" },
        discord: { name: "Discord", color: "#5865f2", logo: "charon/assets/img/discord.png",
                   action: () => window.Site && Site.copyDiscord() },
        github:  { name: "GitHub",  color: "#24292f", logo: "charon/assets/img/github.png",
                   url: "https://github.com/cchhaarroonn" },
    };

    const SLOTS = ["sword", "disc", "pearl", "steam", "discord", "github", null, null, null];

    /* ================= pixel art helpers ================= */
    const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill("."));

    function outline(g) {
        const h = g.length, w = g[0].length, out = g.map((r) => r.slice());
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                if (g[y][x] !== ".") continue;
                const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
                    const c = g[y + dy] && g[y + dy][x + dx];
                    return c && c !== ".";
                });
                if (n) out[y][x] = "k";
            }
        return out;
    }

    function fromRows(rows, w, h, ox = 1, oy = 1) {
        const g = grid(w, h);
        rows.forEach((row, y) => [...row].forEach((ch, x) => (g[y + oy][x + ox] = ch)));
        return g;
    }

    function gridCanvas(g, pal) {
        const c = document.createElement("canvas");
        c.width = g[0].length;
        c.height = g.length;
        const ctx = c.getContext("2d");
        g.forEach((row, y) => row.forEach((ch, x) => {
            if (ch === "." || !pal[ch]) return;
            ctx.fillStyle = pal[ch];
            ctx.fillRect(x, y, 1, 1);
        }));
        return c;
    }

    function rand(seed) {
        return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    }
    function shade(hex, f) {
        const n = parseInt(hex.slice(1), 16);
        const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
        return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
    }

    /* ---------- theme: dirt background + crosshair cursor ---------- */
    (function theme() {
        const d = document.createElement("canvas");
        d.width = d.height = 16;
        const ctx = d.getContext("2d"), r = rand(7);
        const browns = ["#3b2a1d", "#4a3524", "#2f2117", "#55402c", "#3f2d1f"];
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = browns[Math.floor(r() * browns.length)];
                ctx.fillRect(x, y, 1, 1);
            }
        const ch = document.createElement("canvas");
        ch.width = ch.height = 19;
        const c2 = ch.getContext("2d");
        c2.fillStyle = "rgba(0,0,0,.55)";
        c2.fillRect(8, 1, 3, 17); c2.fillRect(1, 8, 17, 3);
        c2.fillStyle = "#fff";
        c2.fillRect(9, 2, 1, 15); c2.fillRect(2, 9, 15, 1);
        const root = document.documentElement.style;
        root.setProperty("--dirt", `url(${d.toDataURL()})`);
        root.setProperty("--cursor", `url(${ch.toDataURL()}) 9 9, crosshair`);
    })();

    /* ---------- sword ---------- */
    function swordGrid() {
        const g = grid(16, 16);
        g[1][14] = "w";
        for (let i = 0; i <= 8; i++) {
            const x = 13 - i, y = 2 + i;
            g[y][x] = "w";
            g[y][x + 1] = i === 0 ? "w" : "l";
        }
        [[3, 9], [4, 10], [5, 11], [6, 12], [7, 13]].forEach(([x, y]) => (g[y][x] = "g"));
        g[11][4] = "h"; g[12][3] = "h"; g[12][4] = "d";
        g[13][2] = "p"; g[13][3] = "d"; g[14][2] = "d";
        return outline(g);
    }
    const SWORD_PAL = { k: "#363b44", w: "#f2f2f2", l: "#a9b0b8", g: "#3d3d46", h: "#7a5230", d: "#4e321b", p: "#c9a04b" };

    /* ---------- music disc ---------- */
    function discGrid() {
        const g = grid(16, 16);
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                const r = Math.hypot(x - 7.5, y - 7.5);
                if (r > 6.6) continue;
                if (r < 0.9) g[y][x] = ".";
                else if (r < 2.4) g[y][x] = (x + y) % 3 ? "c" : "e";
                else if (r > 5.2 && r < 5.9) g[y][x] = "s";
                else if (r > 3.4 && r < 4.1) g[y][x] = "s";
                else g[y][x] = "b";
            }
        g[4][5] = "h"; g[5][4] = "h"; g[3][7] = "h";
        return outline(g);
    }
    const DISC_PAL = { k: "#0b0b0e", b: "#202027", s: "#34343e", h: "#6a6a78", c: "#b0379b", e: "#7a2069" };

    /* ---------- ender pearl ---------- */
    function pearlGrid() {
        const g = grid(16, 16);
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy);
                if (r > 5.3) continue;
                g[y][x] = r < 1.8 ? "c" : dx + dy > 2.5 ? "d" : "m";
            }
        g[5][5] = "w"; g[5][6] = "w"; g[6][5] = "w";
        g[7][8] = "e"; g[8][7] = "e";
        return outline(g);
    }
    const PEARL_PAL = { k: "#07211e", m: "#1f6f63", d: "#124a42", c: "#0b2f2b", w: "#9ff0de", e: "#2fb39a" };

    /* ---------- heart + food icons ---------- */
    function heartURL() {
        const g = fromRows([".rr.rr.", "rwrrrrr", "rrrrrrr", ".rrrrd.", "..rdd..", "...d..."], 9, 8);
        return gridCanvas(outline(g), { k: "#140404", r: "#e3262d", d: "#a8161b", w: "#ffd0d0" }).toDataURL();
    }
    function foodURL() {
        const g = fromRows([
            "...mmm.",
            "..mhmmm",
            "..mmmmm",
            ".bmmmmd",
            "b.bmdd.",
            ".bb....",
            "b......",
        ], 9, 9);
        return gridCanvas(outline(g), { k: "#1a0e05", m: "#b8662e", h: "#e8a066", d: "#7a3f17", b: "#f0e6d2" }).toDataURL();
    }

    /* ---------- player heads ---------- */
    function loadImage(src) {
        return new Promise((res) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => res(null);
            i.src = src;
        });
    }

    function noiseFace(color, seed) {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const ctx = c.getContext("2d"), r = rand(seed);
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = shade(color, 0.86 + r() * 0.28);
                ctx.fillRect(x, y, 1, 1);
            }
        return c;
    }

    function logoFace(color, img, seed) {
        const c = noiseFace(color, seed);
        if (img) {
            const ctx = c.getContext("2d");
            const s = 12, w = img.width >= img.height ? s : (s * img.width) / img.height;
            const h = img.width >= img.height ? (s * img.height) / img.width : s;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(img, (16 - w) / 2, (16 - h) / 2, w, h);
        }
        return c;
    }

    function isoIcon(face, side, top) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        const T = [32, 5], R = [59, 18.5], C = [32, 32], L = [5, 18.5], H = 27;
        const quad = (img, O, u, v, dark) => {
            ctx.setTransform(u[0] / 16, u[1] / 16, v[0] / 16, v[1] / 16, O[0], O[1]);
            ctx.drawImage(img, 0, 0);
            if (dark) {
                ctx.fillStyle = `rgba(0,0,0,${dark})`;
                ctx.fillRect(0, 0, 16, 16);
            }
        };
        quad(top, L, [T[0] - L[0], T[1] - L[1]], [C[0] - L[0], C[1] - L[1]], 0);
        quad(face, L, [C[0] - L[0], C[1] - L[1]], [0, H], 0.12);
        quad(side, C, [R[0] - C[0], R[1] - C[1]], [0, H], 0.35);
        return c.toDataURL();
    }

    /* ================= items ================= */
    const ITEMS = {
        sword: { name: "Charon's Sword", kind: "sprite", pose: "sword", grid: swordGrid(), pal: SWORD_PAL },
        disc:  { name: "Music Disc", kind: "sprite", pose: "item", grid: discGrid(), pal: DISC_PAL,
                 action: () => window.Site && Site.cycleMusic() },
        pearl: { name: "Ender Pearl", kind: "sprite", pose: "item", grid: pearlGrid(), pal: PEARL_PAL,
                 action: () => window.Site && Site.teleport() },
    };
    Object.entries(HEADS).forEach(([id, h], n) => {
        ITEMS[id] = { ...h, kind: "head", face: noiseFace(h.color, n + 1), side: noiseFace(h.color, n + 11), top: noiseFace(h.color, n + 21) };
    });
    Object.values(ITEMS).forEach((it) => {
        if (it.kind === "sprite") it.icon = gridCanvas(it.grid, it.pal).toDataURL();
    });

    /* ================= DOM ================= */
    const $ = (id) => document.getElementById(id);
    const hud = $("hud"), canvas3d = $("hand3d"), hand2d = $("hand"), held2d = $("held");
    const hotbar = $("hotbar"), itemName = $("itemname"), nowPlaying = $("nowplaying");
    const chat = $("chat"), flash = $("flash"), vid = $("vidarea");

    function icons(el, src, n) {
        for (let i = 0; i < n; i++) {
            const img = new Image();
            img.src = src;
            img.alt = "";
            img.style.setProperty("--i", i);
            el.appendChild(img);
        }
    }
    icons($("hearts"), heartURL(), HEARTS);
    icons($("food"), foodURL(), FOOD);
    $("level").textContent = LEVEL;
    $("xpfill").style.width = XP_FILL * 100 + "%";

    const slotEls = SLOTS.map((id, i) => {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "slot";
        slot.title = id ? ITEMS[id].name : `Slot ${i + 1}`;
        if (id) {
            const img = new Image();
            img.alt = ITEMS[id].name;
            if (ITEMS[id].icon) img.src = ITEMS[id].icon;
            slot.appendChild(img);
        }
        slot.addEventListener("click", (e) => {
            e.stopPropagation();
            select(i);
            use(SLOTS[i]);
        });
        hotbar.appendChild(slot);
        return slot;
    });

    const headsReady = Promise.all(Object.keys(HEADS).map(async (id, n) => {
        const it = ITEMS[id];
        it.face = logoFace(it.color, await loadImage(it.logo), n + 1);
        it.icon = isoIcon(it.face, it.side, it.top);
        slotEls[SLOTS.indexOf(id)].firstChild.src = it.icon;
    }));

    /* ================= chat / messages ================= */
    function say(text, color = "#fff") {
        const line = document.createElement("div");
        line.className = "chatline";
        line.style.color = color;
        line.textContent = text;
        chat.appendChild(line);
        while (chat.children.length > 6) chat.firstChild.remove();
        setTimeout(() => line.classList.add("fade"), 8000);
        setTimeout(() => line.remove(), 9000);
    }

    let npTimer;
    function showNowPlaying(title) {
        nowPlaying.textContent = title ? `Now Playing: ${title}` : "";
        nowPlaying.classList.toggle("show", !!title);
        clearTimeout(npTimer);
        npTimer = setTimeout(() => nowPlaying.classList.remove("show"), 4500);
    }

    function teleportFlash() {
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
    }

    /* ================= state ================= */
    let selected = 0;
    let shownItem = null;
    let equipStart = -1;
    let swingStart = -1;
    let nameTimer;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function showName(text) {
        itemName.textContent = text || "";
        itemName.classList.toggle("show", !!text);
        clearTimeout(nameTimer);
        nameTimer = setTimeout(() => itemName.classList.remove("show"), 1800);
    }

    function select(i) {
        i = ((i % 9) + 9) % 9;
        if (i === selected) return;
        selected = i;
        slotEls.forEach((s, n) => s.classList.toggle("sel", n === i));
        equipStart = performance.now();
        showName(SLOTS[i] && ITEMS[SLOTS[i]].name);
    }

    function use(id) {
        const it = id && ITEMS[id];
        if (!it) return;
        if (it.url) {
            window.open(it.url, "_blank", "noopener");
            say(`Opening ${it.name}...`, "#aaa");
        } else if (it.action) it.action();
    }

    /* ================= 3D first-person hand ================= */
    let view = null;

    // base pose of each item in front of the camera: position, rotation (radians), scale
    const POSE = {
        sword: { pos: [0.55, -0.33, -0.95], rot: [-0.1, -0.75, 0.5], scale: 0.7 },
        item:  { pos: [0.52, -0.32, -0.9], rot: [0.05, -0.55, 0.05], scale: 0.38 },
        head:  { pos: [0.55, -0.38, -0.95], rot: [0.18, -0.7, 0], scale: 0.42 },
        arm:   { pos: [0.62, -0.58, -0.72], rot: [-1.2, 0.35, 0.28], scale: 1 },
    };

    function init3D() {
        if (!window.THREE || !canvas3d) return null;
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: true, antialias: true });
        } catch {
            return null;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 0.7);
        sun.position.set(-0.4, 1, 0.8);
        scene.add(sun);
        const holder = new THREE.Group();
        scene.add(holder);

        const tex = (c) => {
            const t = new THREE.CanvasTexture(c);
            t.magFilter = THREE.NearestFilter;
            t.minFilter = THREE.NearestFilter;
            return t;
        };

        // extrudes a pixel sprite into 1px-thick voxels, like items in first person
        function voxelModel(g, pal) {
            const cells = [];
            g.forEach((row, y) => row.forEach((c, x) => { if (c !== "." && pal[c]) cells.push([x, y, c]); }));
            const mesh = new THREE.InstancedMesh(
                new THREE.BoxGeometry(1 / 16, 1 / 16, 1 / 16),
                new THREE.MeshLambertMaterial(),
                cells.length,
            );
            const m = new THREE.Matrix4(), col = new THREE.Color();
            cells.forEach(([x, y, c], i) => {
                mesh.setMatrixAt(i, m.makeTranslation((x - 7.5) / 16, (7.5 - y) / 16, 0));
                mesh.setColorAt(i, col.set(pal[c]));
            });
            return mesh;
        }

        function headModel(it) {
            const side = new THREE.MeshLambertMaterial({ map: tex(it.side) });
            const top = new THREE.MeshLambertMaterial({ map: tex(it.top) });
            const face = new THREE.MeshLambertMaterial({ map: tex(it.face) });
            return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [side, side, top, side, face, side]);
        }

        function armModel() {
            const g = new THREE.Group();
            const skin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), new THREE.MeshLambertMaterial({ color: 0xc48a63 }));
            const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.32, 0.235), new THREE.MeshLambertMaterial({ color: 0x2c2c34 }));
            sleeve.position.y = -0.22;
            g.add(skin, sleeve);
            return g;
        }

        const models = {};
        let current = null;

        const modelFor = (id) => {
            const key = id || "arm";
            if (models[key]) return models[key];
            const it = ITEMS[id];
            let obj, pose;
            if (!id) { obj = armModel(); pose = POSE.arm; }
            else if (it.kind === "head") { obj = headModel(it); pose = POSE.head; }
            else { obj = voxelModel(it.grid, it.pal); pose = POSE[it.pose]; }
            obj.scale.setScalar(pose.scale);
            obj.userData.pose = pose;
            obj.visible = false;
            holder.add(obj);
            return (models[key] = obj);
        };

        headsReady.then(() => Object.keys(HEADS).forEach((id) => {
            if (!models[id]) return;
            const wasShown = current === models[id];
            holder.remove(models[id]);
            delete models[id];
            if (wasShown) { current = modelFor(id); current.visible = true; }
        }));

        function show(id) {
            if (current) current.visible = false;
            current = modelFor(id);
            current.visible = true;
        }

        function resize() {
            const w = innerWidth, h = innerHeight;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.fov = w / h < 1 ? 85 : 70;
            camera.updateProjectionMatrix();
        }
        addEventListener("resize", resize);
        resize();

        const now = () => performance.now();

        function draw(o) {
            if (!current) return;
            const p = current.userData.pose;
            const squeeze = Math.min(1, camera.aspect / 1.5);          // pull in on portrait screens
            const drop = camera.aspect < 1 ? 0.14 : 0;                  // and sit a bit lower
            current.position.set(p.pos[0] * squeeze + o.x, p.pos[1] - drop + o.y, p.pos[2] + o.z);
            current.rotation.set(p.rot[0] + o.rx, p.rot[1] + o.ry, p.rot[2] + o.rz);
            if (shownItem === "disc") current.rotation.z += window.Site && Site.musicOn() ? -now() / 500 : 0;
            renderer.render(scene, camera);
        }

        return { show, draw };
    }

    function setHeld(id) {
        shownItem = id;
        if (view) view.show(id);
        else {
            hand2d.classList.toggle("empty", !id);
            if (id) held2d.src = ITEMS[id].icon;
        }
    }

    /* ================= animation loop ================= */
    const ease = (t) => t * t * (3 - 2 * t);

    function frame(now) {
        const t = now / 1000;
        const o = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

        const phase = t * Math.PI * 1.7;
        const walk = reduced ? 0 : 1;
        o.x += Math.sin(phase) * 0.035 * walk;
        o.y += -Math.abs(Math.cos(phase)) * 0.035 * walk;
        o.rz += Math.sin(phase) * 0.03 * walk;

        if (equipStart >= 0) {
            const p = Math.min((now - equipStart) / 320, 1);
            if (p >= 0.5 && shownItem !== SLOTS[selected]) setHeld(SLOTS[selected]);
            o.y -= (p < 0.5 ? ease(p * 2) : ease((1 - p) * 2)) * 0.6;
            if (p >= 1) equipStart = -1;
        }

        if (swingStart >= 0) {
            const p = Math.min((now - swingStart) / 300, 1);
            const s1 = Math.sin(Math.sqrt(p) * Math.PI), s2 = Math.sin(p * Math.PI);
            o.x += -0.32 * s1;
            o.y += 0.16 * Math.sin(Math.sqrt(p) * Math.PI * 2);
            o.z += -0.18 * s2;
            o.rx += -0.9 * s1;
            o.ry += 0.5 * Math.sin(p * p * Math.PI);
            o.rz += 0.35 * s1;
            if (p >= 1) swingStart = -1;
        }

        if (view) view.draw(o);
        else {
            const size = hand2d.offsetWidth || 300;
            hand2d.style.transform =
                `translate(${o.x * size}px, ${-o.y * size}px) rotate(${(-o.rz - o.rx * 0.5) * 57}deg)`;
        }

        if (vid && !reduced) {
            vid.style.transform =
                `scale(1.12) translate(${o.x * 40}px, ${-o.y * 60}px) rotate(${o.rz * 8}deg)`;
        }
        requestAnimationFrame(frame);
    }

    /* ================= input ================= */
    function swing() {
        if (swingStart < 0 || performance.now() - swingStart > 150) swingStart = performance.now();
    }

    function start(where) {
        view = init3D();
        const el = view ? canvas3d : hand2d;
        hud.hidden = false;
        el.hidden = false;
        requestAnimationFrame(() => {
            hud.classList.add("on");
            el.classList.add("on");
        });
        slotEls[0].classList.add("sel");
        setHeld(SLOTS[0]);
        showName(ITEMS[SLOTS[0]].name);

        say(`${where ? `Someone from ${where}` : "Someone"} joined the game`, "#ffff55");
        setTimeout(() => say("Use 1-9 or scroll to switch items, click to use them", "#aaaaaa"), 1500);

        document.addEventListener("mousedown", (e) => {
            if (e.button === 0 && !e.target.closest("#hotbar")) swing();
        });
        document.addEventListener("touchstart", (e) => {
            if (!e.target.closest("#hotbar")) swing();
        }, { passive: true });
        // clicking the world uses whatever you're holding (heads, disc, pearl)
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#hotbar, a, button")) use(SLOTS[selected]);
        });
        document.addEventListener("wheel", (e) => select(selected + Math.sign(e.deltaY)), { passive: true });
        document.addEventListener("keydown", (e) => {
            if (e.key >= "1" && e.key <= "9") select(+e.key - 1);
        });

        requestAnimationFrame(frame);
    }

    window.HUD = { start, say, showNowPlaying, teleportFlash, _pose: POSE };
})();
