const sleep = (ms) =>new Promise(resolve => setTimeout(resolve, ms));

const videos =[
    "assets/video/jonsnow.mp4",
    "assets/video/lud.mp4",
    "assets/video/vatra.mp4",
    "assets/video/omadjijala.mp4",
    "assets/video/gad.mp4",
    "assets/video/bigdick.mp4",
    "assets/video/look.mp4",
    "assets/video/moon.mp4",
    "assets/video/rip.mp4",
    "assets/video/bebica.mp4",
    "assets/video/brik.mp4",
    "assets/video/holymoly.mp4",
    "assets/video/slut.mp4"
]

document.title = "";
let titles = ["c", "h", "a", "r", "o", "n", ".", "g", "a", "y"];
let url = ["p", "u", "s", "i","-", "k", "u", "r", "a", "c"];
let sentence = ["C", "a", "t", "f","i","s","h", "i", "n", "g", " ", "g","o", "d", "!"];
let sentence2 = ["T", "y", " ", "v", "a","n","y", " ", "&", " ", "y","m","l ", "<","3"];
let sentence3 = ["P", "y", "t", "h", "o", "n", " ", "D", "e","v","e","l","o","p","e","r"];
let sentence4 = ["M", "e", "s", "s","i","n","g", " ", "w", "i","t", "h", " ", "k","i", "d", "s"];
let sentence5 = ["J", "a", "v", "a", " ", "D", "e","v","e","l","o","p","e","r"];
let sentence6 = ["W", "e", "b", " ", "D", "e","v","e","l","o","p","e","r"];

async function changeTitle(){
    while(true){
        for(let i=0;i<titles.length;i++){
            document.title=document.title+titles[i];
            await sleep(700)
        }
        document.title = "";
    }
}

async function changeURL(){
    let sve = "";
    while(true){
        for(let i=0;i<url.length;i++){
            let last = url[i]
            sve += last
            document.location.hash=sve
            await sleep(700)
        }
        document.location.hash = "";
        sve = "";
    }
}

async function randomVideo(){
    var vid = document.getElementById("vidarea");
    vid.src = videos[Math.floor(Math.random() * 14)]
    vid.loop = true;
    vid.load();
    vid.play();
}

async function typeWriter(){
    var text = document.getElementById("typewriter")
    while(true){
        await sleep(100);
        for(let i=0;i<sentence.length;i++){
            text.innerHTML += sentence[i];
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        text.innerHTML = "";




        for(let i=0;i<sentence2.length;i++){
            text.innerHTML += sentence2[i];
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        text.innerHTML = "";



        for(let i=0;i<sentence3.length;i++){
            text.innerHTML += sentence3[i];
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        text.innerHTML = "";
        
        
        
        
        for(let i=0;i<sentence4.length;i++){
            text.innerHTML += sentence4[i];
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        text.innerHTML = "";
        
        
        
        
        for(let i=0;i<sentence5.length;i++){
            text.innerHTML += sentence5[i];
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        text.innerHTML = "";
        
        
        
        for(let i=0;i<sentence6.length;i++){
            text.innerHTML += sentence6[i];
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        text.innerHTML = "";
    }
}

async function start(){
    typeWriter();
    randomVideo();
    changeTitle();
    changeURL();
}
