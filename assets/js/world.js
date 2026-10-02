// 3D voxel world: walk around inside a box whose walls play the background video.
// Multiplayer, ambilight, portals, mobs, commands. All art is original and generated in code.
(() => {
    /* ================= block textures ================= */
    function rand(seed) {
        return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    }
    function canvas16() {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        return c;
    }
    function noiseTex(colors, seed, extra) {
        const c = canvas16(), ctx = c.getContext("2d"), r = rand(seed);
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = colors[Math.floor(r() * colors.length)];
                ctx.fillRect(x, y, 1, 1);
            }
        if (extra) extra(ctx, r);
        return c;
    }

    const DIRT_C = ["#866043", "#7a573c", "#93694a", "#6c4d35"];
    const GRASS_C = ["#5d9b34", "#6aab3b", "#548d2e", "#73b443"];

    const T = {
        grassTop: noiseTex(GRASS_C, 11),
        grassSide: noiseTex(DIRT_C, 12, (ctx, r) => {
            for (let x = 0; x < 16; x++) {
                const h = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
                for (let y = 0; y < h; y++) {
                    ctx.fillStyle = GRASS_C[Math.floor(r() * GRASS_C.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }),
        dirt: noiseTex(DIRT_C, 13),
        stone: noiseTex(["#7f7f7f", "#747474", "#8a8a8a", "#6b6b6b", "#7a7a7a"], 14),
        bedrock: noiseTex(["#565656", "#2e2e2e", "#7a7a7a", "#1f1f1f", "#444"], 15),
        planks: noiseTex(["#a2824e", "#9c7b49", "#a88954", "#977748"], 16, (ctx, r) => {
            ctx.fillStyle = "#6f5530";
            for (let k = 0; k < 4; k++) {
                ctx.fillRect(0, k * 4 + 3, 16, 1);
                ctx.fillRect(Math.floor(r() * 16), k * 4, 1, 3);
            }
        }),
        logSide: noiseTex(["#6b5130"], 17, (ctx, r) => {
            for (let x = 0; x < 16; x++)
                for (let y = 0; y < 16; y++) {
                    const dark = x % 4 === 0 || r() < 0.18;
                    ctx.fillStyle = dark ? "#4d3a22" : r() < 0.5 ? "#6b5130" : "#5f4729";
                    ctx.fillRect(x, y, 1, 1);
                }
        }),
        logTop: noiseTex(["#b8945f"], 18, (ctx) => {
            for (let x = 0; x < 16; x++)
                for (let y = 0; y < 16; y++) {
                    const edge = x === 0 || y === 0 || x === 15 || y === 15;
                    const ring = Math.floor(Math.hypot(x - 7.5, y - 7.5) / 1.6) % 2;
                    ctx.fillStyle = edge ? "#5f4729" : ring ? "#a07f4c" : "#b8945f";
                    ctx.fillRect(x, y, 1, 1);
                }
        }),
        leaves: noiseTex(["#3f7f2a", "#356e23", "#4a8f31", "#2d5f1e"], 19, (ctx, r) => {
            for (let i = 0; i < 34; i++) ctx.clearRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
        }),
        crystal: noiseTex(["#5ff5ff", "#3fd8f0", "#8ffcff", "#2bb7d6"], 20, (ctx) => {
            ctx.fillStyle = "#c9fdff";
            [[3, 3], [4, 3], [3, 4], [11, 9], [12, 9], [11, 10], [7, 12]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
            ctx.fillStyle = "#1f8fae";
            for (let i = 0; i < 16; i++) { ctx.fillRect(i, 0, 1, 1); ctx.fillRect(i, 15, 1, 1); ctx.fillRect(0, i, 1, 1); ctx.fillRect(15, i, 1, 1); }
        }),
        basalt: noiseTex(["#2a2433", "#221d2a", "#332b3e", "#1b1722"], 21, (ctx, r) => {
            ctx.fillStyle = "#4b3d5e";
            for (let i = 0; i < 10; i++) ctx.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
        }),
    };

    const AIR = 0, BEDROCK = 1, DIRT = 2, GRASS = 3, STONE = 4, PLANKS = 5, LOG = 6, LEAVES = 7, CRYSTAL = 8, BASALT = 9;
    const all = (t) => [t, t, t, t, t, t];
    // faces: +x, -x, +y (top), -y (bottom), +z, -z
    const BLOCKS = {
        [BEDROCK]: { name: "Bedrock", faces: all(T.bedrock), color: "#3a3a3a", unbreakable: true },
        [DIRT]:    { name: "Dirt", faces: all(T.dirt), color: "#866043" },
        [GRASS]:   { name: "Grass Block", faces: [T.grassSide, T.grassSide, T.grassTop, T.dirt, T.grassSide, T.grassSide], color: "#5d9b34" },
        [STONE]:   { name: "Stone", faces: all(T.stone), color: "#7f7f7f" },
        [PLANKS]:  { name: "Oak Planks", faces: all(T.planks), color: "#a2824e" },
        [LOG]:     { name: "Oak Log", faces: [T.logSide, T.logSide, T.logTop, T.logTop, T.logSide, T.logSide], color: "#6b5130" },
        [LEAVES]:  { name: "Leaves", faces: all(T.leaves), color: "#3f7f2a", see: true },
        [CRYSTAL]: { name: "Charon Crystal", faces: all(T.crystal), color: "#5ff5ff", glow: true },
        [BASALT]:  { name: "Portal Frame", faces: all(T.basalt), color: "#2a2433", unbreakable: true },
    };

    window.Blocks = {
        ids: { BEDROCK, DIRT, GRASS, STONE, PLANKS, LOG, LEAVES, CRYSTAL, BASALT },
        info: BLOCKS,
    };

    /* ================= is WebGL available? ================= */
    const webgl = (() => {
        if (!window.THREE) return false;
        try {
            const c = document.createElement("canvas");
            return !!(c.getContext("webgl2") || c.getContext("webgl"));
        } catch {
            return false;
        }
    })();
    if (!webgl) {
        window.World = null;
        return;
    }

    /* ================= world data ================= */
    const W = 48, D = 48, H = 24, WALL_H = 27, GROUND = 4;
    const data = new Uint8Array(W * H * D);
    const idx = (x, y, z) => x + z * W + y * W * D;
    const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
    const edits = new Map();          // every block changed since generation (shared with other players)

    function get(x, y, z) {
        if (y < 0) return BEDROCK;
        if (y >= H) return AIR;
        if (x < 0 || z < 0 || x >= W || z >= D) return BEDROCK;   // the video walls are solid
        return data[idx(x, y, z)];
    }
    function set(x, y, z, t) {
        if (inside(x, y, z)) data[idx(x, y, z)] = t;
    }

    // the plaza in front of spawn: portals + "CHARON" in crystal letters
    const PLAZA = { x0: 4, x1: 44, z0: 18, z1: 45 };
    const inPlaza = (x, z) => x >= PLAZA.x0 && x <= PLAZA.x1 && z >= PLAZA.z0 && z <= PLAZA.z1;

    const PORTAL_Z = 31;
    const PORTALS = [
        { cx: 33, name: "Steam",   color: [27, 40, 56],   glow: [102, 192, 244], url: "https://steamcommunity.com/id/charongod/" },
        { cx: 24, name: "Discord", color: [88, 101, 242], glow: [200, 205, 255], action: () => window.Site && Site.copyDiscord() },
        { cx: 15, name: "GitHub",  color: [36, 41, 47],   glow: [230, 230, 230], url: "https://github.com/cchhaarroonn" },
    ];

    const FONT = {
        C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
        H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
        A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
        R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
        O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
        N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    };
    const WORD = "CHARON", WORD_Z = 41;

    function generate() {
        data.fill(AIR);
        const r = rand(1337);
        const bumps = Array.from({ length: 8 }, () => ({
            x: 4 + r() * (W - 8), z: 4 + r() * (D - 8), rad: 4 + r() * 6, h: 1 + Math.floor(r() * 3),
        }));
        const height = [];
        for (let x = 0; x < W; x++)
            for (let z = 0; z < D; z++) {
                let h = GROUND;
                for (const b of bumps) {
                    const f = Math.max(0, 1 - Math.hypot(x - b.x, z - b.z) / b.rad);
                    h += Math.round(b.h * f * f * 1.4);
                }
                if (Math.hypot(x - W / 2, z - D / 2) < 5 || inPlaza(x, z)) h = GROUND;
                h = Math.min(h, H - 8);
                height[x + z * W] = h;
                for (let y = 0; y < h; y++)
                    set(x, y, z, y === 0 ? BEDROCK : y === h - 1 ? GRASS : y >= h - 3 ? DIRT : STONE);
            }

        // trees (never in the plaza)
        for (let n = 0, tries = 0; n < 9 && tries < 300; tries++) {
            const x = 4 + Math.floor(r() * (W - 8)), z = 4 + Math.floor(r() * (D - 8));
            if (Math.hypot(x - W / 2, z - D / 2) < 8 || inPlaza(x - 2, z - 2) || inPlaza(x + 2, z + 2)) continue;
            const base = height[x + z * W], trunk = 4 + Math.floor(r() * 2), top = base + trunk;
            if (get(x, base - 1, z) !== GRASS) continue;
            for (let y = base; y < top; y++) set(x, y, z, LOG);
            for (let dy = -2; dy <= 1; dy++) {
                const rad = dy < 0 ? 2 : 1;
                for (let dx = -rad; dx <= rad; dx++)
                    for (let dz = -rad; dz <= rad; dz++) {
                        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && r() < 0.7) continue;
                        if (get(x + dx, top + dy, z + dz) === AIR) set(x + dx, top + dy, z + dz, LEAVES);
                    }
            }
            n++;
        }

        // "CHARON" in glowing crystal blocks, readable from spawn (screen-left is +x)
        const width = WORD.length * 6 - 1, x0 = Math.floor((W - width) / 2);
        [...WORD].forEach((ch, i) => FONT[ch].forEach((row, ry) => [...row].forEach((px, c) => {
            if (px !== "#") return;
            set(x0 + (width - 1 - (i * 6 + c)), GROUND + 6 - ry, WORD_Z, CRYSTAL);
        })));

        // portal frames: 4 wide, 5 tall
        for (const p of PORTALS)
            for (let dx = -2; dx <= 1; dx++)
                for (let dy = 0; dy < 5; dy++)
                    if (dx === -2 || dx === 1 || dy === 0 || dy === 4) set(p.cx + dx, GROUND + dy, PORTAL_Z, BASALT);
    }

    /* ================= rendering ================= */
    const canvas = document.getElementById("world");
    const vid = document.getElementById("vidarea");
    let renderer, scene, camera, ambient, meshes = {}, materials = {}, outline, stars, particles = [], pearls = [];
    const box = new THREE.BoxGeometry(1, 1, 1);
    const TINT = [0.62, 0.62, 1, 0.5, 0.82, 0.82];

    function texture(c) {
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        return t;
    }

    function buildMaterials() {
        for (const [id, b] of Object.entries(BLOCKS)) {
            materials[id] = b.faces.map((c, i) => {
                const m = new THREE.MeshBasicMaterial({ map: texture(c), alphaTest: b.see ? 0.5 : 0 });
                m.userData.tint = b.glow ? 1 : TINT[i];
                m.userData.glow = !!b.glow;
                m.color.setScalar(m.userData.tint);
                return m;
            });
        }
    }

    const see = (t) => t === AIR || (BLOCKS[t] && BLOCKS[t].see);

    function exposed(x, y, z) {
        return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => {
            const nx = x + dx, ny = y + dy, nz = z + dz;
            if (ny < 0 || nx < 0 || nz < 0 || nx >= W || nz >= D) return false;
            return see(get(nx, ny, nz));
        });
    }

    function rebuild() {
        const lists = {};
        for (let y = 0; y < H; y++)
            for (let z = 0; z < D; z++)
                for (let x = 0; x < W; x++) {
                    const t = data[idx(x, y, z)];
                    if (t === AIR || !exposed(x, y, z)) continue;
                    (lists[t] = lists[t] || []).push(x, y, z);
                }
        const m = new THREE.Matrix4();
        for (const id of Object.keys(BLOCKS)) {
            const list = lists[id] || [];
            const n = list.length / 3;
            let mesh = meshes[id];
            if (!mesh || mesh.userData.cap < n) {
                if (mesh) scene.remove(mesh);
                const cap = n + 512;
                mesh = new THREE.InstancedMesh(box, materials[id], cap);
                mesh.userData.cap = cap;
                mesh.frustumCulled = false;
                scene.add(mesh);
                meshes[id] = mesh;
            }
            for (let i = 0; i < n; i++) {
                mesh.setMatrixAt(i, m.makeTranslation(list[i * 3] + 0.5, list[i * 3 + 1] + 0.5, list[i * 3 + 2] + 0.5));
            }
            mesh.count = n;
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    function buildWalls() {
        const vt = new THREE.VideoTexture(vid);
        vt.minFilter = THREE.LinearFilter;
        vt.magFilter = THREE.LinearFilter;
        const mat = new THREE.MeshBasicMaterial({ map: vt });
        const geo = new THREE.PlaneGeometry(W, WALL_H);
        const y = GROUND - 1 + WALL_H / 2;
        [
            [W / 2, y, 0, 0],
            [W / 2, y, D, Math.PI],
            [0, y, D / 2, Math.PI / 2],
            [W, y, D / 2, -Math.PI / 2],
        ].forEach(([x, yy, z, ry]) => {
            const wall = new THREE.Mesh(geo, mat);
            wall.position.set(x, yy, z);
            wall.rotation.y = ry;
            scene.add(wall);
        });
        const frameMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        [[W / 2, 0, W + 0.6, 0.6], [W / 2, D, W + 0.6, 0.6], [0, D / 2, 0.6, D + 0.6], [W, D / 2, 0.6, D + 0.6]].forEach(([x, z, sx, sz]) => {
            const f = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.6, sz), frameMat);
            f.position.set(x, GROUND - 1 + WALL_H, z);
            scene.add(f);
        });
    }

    function addStars() {
        const pos = [], r = rand(99);
        for (let i = 0; i < 900; i++) {
            const a = r() * Math.PI * 2, e = 0.12 + r() * 1.3, R = 140;
            pos.push(W / 2 + Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, D / 2 + Math.sin(a) * Math.cos(e) * R);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true }));
        scene.add(stars);
    }

    /* ---------- text sprites (portal labels, name tags) ---------- */
    function textSprite(text, { size = 32, color = "#fff", bg = "rgba(0,0,0,.45)", scale = 0.01 } = {}) {
        const c = document.createElement("canvas"), ctx = c.getContext("2d");
        const font = `${size}px 'Press Start 2P', monospace`;
        ctx.font = font;
        const w = Math.ceil(ctx.measureText(text).width) + size, h = size * 1.8;
        c.width = w; c.height = h;
        ctx.font = font;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillText(text, size / 2 + 3, h / 2 + 3);
        ctx.fillStyle = color;
        ctx.fillText(text, size / 2, h / 2);
        const t = new THREE.CanvasTexture(c);
        t.minFilter = THREE.LinearFilter;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
        s.scale.set(w * scale, h * scale, 1);
        return s;
    }

    /* ---------- portals ---------- */
    function buildPortals() {
        PORTALS.forEach((p, i) => {
            const c = document.createElement("canvas");
            c.width = c.height = 32;
            p.canvas = c;
            p.ctx = c.getContext("2d");
            p.tex = new THREE.CanvasTexture(c);
            p.tex.magFilter = THREE.NearestFilter;
            const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 3),
                new THREE.MeshBasicMaterial({ map: p.tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
            );
            plane.position.set(p.cx, GROUND + 2.5, PORTAL_Z + 0.5);
            scene.add(plane);
            p.label = textSprite(p.name, { size: 40, color: `rgb(${p.glow.join(",")})`, scale: 0.012 });
            p.label.position.set(p.cx, GROUND + 6, PORTAL_Z + 0.5);
            scene.add(p.label);
            p.seed = i * 1000;
        });
    }

    function animatePortals(t) {
        for (const p of PORTALS) {
            const img = p.ctx.createImageData(32, 32), d = img.data;
            for (let y = 0; y < 32; y++)
                for (let x = 0; x < 32; x++) {
                    const dx = x - 15.5, dy = y - 15.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
                    const v = 0.5 + 0.5 * Math.sin(a * 3 + r * 0.45 - t * 3 + p.seed);
                    const w = 0.5 + 0.5 * Math.sin(r * 0.6 - t * 2);
                    const k = Math.min(1, v * 0.7 + w * 0.3);
                    const i = (y * 32 + x) * 4;
                    d[i] = p.color[0] + (p.glow[0] - p.color[0]) * k;
                    d[i + 1] = p.color[1] + (p.glow[1] - p.color[1]) * k;
                    d[i + 2] = p.color[2] + (p.glow[2] - p.color[2]) * k;
                    d[i + 3] = 230;
                }
            p.ctx.putImageData(img, 0, 0);
            p.tex.needsUpdate = true;
            p.label.position.y = GROUND + 6 + Math.sin(t * 2 + p.seed) * 0.15;
        }
    }

    function portalAt() {
        for (const p of PORTALS)
            if (P.x > p.cx - 1 && P.x < p.cx + 1 && P.z > PORTAL_Z - 0.2 && P.z < PORTAL_Z + 1.2 && P.y < GROUND + 4) return p;
        return null;
    }

    function usePortal(p) {
        if (p.url) {
            window.open(p.url, "_blank", "noopener");
            say(`Opening ${p.name}...`, "#aaaaaa");
        } else if (p.action) p.action();
        // bounce out of the portal so it doesn't re-trigger
        P.z = PORTAL_Z - 0.8; P.vz = -4;
    }

    /* ================= ambilight: the videos light the world ================= */
    const amb = { r: 1, g: 1, b: 1, tr: 1, tg: 1, tb: 1, bass: 0, ok: true, last: 0 };
    const sample = document.createElement("canvas");
    sample.width = 16; sample.height = 9;
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    let analyser = null, freq = null, capturedFrom = null, musicEl = null;

    function sampleVideo(now) {
        if (!amb.ok || now - amb.last < 120 || vid.readyState < 2) return;
        amb.last = now;
        try {
            sctx.drawImage(vid, 0, 0, 16, 9);
            const d = sctx.getImageData(0, 0, 16, 9).data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
            const n = d.length / 4;
            amb.tr = r / n / 255; amb.tg = g / n / 255; amb.tb = b / n / 255;
        } catch {
            amb.ok = false;
        }
    }

    // listen to whatever is playing (music disc or the video) without rerouting its sound
    function hookAudio() {
        const el = window.Site && Site.musicOn() ? (musicEl = musicEl || Site.musicElement && Site.musicElement()) : vid;
        if (!el || !el.captureStream || capturedFrom === el + (el.currentSrc || "")) return;
        try {
            const stream = el.captureStream();
            if (!stream.getAudioTracks().length) return;
            const ctx = hookAudio.ctx || (hookAudio.ctx = new (window.AudioContext || window.webkitAudioContext)());
            if (ctx.state === "suspended") ctx.resume().catch(() => {});
            if (hookAudio.src) hookAudio.src.disconnect();
            hookAudio.src = ctx.createMediaStreamSource(stream);
            analyser = analyser || ctx.createAnalyser();
            analyser.fftSize = 256;
            freq = freq || new Uint8Array(analyser.frequencyBinCount);
            hookAudio.src.connect(analyser);     // analyser only - not connected to the speakers
            capturedFrom = el + (el.currentSrc || "");
        } catch {}
    }

    function updateAmbilight(now, dt) {
        sampleVideo(now);
        if (now - (updateAmbilight.hook || 0) > 1500) { updateAmbilight.hook = now; hookAudio(); }
        let bass = 0;
        if (analyser) {
            analyser.getByteFrequencyData(freq);
            for (let i = 1; i < 7; i++) bass += freq[i];
            bass = Math.max(0, bass / 6 / 255 - 0.35) / 0.65;
        }
        amb.bass += (bass - amb.bass) * Math.min(1, dt * (bass > amb.bass ? 20 : 5));
        const k = Math.min(1, dt * 4);
        amb.r += (amb.tr - amb.r) * k; amb.g += (amb.tg - amb.g) * k; amb.b += (amb.tb - amb.b) * k;

        const pulse = 1 + amb.bass * 0.35;
        const f = (c) => (0.48 + 0.72 * c) * pulse;
        const fr = f(amb.r), fg = f(amb.g), fb = f(amb.b);
        for (const list of Object.values(materials))
            for (const m of list) {
                if (m.userData.glow) m.color.setScalar(0.85 + amb.bass * 0.6);
                else m.color.setRGB(m.userData.tint * fr, m.userData.tint * fg, m.userData.tint * fb);
            }
        ambient.color.setRGB(fr * 0.75, fg * 0.75, fb * 0.75);
        stars.material.size = 0.7 + amb.bass * 0.9;
    }

    /* ================= player ================= */
    const P = { x: W / 2 + 0.5, y: GROUND, z: D / 2 + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.PI, pitch: 0, onGround: false, kb: 0, fly: false };
    const keys = {};
    let state = "off";          // off | title | playing | paused | dead
    let mode = "single";
    let typing = false;
    let sprint = false, sneak = false, lastW = 0, lastSpace = 0;
    let walkDist = 0, bobAmt = 0, fov = 70, swingCount = 0;
    const isTouch = matchMedia("(pointer: coarse)").matches;
    const touchMove = { x: 0, y: 0 };

    const say = (msg, color) => window.HUD && HUD.say(msg, color);

    function spawn() {
        const x = Math.floor(W / 2), z = Math.floor(D / 2);
        let y = H - 1;
        while (y > 0 && get(x, y, z) === AIR) y--;
        Object.assign(P, { x: x + 0.5, y: y + 1, z: z + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.PI, pitch: 0, fly: false });
    }

    const height = () => (sneak && !P.fly ? 1.5 : 1.8);

    function boxHits(x, y, z, hw, h) {
        const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw);
        const y0 = Math.floor(y), y1 = Math.floor(y + h - 0.001);
        const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
        for (let bx = x0; bx <= x1; bx++)
            for (let by = y0; by <= y1; by++)
                for (let bz = z0; bz <= z1; bz++)
                    if (get(bx, by, bz) !== AIR) return true;
        return false;
    }
    const collides = (x, y, z) => boxHits(x, y, z, 0.3, height());

    function moveBody(b, hw, h, axis, d) {
        if (!d) return false;
        const steps = Math.ceil(Math.abs(d) / 0.01), s = d / steps;
        for (let i = 0; i < steps; i++) {
            const n = { x: b.x, y: b.y, z: b.z };
            n[axis] += s;
            if (boxHits(n.x, n.y, n.z, hw, h)) return true;
            b[axis] = n[axis];
        }
        return false;
    }
    const move = (axis, d) => moveBody(P, 0.3, height(), axis, d);

    function updatePlayer(dt) {
        let fx = 0, fz = 0;
        if (keys.KeyW || keys.ArrowUp) fz -= 1;
        if (keys.KeyS || keys.ArrowDown) fz += 1;
        if (keys.KeyA || keys.ArrowLeft) fx -= 1;
        if (keys.KeyD || keys.ArrowRight) fx += 1;
        fx += touchMove.x;
        fz += touchMove.y;
        const len = Math.hypot(fx, fz);
        if (len > 1) { fx /= len; fz /= len; }
        sneak = !!(keys.ControlLeft || keys.ControlRight || keys.KeyC);
        if (keys.ShiftLeft || keys.ShiftRight) sprint = fz < 0 && !sneak;
        else if (fz >= 0 || sneak) sprint = false;

        const speed = (P.fly ? 1.8 : 1) * (sneak && !P.fly ? 1.3 : sprint ? 5.6 : 4.3);
        const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
        const tx = (fx * cos + fz * sin) * speed;
        const tz = (-fx * sin + fz * cos) * speed;
        P.kb = Math.max(0, P.kb - dt);
        const k = Math.min(1, dt * (P.kb > 0 ? 1 : P.onGround || P.fly ? 12 : 3));
        P.vx += (tx - P.vx) * k;
        P.vz += (tz - P.vz) * k;

        if (P.fly) {
            const up = (keys.Space || touchJump ? 1 : 0) - (sneak ? 1 : 0);
            P.vy += (up * 7 - P.vy) * Math.min(1, dt * 10);
        } else {
            P.vy = Math.max(P.vy - 32 * dt, -60);
            if ((keys.Space || touchJump) && P.onGround) {
                P.vy = 9;
                if (sprint) { P.vx *= 1.25; P.vz *= 1.25; }
            }
        }

        if (move("x", P.vx * dt)) P.vx = 0;
        if (move("z", P.vz * dt)) P.vz = 0;
        const hitY = move("y", P.vy * dt);
        P.onGround = false;
        if (hitY) {
            if (P.vy < 0) { P.onGround = true; if (P.fly) P.fly = false; }
            P.vy = 0;
        } else if (P.vy <= 0 && !P.fly && collides(P.x, P.y - 0.02, P.z)) P.onGround = true;

        if (P.y < -10) spawn();

        const hs = Math.hypot(P.vx, P.vz);
        if (P.onGround) walkDist += hs * dt;
        bobAmt += ((P.onGround && hs > 0.5 ? Math.min(1, hs / 4.3) : 0) - bobAmt) * Math.min(1, dt * 8);

        // portal prompt
        const p = portalAt();
        const prompt = document.getElementById("prompt");
        if (prompt) {
            prompt.hidden = !p;
            if (p) prompt.textContent = isTouch ? `Tap Use to enter ${p.name}` : `Press E to enter ${p.name}`;
        }
    }

    function updateCamera(now, dt) {
        if (state === "title" || state === "off") {
            const t = now / 1000;
            camera.position.set(W / 2 + Math.sin(t * 0.05) * 6, GROUND + 9, D / 2 + Math.cos(t * 0.05) * 6);
            camera.rotation.set(-0.18, t * 0.05 + Math.PI, 0);
            return;
        }
        const ph = walkDist * 1.6;
        const eye = sneak && !P.fly ? 1.27 : 1.62;
        const bx = Math.sin(ph) * 0.05 * bobAmt, by = -Math.abs(Math.cos(ph)) * 0.07 * bobAmt;
        camera.position.set(P.x + Math.cos(P.yaw) * bx, P.y + eye + by, P.z - Math.sin(P.yaw) * bx);
        camera.rotation.set(P.pitch, P.yaw, Math.sin(ph) * 0.006 * bobAmt);
        const want = sprint && Math.hypot(P.vx, P.vz) > 4.5 ? 80 : 70;
        fov += (want - fov) * Math.min(1, dt * 8);
        if (Math.abs(camera.fov - fov) > 0.01) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
    }

    /* ================= looking at things ================= */
    const eyeY = () => P.y + (sneak && !P.fly ? 1.27 : 1.62);

    function lookDir() {
        const v = new THREE.Vector3(0, 0, -1);
        v.applyEuler(new THREE.Euler(P.pitch, P.yaw, 0, "YXZ"));
        return v;
    }

    function raycast(maxDist = 5) {
        const o = { x: P.x, y: eyeY(), z: P.z };
        const d = lookDir();
        let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
        const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
        const dx = Math.abs(1 / d.x), dy = Math.abs(1 / d.y), dz = Math.abs(1 / d.z);
        let tx = d.x ? (sx > 0 ? x + 1 - o.x : o.x - x) * dx : Infinity;
        let ty = d.y ? (sy > 0 ? y + 1 - o.y : o.y - y) * dy : Infinity;
        let tz = d.z ? (sz > 0 ? z + 1 - o.z : o.z - z) * dz : Infinity;
        let n = [0, 0, 0], t = 0;
        while (t <= maxDist) {
            if (inside(x, y, z) && data[idx(x, y, z)] !== AIR) return { x, y, z, n, t };
            if (tx < ty && tx < tz) { x += sx; t = tx; tx += dx; n = [-sx, 0, 0]; }
            else if (ty < tz) { y += sy; t = ty; ty += dy; n = [0, -sy, 0]; }
            else { z += sz; t = tz; tz += dz; n = [0, 0, -sz]; }
        }
        return null;
    }

    // ray vs. a list of boxes {x,y,z,hw,h}
    function rayBoxes(list, maxDist) {
        const o = { x: P.x, y: eyeY(), z: P.z }, d = lookDir();
        let best = null;
        for (const e of list) {
            const min = [e.x - e.hw, e.y, e.z - e.hw], max = [e.x + e.hw, e.y + e.h, e.z + e.hw];
            let t0 = 0, t1 = maxDist, ok = true;
            ["x", "y", "z"].forEach((a, i) => {
                if (!ok) return;
                if (Math.abs(d[a]) < 1e-9) { if (o[a] < min[i] || o[a] > max[i]) ok = false; return; }
                let ta = (min[i] - o[a]) / d[a], tb = (max[i] - o[a]) / d[a];
                if (ta > tb) [ta, tb] = [tb, ta];
                t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
                if (t0 > t1) ok = false;
            });
            if (ok && (!best || t0 < best.t)) best = { e, t: t0 };
        }
        return best;
    }

    let target = null;
    function updateTarget() {
        target = state === "playing" ? raycast() : null;
        outline.visible = !!target;
        if (target) outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    }

    /* ================= blocks: change + sync ================= */
    function setBlock(x, y, z, t, fromNet) {
        if (!inside(x, y, z)) return;
        const old = data[idx(x, y, z)];
        if (old === t) return;
        data[idx(x, y, z)] = t;
        edits.set(`${x},${y},${z}`, t);
        if (t === AIR && BLOCKS[old]) burst(x, y, z, BLOCKS[old].color);
        rebuild();
        if (!fromNet && mode === "multi") Net.send("bk", [x, y, z, t]);
    }

    /* ================= particles ================= */
    function burst(x, y, z, color) {
        const mat = new THREE.MeshBasicMaterial({ color });
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat);
            m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
            scene.add(m);
            particles.push({ m, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4 + 1, vz: (Math.random() - 0.5) * 4, life: 0.6 + Math.random() * 0.3 });
        }
    }

    function updateParticles(dt) {
        particles = particles.filter((p) => {
            p.life -= dt;
            if (p.life <= 0) { scene.remove(p.m); return false; }
            p.vy -= 20 * dt;
            p.m.position.x += p.vx * dt;
            p.m.position.y += p.vy * dt;
            p.m.position.z += p.vz * dt;
            if (get(Math.floor(p.m.position.x), Math.floor(p.m.position.y), Math.floor(p.m.position.z)) !== AIR) {
                p.vy = 0; p.vx *= 0.5; p.vz *= 0.5;
            }
            return true;
        });
    }

    /* ================= actions ================= */
    function attack() {
        if (window.HUD) HUD.swing();
        swingCount++;
        const h = raycast();
        const mh = rayBoxes(mobs.map((m) => Object.assign(m, { hw: m.def.hw, h: m.def.h })), 4);
        const ph = rayBoxes([...players.values()].map((p) => ({ x: p.x, y: p.y, z: p.z, hw: 0.3, h: 1.8, p })), 4);
        const hits = [mh && { t: mh.t, fn: () => hitMob(mh.e) }, ph && { t: ph.t, fn: () => hitPlayer(ph.e.p) }]
            .filter(Boolean).sort((a, b) => a.t - b.t);
        if (hits.length && (!h || hits[0].t < h.t)) { hits[0].fn(); return; }
        if (!h) return;
        const t = data[idx(h.x, h.y, h.z)];
        if (BLOCKS[t] && BLOCKS[t].unbreakable) return;
        setBlock(h.x, h.y, h.z, AIR);
    }

    function place(type) {
        const h = raycast();
        if (!h) return;
        const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
        if (!inside(x, y, z) || data[idx(x, y, z)] !== AIR) return;
        data[idx(x, y, z)] = type;
        const blocked = collides(P.x, P.y, P.z);
        data[idx(x, y, z)] = AIR;
        if (blocked) return;
        if (window.HUD) HUD.swing();
        swingCount++;
        setBlock(x, y, z, type);
    }

    function useItem() {
        const p = portalAt();
        if (p) { usePortal(p); return; }
        if (!window.HUD) return;
        const id = HUD.selectedId();
        const block = HUD.blockOf(id);
        if (block) place(block);
        else if (id) HUD.useItem(id);
    }

    function throwPearl() {
        if (window.HUD) HUD.swing();
        swingCount++;
        const d = lookDir();
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0x1f6f63 }));
        m.position.set(P.x + d.x * 0.6, P.y + 1.5 + d.y * 0.6, P.z + d.z * 0.6);
        scene.add(m);
        pearls.push({ m, vx: d.x * 22, vy: d.y * 22 + 2, vz: d.z * 22, life: 6 });
    }

    function updatePearls(dt) {
        pearls = pearls.filter((p) => {
            p.life -= dt;
            const prev = p.m.position.clone();
            p.vy -= 20 * dt;
            p.m.position.x += p.vx * dt;
            p.m.position.y += p.vy * dt;
            p.m.position.z += p.vz * dt;
            p.m.rotation.x += dt * 8;
            p.m.rotation.y += dt * 6;
            const pos = p.m.position;
            const hit = get(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)) !== AIR;
            if (!hit && p.life > 0) return true;
            scene.remove(p.m);
            if (!hit) return false;
            let tx = Math.min(W - 0.4, Math.max(0.4, prev.x)), ty = Math.max(0, prev.y - 0.5), tz = Math.min(D - 0.4, Math.max(0.4, prev.z));
            for (let i = 0; i < 40 && collides(tx, ty, tz); i++) ty += 0.25;
            if (!collides(tx, ty, tz)) {
                Object.assign(P, { x: tx, y: ty, z: tz, vx: 0, vy: 0, vz: 0 });
                if (window.HUD) { HUD.teleportFlash(); HUD.damage(5, "Ender pearls hurt."); }
            }
            return false;
        });
    }

    /* ================= mobs (original designs) ================= */
    const MAX_MOBS = 12, SPAWN_EVERY = 20;
    let mobs = [], spawnTimer = 0;

    function part(g, w, h, d, color, x, y, z, opts = {}) {
        const mat = opts.glow
            ? new THREE.MeshBasicMaterial({ color })
            : new THREE.MeshLambertMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity || 1 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        g.add(m);
        return m;
    }
    function limb(g, w, h, d, color, x, y, z) {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, z);
        part(pivot, w, h, d, color, 0, -h / 2, 0);
        g.add(pivot);
        return pivot;
    }

    const MOBS = {
        shade: {
            name: "Shade", hostile: true, hp: 12, speed: 2.3, dmg: 3, hw: 0.3, h: 1.9, xp: 5, color: "#2b2140",
            build(g) {
                const legs = [limb(g, 0.24, 0.8, 0.24, "#15151d", -0.13, 0.8, 0), limb(g, 0.24, 0.8, 0.24, "#15151d", 0.13, 0.8, 0)];
                part(g, 0.52, 0.8, 0.3, "#2b2140", 0, 1.2, 0);
                part(g, 0.6, 0.12, 0.36, "#1d1630", 0, 0.86, 0);
                const arms = [limb(g, 0.2, 0.72, 0.2, "#2b2140", -0.36, 1.56, 0), limb(g, 0.2, 0.72, 0.2, "#2b2140", 0.36, 1.56, 0)];
                part(g, 0.5, 0.5, 0.5, "#3b3b4a", 0, 1.85, 0);
                part(g, 0.56, 0.16, 0.56, "#1d1630", 0, 2.1, 0);
                part(g, 0.1, 0.06, 0.02, "#7ffcff", -0.11, 1.88, 0.26, { glow: true });
                part(g, 0.1, 0.06, 0.02, "#7ffcff", 0.11, 1.88, 0.26, { glow: true });
                return { legs, arms };
            },
        },
        gloop: {
            name: "Gloop", hostile: true, hp: 8, speed: 3.2, dmg: 2, hw: 0.45, h: 0.9, xp: 3, hop: true, color: "#9a46d1",
            build(g) {
                part(g, 0.45, 0.45, 0.45, "#4b1872", 0, 0.42, 0);
                part(g, 0.9, 0.9, 0.9, "#9a46d1", 0, 0.45, 0, { opacity: 0.72 });
                part(g, 0.12, 0.14, 0.02, "#111", -0.18, 0.58, 0.46);
                part(g, 0.12, 0.14, 0.02, "#111", 0.18, 0.58, 0.46);
                part(g, 0.2, 0.05, 0.02, "#111", 0, 0.36, 0.46);
                return { legs: [], arms: [] };
            },
        },
        boar: {
            name: "Boar", hostile: false, hp: 10, speed: 1.5, hw: 0.45, h: 0.9, xp: 2, color: "#7b4f2e",
            build(g) {
                part(g, 0.7, 0.55, 1.0, "#7b4f2e", 0, 0.64, 0);
                part(g, 0.3, 0.1, 0.8, "#4a2e18", 0, 0.95, -0.05);
                part(g, 0.5, 0.45, 0.4, "#6e4527", 0, 0.72, 0.66);
                part(g, 0.26, 0.18, 0.08, "#4a2e18", 0, 0.64, 0.89);
                part(g, 0.05, 0.14, 0.05, "#eeeeee", -0.15, 0.56, 0.88);
                part(g, 0.05, 0.14, 0.05, "#eeeeee", 0.15, 0.56, 0.88);
                part(g, 0.07, 0.07, 0.02, "#111", -0.15, 0.82, 0.86);
                part(g, 0.07, 0.07, 0.02, "#111", 0.15, 0.82, 0.86);
                const legs = [[-0.22, 0.32], [0.22, 0.32], [-0.22, -0.32], [0.22, -0.32]]
                    .map(([x, z]) => limb(g, 0.18, 0.38, 0.18, "#5c3a20", x, 0.38, z));
                return { legs, arms: [], quad: true };
            },
        },
        duck: {
            name: "Duck", hostile: false, hp: 4, speed: 1.2, hw: 0.25, h: 0.7, xp: 1, color: "#f2f2f2",
            build(g) {
                part(g, 0.36, 0.3, 0.5, "#f2f2f2", 0, 0.38, 0);
                part(g, 0.2, 0.12, 0.14, "#dddddd", 0, 0.48, -0.3);
                part(g, 0.24, 0.26, 0.24, "#2f7d3a", 0, 0.64, 0.2);
                part(g, 0.16, 0.07, 0.14, "#f0a020", 0, 0.6, 0.38);
                part(g, 0.04, 0.04, 0.02, "#111", -0.08, 0.68, 0.33);
                part(g, 0.04, 0.04, 0.02, "#111", 0.08, 0.68, 0.33);
                const legs = [limb(g, 0.05, 0.24, 0.05, "#f0a020", -0.08, 0.24, 0), limb(g, 0.05, 0.24, 0.05, "#f0a020", 0.08, 0.24, 0)];
                return { legs, arms: [] };
            },
        },
    };

    function surfaceAt(x, z) {
        let y = H - 1;
        while (y > 0 && get(x, y, z) === AIR) y--;
        return y;
    }

    function spawnMob(type, near) {
        if (mobs.length >= MAX_MOBS) return null;
        const names = Object.keys(MOBS);
        type = MOBS[type] ? type : names[Math.floor(Math.random() * names.length)];
        const def = MOBS[type];
        for (let i = 0; i < 60; i++) {
            const x = near ? P.x + (Math.random() - 0.5) * 10 : 2 + Math.random() * (W - 4);
            const z = near ? P.z + (Math.random() - 0.5) * 10 : 2 + Math.random() * (D - 4);
            if (x < 1 || z < 1 || x > W - 1 || z > D - 1) continue;
            if (!near && Math.hypot(x - P.x, z - P.z) < 10) continue;
            if (near && Math.hypot(x - P.x, z - P.z) < 3) continue;
            const top = surfaceAt(Math.floor(x), Math.floor(z));
            if (get(Math.floor(x), top, Math.floor(z)) === LEAVES || top > H - 4) continue;
            if (boxHits(x, top + 1, z, def.hw, def.h)) continue;
            const g = new THREE.Group();
            const parts = def.build(g);
            g.traverse((o) => { if (o.material && o.material.emissive) o.userData.lambert = true; });
            scene.add(g);
            const m = { type, def, g, ...parts, x, y: top + 1, z, vx: 0, vy: 0, vz: 0, onGround: false, hp: def.hp,
                        yaw: Math.random() * 6.28, t: 0, dir: null, hurt: 0, panic: 0, kb: 0, cd: 0, hop: 0, walk: 0, squash: 1 };
            mobs.push(m);
            return m;
        }
        return null;
    }

    function removeMob(m) {
        scene.remove(m.g);
        mobs = mobs.filter((x) => x !== m);
    }
    function clearMobs() {
        mobs.slice().forEach(removeMob);
        spawnMob("boar");
        spawnMob("duck");
    }

    function hitMob(m) {
        const sword = window.HUD && HUD.selectedId() === "sword";
        m.hp -= sword ? (sprint ? 9 : 6) : 1;
        m.hurt = 0.3;
        const dx = m.x - P.x, dz = m.z - P.z, l = Math.hypot(dx, dz) || 1;
        m.vx = (dx / l) * 7; m.vz = (dz / l) * 7; m.vy = 5; m.kb = 0.35;
        if (!m.def.hostile) m.panic = 4;
        if (m.hp <= 0) {
            burst(m.x - 0.5, m.y + m.def.h / 2 - 0.5, m.z - 0.5, m.def.color);
            burst(m.x - 0.5, m.y + m.def.h / 2 - 0.5, m.z - 0.5, "#dddddd");
            removeMob(m);
            if (window.HUD) HUD.addXP(m.def.xp);
        }
    }

    function updateMobs(dt) {
        if (state === "playing") {
            spawnTimer += dt;
            if (spawnTimer >= SPAWN_EVERY) {
                spawnTimer = 0;
                const m = spawnMob();
                if (m) say(`A ${m.def.name} appeared somewhere...`, m.def.hostile ? "#ff8080" : "#aaaaaa");
            }
        }
        for (const m of mobs.slice()) {
            const def = m.def;
            const dx = P.x - m.x, dz = P.z - m.z, dist = Math.hypot(dx, dz) || 1;
            let tx = 0, tz = 0, sp = def.speed;
            const chasing = def.hostile && state === "playing" && dist < 18;
            if (chasing) { tx = dx / dist; tz = dz / dist; }
            else if (m.panic > 0) { m.panic -= dt; tx = -dx / dist; tz = -dz / dist; sp *= 2.2; }
            else {
                m.t -= dt;
                if (m.t <= 0) {
                    m.t = 2 + Math.random() * 3;
                    const a = Math.random() * Math.PI * 2;
                    m.dir = Math.random() < 0.35 ? null : [Math.sin(a), Math.cos(a)];
                }
                if (m.dir) { tx = m.dir[0]; tz = m.dir[1]; sp *= 0.5; }
            }

            m.kb = Math.max(0, m.kb - dt);
            if (def.hop) {
                m.hop -= dt;
                if (m.onGround && m.kb <= 0) {
                    m.vx = 0; m.vz = 0;
                    if (m.hop <= 0 && (tx || tz)) {
                        m.vy = 6.5; m.vx = tx * sp; m.vz = tz * sp;
                        m.hop = 0.6 + Math.random() * 0.8;
                    }
                }
            } else if (m.kb <= 0) {
                const k = Math.min(1, dt * (m.onGround ? 8 : 2));
                m.vx += (tx * sp - m.vx) * k;
                m.vz += (tz * sp - m.vz) * k;
            }

            m.vy = Math.max(m.vy - 28 * dt, -50);
            const hitX = moveBody(m, def.hw, def.h, "x", m.vx * dt);
            const hitZ = moveBody(m, def.hw, def.h, "z", m.vz * dt);
            const wasGround = m.onGround;
            const hitY = moveBody(m, def.hw, def.h, "y", m.vy * dt);
            m.onGround = false;
            if (hitY) { if (m.vy < 0) m.onGround = true; m.vy = 0; }
            else if (m.vy <= 0 && boxHits(m.x, m.y - 0.02, m.z, def.hw, def.h)) m.onGround = true;
            if ((hitX || hitZ) && m.onGround && !def.hop) m.vy = 7.5;
            if (!wasGround && m.onGround && def.hop) m.squash = 0.65;

            const hs = Math.hypot(m.vx, m.vz);
            if (hs > 0.2 && m.kb <= 0) {
                const want = Math.atan2(m.vx, m.vz);
                let diff = want - m.yaw;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                m.yaw += diff * Math.min(1, dt * 8);
            } else if (chasing) m.yaw = Math.atan2(dx, dz);

            m.walk += hs * dt * 5;
            const swing = Math.sin(m.walk) * 0.7 * Math.min(1, hs / 1.5);
            m.legs.forEach((l, i) => (l.rotation.x = (m.quad ? (i === 0 || i === 3) : i === 0) ? swing : -swing));
            m.arms.forEach((a, i) => (a.rotation.x = i === 0 ? -swing : swing));
            m.squash += (1 - m.squash) * Math.min(1, dt * 10);
            const air = def.hop && !m.onGround ? 1.12 : 1;
            m.g.scale.set(1 / Math.sqrt(m.squash * air), m.squash * air, 1 / Math.sqrt(m.squash * air));
            m.g.position.set(m.x, m.y, m.z);
            m.g.rotation.y = m.yaw;

            m.hurt = Math.max(0, m.hurt - dt);
            m.g.traverse((o) => { if (o.userData.lambert) o.material.emissive.setRGB(m.hurt > 0 ? 0.6 : 0, 0, 0); });

            m.cd = Math.max(0, m.cd - dt);
            if (def.hostile && state === "playing" && m.cd <= 0 &&
                dist < def.hw + 0.75 && P.y < m.y + def.h && m.y < P.y + 1.8) {
                m.cd = 1;
                P.vx = (dx / dist) * 7; P.vz = (dz / dist) * 7; P.vy = 5; P.kb = 0.3;
                if (window.HUD) HUD.damage(def.dmg, `Slain by a ${def.name}.`);
            }
        }
    }

    /* ================= multiplayer: other visitors ================= */
    const players = new Map();          // id -> remote player
    let myName = `Player${Math.floor(1000 + Math.random() * 9000)}`;
    let lastSent = 0, lastHit = null;

    const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

    function avatar(name, id) {
        const g = new THREE.Group();
        const shirt = new THREE.Color().setHSL(hue(id) / 360, 0.55, 0.45).getStyle();
        const legs = [limb(g, 0.24, 0.75, 0.24, "#26262c", -0.12, 0.75, 0), limb(g, 0.24, 0.75, 0.24, "#26262c", 0.12, 0.75, 0)];
        part(g, 0.5, 0.72, 0.26, shirt, 0, 1.11, 0);
        const arms = [limb(g, 0.22, 0.7, 0.22, "#d9a27c", -0.36, 1.45, 0), limb(g, 0.22, 0.7, 0.22, "#d9a27c", 0.36, 1.45, 0)];
        arms.forEach((a) => part(a, 0.24, 0.26, 0.24, shirt, 0, -0.12, 0));
        const head = new THREE.Group();
        head.position.set(0, 1.47, 0);
        part(head, 0.48, 0.48, 0.48, "#d9a27c", 0, 0.24, 0);
        part(head, 0.5, 0.14, 0.5, "#141014", 0, 0.44, 0);
        part(head, 0.08, 0.06, 0.02, "#1a1a1a", -0.1, 0.26, 0.245);
        part(head, 0.08, 0.06, 0.02, "#1a1a1a", 0.1, 0.26, 0.245);
        g.add(head);
        const tag = textSprite(name, { size: 28, scale: 0.0065 });
        tag.position.set(0, 2.2, 0);
        g.add(tag);
        g.traverse((o) => { if (o.material && o.material.emissive) o.userData.lambert = true; });
        scene.add(g);
        return { g, legs, arms, head, tag };
    }

    function getPlayer(id, name) {
        let p = players.get(id);
        if (!p) {
            p = { id, name: name || "Player", x: P.x, y: P.y, z: P.z, tx: P.x, ty: P.y, tz: P.z, yaw: 0, tyaw: 0, pitch: 0,
                  walk: 0, swing: 0, sw: 0, hurt: 0, sneak: false, last: performance.now(), ...avatar(name || "Player", id) };
            p.g.visible = false;
            players.set(id, p);
        }
        return p;
    }

    function renamePlayer(p, name) {
        if (!name || p.name === name) return;
        p.name = name;
        p.g.remove(p.tag);
        p.tag = textSprite(name, { size: 28, scale: 0.0065 });
        p.tag.position.set(0, 2.2, 0);
        p.g.add(p.tag);
    }

    function removePlayer(id, quiet) {
        const p = players.get(id);
        if (!p) return;
        scene.remove(p.g);
        players.delete(id);
        if (!quiet) say(`${p.name} left the game`, "#ffff55");
    }

    function hitPlayer(p) {
        const sword = window.HUD && HUD.selectedId() === "sword";
        const dx = p.x - P.x, dz = p.z - P.z, l = Math.hypot(dx, dz) || 1;
        Net.send("hit", { dmg: sword ? (sprint ? 6 : 4) : 1, dx: dx / l, dz: dz / l, by: myName }, p.id);
        p.hurt = 0.3;
    }

    function hello(to, reply) {
        Net.send("hi", { name: myName, reply: !!reply }, to);
    }

    function startNet() {
        if (Net.started()) return;
        Net.on("hi", (d, from) => {
            const known = players.has(from);
            const p = getPlayer(from, d.name);
            renamePlayer(p, d.name);
            p.last = performance.now();
            if (!known) say(`${p.name} joined the game`, "#ffff55");
            if (!d.reply) {
                hello(from, true);
                if (edits.size) Net.send("sync", [...edits].map(([k, t]) => [...k.split(",").map(Number), t]), from);
            }
        });
        Net.on("peer", () => hello());
        Net.on("online", () => say("Connected - looking for other players...", "#aaaaaa"));
        Net.on("st", (d, from) => {
            const p = getPlayer(from);
            p.last = performance.now();
            [p.tx, p.ty, p.tz, p.tyaw, p.pitch] = d.p;
            p.sneak = !!d.s;
            if (d.w !== p.sw) { p.sw = d.w; p.swing = 1; }
            p.g.visible = true;
        });
        Net.on("bk", (d) => {
            const [x, y, z, t] = d;
            setBlock(x, y, z, t, true);
        });
        Net.on("sync", (list) => {
            for (const [x, y, z, t] of list) {
                if (!inside(x, y, z)) continue;
                data[idx(x, y, z)] = t;
                edits.set(`${x},${y},${z}`, t);
            }
            rebuild();
        });
        Net.on("chat", (d, from) => {
            const p = players.get(from);
            say(`<${p ? p.name : d.name}> ${String(d.text).slice(0, 200)}`);
        });
        Net.on("hit", (d) => {
            if (state !== "playing" && state !== "paused") return;
            P.vx = d.dx * 8; P.vz = d.dz * 8; P.vy = 5; P.kb = 0.3;
            lastHit = d.by;
            if (window.HUD) HUD.damage(Math.min(6, d.dmg | 0), `Slain by ${d.by}.`);
        });
        Net.on("die", (d) => say(String(d.msg).slice(0, 120), "#ff8080"));
        Net.on("bye", (d, from) => removePlayer(from));
        Net.start().then(() => hello());
        hello();
    }

    function updatePlayers(now, dt) {
        if (mode !== "multi") return;
        if ((state === "playing" || state === "paused") && now - lastSent > 90) {
            lastSent = now;
            Net.send("st", { p: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2), +P.yaw.toFixed(2), +P.pitch.toFixed(2)], s: sneak ? 1 : 0, w: swingCount });
        }
        for (const p of players.values()) {
            if (now - p.last > 9000) { removePlayer(p.id); continue; }
            const k = Math.min(1, dt * 12);
            const mx = p.tx - p.x, mz = p.tz - p.z;
            p.x += mx * k; p.y += (p.ty - p.y) * k; p.z += mz * k;
            let dy = p.tyaw - p.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            p.yaw += dy * k;
            const speed = Math.hypot(mx, mz) / Math.max(dt, 0.001) * k;
            p.walk += Math.min(speed, 6) * dt * 1.6;
            const sw = Math.sin(p.walk) * 0.7 * Math.min(1, speed / 2);
            p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
            p.arms[0].rotation.x = -sw;
            p.swing = Math.max(0, p.swing - dt * 4);
            p.arms[1].rotation.x = sw - Math.sin(p.swing * Math.PI) * 1.6;
            p.head.rotation.x = -p.pitch;
            p.g.position.set(p.x, p.y - (p.sneak ? 0.2 : 0), p.z);
            p.g.rotation.y = p.yaw + Math.PI;
            p.hurt = Math.max(0, p.hurt - dt);
            p.g.traverse((o) => { if (o.userData.lambert) o.material.emissive.setRGB(p.hurt > 0 ? 0.6 : 0, 0, 0); });
        }
    }

    /* ================= chat + commands ================= */
    function chat(text) {
        text = String(text || "").trim().slice(0, 200);
        if (!text) return;
        if (text.startsWith("/")) { command(text.slice(1)); return; }
        say(`<${myName}> ${text}`);
        if (mode === "multi") Net.send("chat", { text, name: myName });
        else say("(you're in singleplayer - pick Multiplayer in the menu to talk to others)", "#777777");
    }

    function command(line) {
        const [cmd, ...args] = line.split(/\s+/);
        const arg = args.join(" ");
        const c = (cmd || "").toLowerCase();
        const help = "/nick <name>, /spawn <shade|gloop|boar|duck>, /fly, /tp spawn, /kill, /heal, /music, /video, /list, /steam, /discord, /github, /screenshot";
        switch (c) {
            case "help": say(`Commands: ${help}`, "#aaaaaa"); break;
            case "nick": case "name": {
                const n = arg.replace(/[^\w\-. ]/g, "").trim().slice(0, 16);
                if (!n) { say("Usage: /nick <name>", "#ff8080"); break; }
                myName = n;
                say(`You are now ${n}`, "#aaaaaa");
                if (mode === "multi") hello();
                break;
            }
            case "spawn": case "summon": {
                const m = spawnMob(arg.toLowerCase(), true);
                say(m ? `Summoned a ${m.def.name}` : "Couldn't spawn that here", "#aaaaaa");
                break;
            }
            case "fly": P.fly = !P.fly; say(`Flying ${P.fly ? "on" : "off"} (double-tap Space too)`, "#aaaaaa"); break;
            case "tp": case "spawnpoint": spawn(); say("Teleported to spawn", "#aaaaaa"); break;
            case "kill": if (window.HUD) HUD.damage(999, "You killed yourself. Why?"); break;
            case "heal": if (window.HUD) HUD.heal(20); say("Healed", "#aaaaaa"); break;
            case "music": if (window.Site) Site.cycleMusic(); break;
            case "video": case "next": if (window.Site) Site.teleport(); break;
            case "list": say(`Online: ${[myName, ...[...players.values()].map((p) => p.name)].join(", ")}`, "#aaaaaa"); break;
            case "steam": usePortal(PORTALS[0]); break;
            case "discord": usePortal(PORTALS[1]); break;
            case "github": usePortal(PORTALS[2]); break;
            case "screenshot": screenshot(); break;
            default: say(`Unknown command. Try /help`, "#ff8080");
        }
    }

    function screenshot() {
        renderer.render(scene, camera);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `charon-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
        a.click();
        say(`Saved screenshot as ${a.download}`, "#aaaaaa");
    }

    /* ================= sound: video gets louder near the walls ================= */
    function updateVolume() {
        if (vid.muted) return;
        if (state === "title" || state === "off") { vid.volume = 1; return; }
        const d = Math.min(P.x, W - P.x, P.z, D - P.z);
        vid.volume = 0.3 + 0.7 * Math.max(0, Math.min(1, 1 - d / 22));
    }

    /* ================= state + pointer lock ================= */
    function setState(s) {
        state = s;
        document.body.classList.toggle("playing", s === "playing");
        if (window.Site) Site.menu(s);
        if (touchUI) touchUI.hidden = !(isTouch && s === "playing");
        if (s !== "playing") {
            for (const k in keys) keys[k] = false;
            if (typing && window.HUD) HUD.closeChat();
            const prompt = document.getElementById("prompt");
            if (prompt) prompt.hidden = true;
        }
    }

    // m: "single" | "multi" on the first start, nothing to resume
    function play(m) {
        if (state === "dead") return;
        if (m === "multi" && mode !== "multi") { mode = "multi"; startNet(); }
        if (isTouch) { setState("playing"); return; }
        try {
            const p = canvas.requestPointerLock();
            if (p && p.catch) p.catch(() => say("Click \"Back to Game\" again", "#aaaaaa"));
        } catch {
            setState("playing");
        }
    }

    document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement === canvas) setState("playing");
        else if (state === "playing") setState("paused");
    });

    function pause() {
        if (document.pointerLockElement) document.exitPointerLock();
        if (state === "playing") setState("paused");
    }

    function die(reason) {
        setState("dead");
        if (document.pointerLockElement) document.exitPointerLock();
        document.querySelector("#death p").textContent = reason || "Ouch.";
        document.getElementById("death").hidden = false;
        if (mode === "multi") {
            const msg = lastHit && /Slain by/.test(reason || "") ? `${myName} was slain by ${lastHit}` : `${myName} died`;
            Net.send("die", { msg });
        }
        lastHit = null;
    }

    function respawn() {
        document.getElementById("death").hidden = true;
        spawn();
        clearMobs();
        if (window.HUD) HUD.heal(20);
        state = "paused";
        play();
    }

    /* ================= input ================= */
    let holdTimer = null;
    function hold(fn) {
        fn();
        clearInterval(holdTimer);
        holdTimer = setInterval(fn, 250);
    }
    const release = () => clearInterval(holdTimer);

    document.addEventListener("keydown", (e) => {
        if (state !== "playing" || typing) return;
        if (e.code === "KeyW" && !e.repeat) {
            if (performance.now() - lastW < 280) sprint = true;
            lastW = performance.now();
        }
        if (e.code === "Space" && !e.repeat) {
            if (performance.now() - lastSpace < 280) { P.fly = !P.fly; P.vy = 0; }
            lastSpace = performance.now();
        }
        if (e.code === "KeyE" && !e.repeat) { const p = portalAt(); if (p) usePortal(p); }
        if (e.code === "F2") { e.preventDefault(); screenshot(); }
        keys[e.code] = true;
        if (e.ctrlKey || ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
    });
    document.addEventListener("keyup", (e) => { keys[e.code] = false; });

    document.addEventListener("mousemove", (e) => {
        if (state !== "playing" || document.pointerLockElement !== canvas) return;
        P.yaw -= e.movementX * 0.0024;
        P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - e.movementY * 0.0024));
    });

    document.addEventListener("mousedown", (e) => {
        if (state !== "playing" || typing || isTouch || e.target.closest("#hotbar, #chatinput")) return;
        if (e.button === 0) hold(attack);
        else if (e.button === 2) hold(useItem);
    });
    document.addEventListener("mouseup", release);
    document.addEventListener("contextmenu", (e) => { if (state === "playing") e.preventDefault(); });

    addEventListener("beforeunload", (e) => {
        if (state === "playing") { e.preventDefault(); e.returnValue = ""; }
    });

    /* ---------- touch controls ---------- */
    let touchUI = null, touchJump = false;
    function buildTouch() {
        touchUI = document.createElement("div");
        touchUI.id = "touch";
        touchUI.hidden = true;
        touchUI.innerHTML = `
            <div id="stick"><i></i></div>
            <button type="button" class="tbtn" id="t-pause">II</button>
            <button type="button" class="tbtn" id="t-chat">Chat</button>
            <button type="button" class="tbtn" id="t-hit">Hit</button>
            <button type="button" class="tbtn" id="t-use">Use</button>
            <button type="button" class="tbtn" id="t-jump">Jump</button>`;
        document.body.appendChild(touchUI);
        const stick = touchUI.querySelector("#stick"), knob = stick.firstElementChild;
        let stickId = null, lookId = null, lx = 0, ly = 0;

        const btn = (id, down, up) => {
            const b = touchUI.querySelector(id);
            b.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
            b.addEventListener("touchend", (e) => { e.preventDefault(); if (up) up(); }, { passive: false });
        };
        btn("#t-pause", pause);
        btn("#t-chat", () => window.HUD && HUD.openChat());
        btn("#t-hit", () => hold(attack), release);
        btn("#t-use", () => hold(useItem), release);
        btn("#t-jump", () => (touchJump = true), () => (touchJump = false));

        touchUI.addEventListener("touchstart", (e) => {
            for (const t of e.changedTouches) {
                const r = stick.getBoundingClientRect();
                if (stickId === null && t.clientX < r.right + 30 && t.clientY > r.top - 30) stickId = t.identifier;
                else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
            }
        }, { passive: true });
        touchUI.addEventListener("touchmove", (e) => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (t.identifier === stickId) {
                    const r = stick.getBoundingClientRect();
                    let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
                    let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
                    const l = Math.hypot(dx, dy);
                    if (l > 1) { dx /= l; dy /= l; }
                    touchMove.x = dx; touchMove.y = dy;
                    knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
                } else if (t.identifier === lookId) {
                    P.yaw -= (t.clientX - lx) * 0.006;
                    P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - (t.clientY - ly) * 0.006));
                    lx = t.clientX; ly = t.clientY;
                }
            }
        }, { passive: false });
        const end = (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === stickId) {
                    stickId = null; touchMove.x = 0; touchMove.y = 0;
                    knob.style.transform = "";
                } else if (t.identifier === lookId) lookId = null;
            }
        };
        touchUI.addEventListener("touchend", end);
        touchUI.addEventListener("touchcancel", end);
    }

    /* ================= main loop ================= */
    let last = performance.now(), lastPortal = 0;
    function loop(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (state === "playing" && !typing) updatePlayer(dt);
        else if (state === "playing") { P.vx *= 0.8; P.vz *= 0.8; updatePlayerIdle(dt); }
        else bobAmt *= 0.9;
        updateCamera(now, dt);
        updateParticles(dt);
        updatePearls(dt);
        if (state === "playing" || state === "title") updateMobs(dt);
        updatePlayers(now, dt);
        updateTarget();
        updateVolume();
        updateAmbilight(now, dt);
        if (now - lastPortal > 80) { lastPortal = now; animatePortals(now / 1000); }
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
    }

    // still fall / settle while the chat box is open
    function updatePlayerIdle(dt) {
        for (const k in keys) keys[k] = false;
        updatePlayer(dt);
    }

    function resize() {
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
    }

    function init() {
        if (renderer) return true;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        } catch {
            return false;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#000000");
        camera = new THREE.PerspectiveCamera(70, 1, 0.05, 220);
        camera.rotation.order = "YXZ";

        ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.45);
        sun.position.set(0.4, 1, 0.3);
        scene.add(sun);
        addStars();

        buildMaterials();
        generate();
        rebuild();
        buildWalls();
        spawn();
        spawnMob("boar");
        spawnMob("duck");

        // portal labels need the pixel font
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(buildPortals, buildPortals);

        outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
        );
        outline.visible = false;
        scene.add(outline);

        if (isTouch) buildTouch();
        document.getElementById("btn-respawn").addEventListener("click", respawn);

        addEventListener("resize", resize);
        resize();
        canvas.hidden = false;
        setState("title");
        requestAnimationFrame(loop);
        return true;
    }

    // portals may not exist yet when the first frames run
    const _animate = animatePortals;
    animatePortals = (t) => { if (PORTALS[0].tex) _animate(t); };

    window.World = {
        init,
        play,
        pause,
        die,
        chat,
        throwPearl,
        spawnMob: (type) => spawnMob(type, true),
        isTouch,
        playing: () => state === "playing",
        multiplayer: () => mode === "multi",
        setTyping: (v) => { typing = v; if (v) for (const k in keys) keys[k] = false; },
        typing: () => typing,
        players: () => [myName + " (you)", ...[...players.values()].map((p) => p.name)],
        active: () => !!renderer,
        edits: () => edits.size,
        bob: () => ({ phase: walkDist * 1.6, amt: bobAmt }),
    };
})();
