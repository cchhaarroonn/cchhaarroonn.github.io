const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIDEOS = [
    "jonsnow", "lud", "vatra", "gad", "bigdick", "look",
    "moon", "rip", "bebica", "brik", "holymoly", "slut",
].map((name) => `charon/assets/video/${name}.mp4`);

const ROLES = [
    "Check out Kishin!",
    "Ty vany & yml <3",
    "Messing with kids",
    "Java Developer",
    "Kotlin Developer",
    "Paper/Spiggot/Bukkit Developer",
];

const vid = document.getElementById("vidarea");
const intro = document.getElementById("intro");
const introText = document.getElementById("intro-text");
const main = document.getElementById("main");
const roleText = document.getElementById("typewriter");
const toastEl = document.getElementById("toast");

let entered = false;

/* ---------------- helpers ---------------- */

// Types `text` into `el` one character at a time, then blinks a cursor.
// Stops early (returns false) as soon as `alive()` becomes false.
async function type(el, text, alive, { speed = 100, blinks = 5 } = {}) {
    el.textContent = "";
    for (const ch of text) {
        if (!alive()) return false;
        el.textContent += ch;
        await sleep(speed);
    }
    for (let i = 0; i < blinks; i++) {
        if (!alive()) return false;
        el.textContent = text + (i % 2 ? "|" : "");
        await sleep(500);
    }
    el.textContent = text;
    return alive();
}

function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

async function animateTitle(text) {
    const gen = (animateTitle.gen = (animateTitle.gen || 0) + 1);
    while (gen === animateTitle.gen) {
        let s = "";
        for (const ch of text) {
            if (gen !== animateTitle.gen) return;
            s += ch;
            document.title = s;
            await sleep(700);
        }
    }
}

async function animateHash(text) {
    // replaceState so the back button isn't flooded with history entries
    while (true) {
        let s = "";
        for (const ch of text) {
            s += ch;
            history.replaceState(null, "", "#" + s);
            await sleep(700);
        }
        history.replaceState(null, "", location.pathname + location.search);
    }
}

/* ---------------- video ---------------- */

const queue = [...VIDEOS].sort(() => Math.random() - 0.5);

function loadNextVideo() {
    const src = queue.shift();
    if (!src) return;
    vid.src = src;
    vid.load();
}

// a broken/missing file just moves on to the next one
vid.addEventListener("error", () => {
    loadNextVideo();
    if (entered) playVideo();
});

async function playVideo() {
    vid.classList.add("on");
    vid.muted = false;
    try {
        await vid.play();
    } catch {
        // browser refused sound - play muted and unmute on the next click
        vid.muted = true;
        vid.play().catch(() => {});
        document.addEventListener("click", () => {
            vid.muted = false;
            vid.play().catch(() => {});
        }, { once: true });
    }
}

/* ---------------- intro ---------------- */

async function getLocation() {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch("https://ipinfo.io/json?token=1f39a6dba67005", { signal: ctrl.signal });
        clearTimeout(t);
        const j = await res.json();
        return [j.country, j.city].filter(Boolean).join(", ");
    } catch {
        return "";
    }
}

async function runIntro() {
    const alive = () => !entered;
    const where = await getLocation();
    const lines = [
        where ? `It is nice to see someone from ${where}` : "It is nice to see someone new",
        "Granting access ...",
        "Access granted ... Click anywhere to proceed",
    ];
    for (let i = 0; i < lines.length; i++) {
        if (!(await type(introText, lines[i], alive))) return;
        if (i < lines.length - 1) {
            await sleep(i === 0 ? 1000 : 1500);
            if (!alive()) return;
        }
    }
}

/* ---------------- main ---------------- */

async function runRoles() {
    const alive = () => true;
    while (true) {
        for (const role of ROLES) {
            await type(roleText, role, alive);
            await sleep(100);
        }
    }
}

function enter() {
    if (entered) return;
    entered = true;

    // must happen synchronously inside the click so the browser allows sound
    playVideo();

    intro.classList.add("out");
    setTimeout(() => intro.remove(), 600);
    main.hidden = false;

    animateTitle("charon.gay");
    animateHash("pusi-kurac");
    runRoles();
}

document.getElementById("discord").addEventListener("click", async (e) => {
    e.stopPropagation();
    const tag = e.currentTarget.dataset.tag;
    try {
        await navigator.clipboard.writeText(tag);
        toast(`Copied ${tag}`);
    } catch {
        toast(tag);
    }
});

intro.addEventListener("click", enter);
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") enter();
});

loadNextVideo();          // start buffering while the intro types
animateTitle("checking...");
runIntro();
