const sleep = (ms) =>new Promise(resolve => setTimeout(resolve, ms));

let country;
let city;
document.title = "";
let titles = ["c", "h", "e", "c", "k", "i", "g", ".", ".", "."];
let sentence = ["A", "c", "c", "e", "s","s", " ", "g", "r", "a", "n", "t", "e", "d", " .", ".", ".", " C", "l","i","c","k", " ", "a","n","y","w","h","e","r","e"," ", "t","o", " p","r","o","c","e","e","d"]
let sentence2 = ["I", "t", " ", "i","s"," ", "n","i","c","e"," ", "t","o", " ", "s", "e", "e", " ", "s", "o", "m","e","o","n","e", " ", "f","r","o","m "]
let sentence3 = ["G", "r", "a", "n", "t", "i", "n", "g", " ", "a", "c","c","e","s","s"," .",".","."]

async function changeTitle(){
    while(true){
        for(let i=0;i<titles.length;i++){
            document.title=document.title+titles[i];
            await sleep(700)
        }
        document.title = "";
    }
}

async function typeWriter(){
    const request = await fetch("https://ipinfo.io/json?token=1f39a6dba67005");
    const json = await request.json();
    country = (json["country"]).split("");
    city = (json["city"]).split("");
    for(penis of country)
        sentence2.push(penis)
    sentence2.push(", ")
    for(govno of city)
        sentence2.push(govno);
    var text = document.getElementById("typewriter")
    while(true){

        for(let i=0;i<sentence2.length;i++){
            text.innerHTML += `${sentence2[i]}`;
            await sleep(100)
        }
        for(let i=0;i<5;i++){
            text.innerHTML += i%2?"|":"";
            await sleep(500)
            text.innerHTML = text.innerHTML.replaceAll("|", "");
        }
        await sleep(1000)
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
        await sleep(1500)
        text.innerHTML = "";


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
        break;
    
    }
}

document.addEventListener("click", function(){ location.replace("http://charon.gay/charon/"); });

async function start(){
    changeTitle();
    typeWriter();
}