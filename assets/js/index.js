const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIDEOS = [
    "jonsnow", "lud", "vatra", "gad", "bigdick", "look",
    "moon", "rip", "bebica", "brik", "holymoly", "slut", "aedoma",
].map((name) => `charon/assets/video/${name}.mp4`);

// music disc tracks (played in this order, then off)
const TRACKS = [
    { title: "Lurking", src: "charon/assets/video/Lurking.mp3" },
    { title: "gay",     src: "charon/assets/video/gay.mp3" },
];

// yellow splash text under the title
const ROLES = [
    "Check out Kishin!",
    "Ty vany & yml <3",
    "Messing with kids",
    "Java Developer",
    "Kotlin Developer",
    "Paper/Spiggot/Bukkit Developer",
];

const DISCORD_TAG = "charon#9999";

const $ = (id) => document.getElementById(id);
const vid = $("vidarea");
const intro = $("intro");
const introText = $("intro-text");
const loadFill = $("loadfill");
const main = $("main");
const splash = $("splash");
const musicBtn = $("btn-music");

let entered = false;
let where = "";

/* ---------------- helpers ---------------- */

// Types `text` into `el` one character at a time, then blinks a cursor.
// Stops early (returns false) as soon as `alive()` becomes false.
async function type(el, text, alive, { speed = 70, blinks = 5 } = {}) {
    el.textContent = "";
    for (const ch of text) {
        if (!alive()) return false;
        el.textContent += ch;
        await sleep(speed);
    }
    for (let i = 0; i < blinks; i++) {
        if (!alive()) return false;
        el.textContent = text + (i % 2 ? "_" : "");
        await sleep(450);
    }
    el.textContent = text;
    return alive();
}

function say(msg, color) {
    if (window.HUD) HUD.say(msg, color);
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

/* ---------------- video (the "world") ---------------- */

let queue = [];

function nextSrc() {
    if (!queue.length) {
        queue = VIDEOS.filter((v) => !vid.src.endsWith(v)).sort(() => Math.random() - 0.5);
    }
    return queue.shift();
}

function loadNextVideo() {
    vid.src = nextSrc();
    vid.load();
}

// a broken/missing file just moves on to the next one
vid.addEventListener("error", () => {
    loadNextVideo();
    if (entered) playVideo();
});

async function playVideo() {
    vid.classList.add("on");
    vid.muted = musicOn();
    try {
        await vid.play();
    } catch {
        // browser refused sound - play muted and unmute on the next click
        vid.muted = true;
        vid.play().catch(() => {});
        document.addEventListener("click", () => {
            vid.muted = musicOn();
            vid.play().catch(() => {});
        }, { once: true });
    }
}

function teleport() {
    if (window.HUD) HUD.teleportFlash();
    setTimeout(() => {
        loadNextVideo();
        playVideo();
    }, 180);
    say("Whoosh! Teleported to a new world", "#d27cff");
}

/* ---------------- music ---------------- */

const music = new Audio();
music.preload = "none";
music.volume = 0.7;
let track = -1;

function musicOn() {
    return track >= 0;
}

function updateMusicButton() {
    musicBtn.textContent = `Music: ${musicOn() ? TRACKS[track].title : "OFF"}`;
}

function playTrack(i) {
    track = i;
    music.src = TRACKS[i].src;
    music.currentTime = 0;
    music.play().catch(() => {});
    vid.muted = true;                       // music takes over from the video sound
    if (window.HUD) HUD.showNowPlaying(TRACKS[i].title);
    updateMusicButton();
}

function stopMusic() {
    music.pause();
    track = -1;
    vid.muted = false;
    vid.play().catch(() => {});
    say("Music off - back to the world sound", "#aaaaaa");
    updateMusicButton();
}

// off -> track 1 -> track 2 -> ... -> off
function cycleMusic() {
    if (track === TRACKS.length - 1) stopMusic();
    else playTrack(track + 1);
}

music.addEventListener("ended", () => playTrack((track + 1) % TRACKS.length));

/* ---------------- discord ---------------- */

async function copyDiscord() {
    try {
        await navigator.clipboard.writeText(DISCORD_TAG);
        say(`Copied Discord tag ${DISCORD_TAG}`, "#7289ff");
    } catch {
        say(`Discord: ${DISCORD_TAG}`, "#7289ff");
    }
}

window.Site = { teleport, cycleMusic, musicOn, copyDiscord };

/* ---------------- intro (loading screen) ---------------- */

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
    loadFill.style.width = "12%";
    where = await getLocation();
    const lines = [
        where ? `It is nice to see someone from ${where}` : "It is nice to see someone new",
        "Granting access ...",
        "Access granted ... Click anywhere to proceed",
    ];
    for (let i = 0; i < lines.length; i++) {
        loadFill.style.width = `${Math.round(((i + 1) / lines.length) * 100)}%`;
        if (!(await type(introText, lines[i], alive))) return;
        if (i < lines.length - 1) {
            await sleep(i === 0 ? 1000 : 1500);
            if (!alive()) return;
        }
    }
    intro.classList.add("done");
}

/* ---------------- title screen ---------------- */

async function runSplash() {
    let i = 0;
    while (true) {
        splash.textContent = ROLES[i % ROLES.length];
        splash.classList.remove("pop");
        void splash.offsetWidth;
        splash.classList.add("pop");
        i++;
        await sleep(3500);
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
    if (window.HUD) HUD.start(where);

    animateTitle("charon.gay");
    animateHash("pusi-kurac");
    runSplash();
}

$("discord").addEventListener("click", copyDiscord);
musicBtn.addEventListener("click", cycleMusic);
$("btn-tp").addEventListener("click", teleport);

intro.addEventListener("click", enter);
document.addEventListener("keydown", (e) => {
    if (!entered && (e.key === "Enter" || e.key === " ")) enter();
});

loadNextVideo();          // start buffering while the intro types
animateTitle("loading...");
runIntro();
