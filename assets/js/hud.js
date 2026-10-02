// Minecraft-style HUD: hearts, XP bar, hotbar and a 3D first-person held item.
// All pixel art is original and drawn in code - no external textures.
(() => {
    /* ================= settings ================= */
    const LEVEL = 69;          // number above the XP bar
    const XP_FILL = 0.62;      // 0..1
    const HEARTS = 10;

    // player heads in the hotbar - clicking one opens the link
    const HEADS = {
        steam:   { name: "Steam",   color: "#1b2838", logo: "charon/assets/img/steam.png",
                   url: "https://steamcommunity.com/id/charongod/" },
        discord: { name: "Discord", color: "#5865f2", logo: "charon/assets/img/discord.png",
                   action: () => document.getElementById("discord").click() },   // copies the tag
        github:  { name: "GitHub",  color: "#24292f", logo: "charon/assets/img/github.png",
                   url: "https://github.com/cchhaarroonn" },
    };

    const SLOTS = ["sword", "apple", "steam", "discord", "github", null, null, null, null];

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

    // tiny deterministic noise so block faces look textured
    function rand(seed) {
        return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    }
    function shade(hex, f) {
        const n = parseInt(hex.slice(1), 16);
        const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
        return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
    }

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

    /* ---------- apple ---------- */
    function appleGrid() {
        const g = grid(16, 16);
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                const dx = x - 7.5, dy = y - 9.5;
                if (dx * dx + dy * dy <= 27) g[y][x] = dx + dy > 3.5 ? "d" : "r";
            }
        g[4][7] = "."; g[4][8] = ".";
        g[7][5] = "w"; g[8][5] = "w"; g[7][6] = "w";
        g[2][8] = "s"; g[3][8] = "s";
        g[2][9] = "f"; g[1][10] = "f"; g[2][10] = "f";
        return outline(g);
    }
    const APPLE_PAL = { k: "#2a0808", r: "#d9262c", d: "#8f1418", w: "#ffb3b3", s: "#5b3a1c", f: "#4caa2e" };

    /* ---------- heart ---------- */
    function heartURL() {
        const inner = [".rr.rr.", "rwrrrrr", "rrrrrrr", ".rrrrd.", "..rdd..", "...d..."];
        const g = grid(9, 8);
        inner.forEach((row, y) => [...row].forEach((ch, x) => (g[y + 1][x + 1] = ch)));
        return gridCanvas(outline(g), { k: "#140404", r: "#e3262d", d: "#a8161b", w: "#ffd0d0" }).toDataURL();
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

    // isometric block icon for the hotbar
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
        sword: { name: "Charon's Sword", kind: "sprite", grid: swordGrid(), pal: SWORD_PAL },
        apple: { name: "Apple", kind: "sprite", grid: appleGrid(), pal: APPLE_PAL },
    };
    Object.entries(HEADS).forEach(([id, h], n) => {
        ITEMS[id] = { ...h, kind: "head", face: noiseFace(h.color, n + 1), side: noiseFace(h.color, n + 11), top: noiseFace(h.color, n + 21) };
    });
    Object.values(ITEMS).forEach((it) => {
        if (it.kind === "sprite") it.icon = gridCanvas(it.grid, it.pal).toDataURL();
    });

    /* ================= DOM ================= */
    const hud = document.getElementById("hud");
    const canvas3d = document.getElementById("hand3d");
    const hand2d = document.getElementById("hand");
    const held2d = document.getElementById("held");
    const heartsEl = document.getElementById("hearts");
    const hotbar = document.getElementById("hotbar");
    const itemName = document.getElementById("itemname");
    const vid = document.getElementById("vidarea");

    const heartSrc = heartURL();
    for (let i = 0; i < HEARTS; i++) {
        const img = new Image();
        img.src = heartSrc;
        img.alt = "";
        img.style.setProperty("--i", i);
        heartsEl.appendChild(img);
    }
    document.getElementById("level").textContent = LEVEL;
    document.getElementById("xpfill").style.width = XP_FILL * 100 + "%";

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

    // logos load async - then draw head faces + icons
    const headsReady = Promise.all(Object.keys(HEADS).map(async (id, n) => {
        const it = ITEMS[id];
        it.face = logoFace(it.color, await loadImage(it.logo), n + 1);
        it.icon = isoIcon(it.face, it.side, it.top);
        slotEls[SLOTS.indexOf(id)].firstChild.src = it.icon;
    }));

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
        if (it.url) window.open(it.url, "_blank", "noopener");
        else if (it.action) it.action();
    }

    /* ================= 3D first-person hand ================= */
    let view = null;

    // base pose of each item in front of the camera: position, rotation (radians), scale
    const POSE = {
        sprite: { pos: [0.55, -0.33, -0.95], rot: [-0.1, -0.75, 0.5], scale: 0.7 },
        apple:  { pos: [0.52, -0.3, -0.9], rot: [0.05, -0.55, 0.05], scale: 0.48 },
        head:   { pos: [0.55, -0.38, -0.95], rot: [0.18, -0.7, 0], scale: 0.42 },
        arm:    { pos: [0.62, -0.58, -0.72], rot: [-1.2, 0.35, 0.28], scale: 1 },
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
            const skin = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.7, 0.22),
                new THREE.MeshLambertMaterial({ color: 0xc48a63 }),
            );
            const sleeve = new THREE.Mesh(
                new THREE.BoxGeometry(0.235, 0.32, 0.235),
                new THREE.MeshLambertMaterial({ color: 0x2c2c34 }),
            );
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
            else { obj = voxelModel(it.grid, it.pal); pose = id === "apple" ? POSE.apple : POSE.sprite; }
            obj.scale.setScalar(pose.scale);
            obj.userData.pose = pose;
            obj.visible = false;
            holder.add(obj);
            return (models[key] = obj);
        };

        // rebuild heads once logos are in (their face texture changes)
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
            camera.fov = w / h < 1 ? 85 : 70;   // keep the hand a sensible size on phones
            camera.updateProjectionMatrix();
        }
        addEventListener("resize", resize);
        resize();

        function draw(o) {
            if (!current) return;
            const p = current.userData.pose;
            // pull the item in from the right edge on narrow (portrait) screens
            const squeeze = Math.min(1, camera.aspect / 1.5);
            current.position.set(p.pos[0] * squeeze + o.x, p.pos[1] + o.y, p.pos[2] + o.z);
            current.rotation.set(p.rot[0] + o.rx, p.rot[1] + o.ry, p.rot[2] + o.rz);
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

        // walking bob - figure-eight like a first-person game
        const phase = t * Math.PI * 1.7;
        const walk = reduced ? 0 : 1;
        o.x += Math.sin(phase) * 0.035 * walk;
        o.y += -Math.abs(Math.cos(phase)) * 0.035 * walk;
        o.rz += Math.sin(phase) * 0.03 * walk;

        // switching items: lower old one, swap, raise new one
        if (equipStart >= 0) {
            const p = Math.min((now - equipStart) / 320, 1);
            if (p >= 0.5 && shownItem !== SLOTS[selected]) setHeld(SLOTS[selected]);
            o.y -= (p < 0.5 ? ease(p * 2) : ease((1 - p) * 2)) * 0.6;
            if (p >= 1) equipStart = -1;
        }

        // attack swing - arcs toward the centre of the screen and back
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

        // camera bob on the background video
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

    function start() {
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

        document.addEventListener("mousedown", (e) => {
            if (e.button === 0 && !e.target.closest("#hotbar")) swing();
        });
        document.addEventListener("touchstart", (e) => {
            if (!e.target.closest("#hotbar")) swing();
        }, { passive: true });
        // clicking the world while holding a head "uses" it
        document.addEventListener("click", (e) => {
            const it = ITEMS[SLOTS[selected]];
            if (it && it.kind === "head" && !e.target.closest("#hotbar, a, button")) use(SLOTS[selected]);
        });
        document.addEventListener("wheel", (e) => select(selected + Math.sign(e.deltaY)), { passive: true });
        document.addEventListener("keydown", (e) => {
            if (e.key >= "1" && e.key <= "9") select(+e.key - 1);
        });

        requestAnimationFrame(frame);
    }

    window.HUD = { start, _pose: POSE };
})();
