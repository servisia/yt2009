const fetch = require("node-fetch");
const child_process = require("child_process");
const path = require("path");
const config = require(path.resolve(__dirname, "./back/config.json"));
const constants = require(path.resolve(__dirname, "./back/yt2009constants.json"));
const fs = require("fs");

/*
======= 
check external clis 
======= 
*/
let check_tools = ["ffmpeg -h", "magick --help", "convert --version"];
check_tools.forEach(tool => {
    console.log("== checking external tool: " + tool.split(" ")[0]);
    try {
        child_process.execSync(tool, {
            "stdio": "pipe"
        });
    }
    catch (error) {
        console.log(tool.split(" ")[0] + " not found!! make sure it is in your path");
        console.log("exiting");
        process.exit();
    }
});

/*
======= 
generate tokens if prod 
======= 
*/
let tokensCount = 25;
if (config.env == "prod" && !config.tokens) {
    console.log("environment set to prod but no tokens. generating!!");
    let tokens = [];
    while (tokens.length !== tokensCount) {
        let token = "";
        while (token.length !== 9) {
            token += "qwertyuiopasdfghjklzxcvbnm1234567890".split("")
                [Math.floor(Math.random() * 36)];
        }
        tokens.push(token);
    }
    config.tokens = tokens;
    console.log("writing " + tokensCount + " usable tokens to config");
    fs.writeFileSync(path.resolve(__dirname, "./back/config.json"), JSON.stringify(config));
}

/*
======= 
create cache files 
======= 
*/
const cacheFiles = {
    "channel_main_cache.json": {},
    "channel_playlist_cache.json": {},
    "default_avatar_adapt.json": {},
    "playlist_cache.json": {},
    "public_channel_listing.json": [],
    "rating_cache.json": {},
    "ryd_cache.json": {},
    "search_cache.json": {},
    "userid.json": {},
    "video_cache.json": {},
    "video_exists_cache.json": {},
    "watched_now.json": [],
    "wayback_channel_cache.json": {},
    "wayback_watch_cache.json": {},
    "captions_cache.json": {}
};
console.log("creating cache files");
for (let file in cacheFiles) {
    const filePath = path.resolve(__dirname, "./back/cache_dir/" + file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(cacheFiles[file]));
    }
}

fs.mkdirSync(path.resolve(__dirname, "./back/cache_dir/annotations/"), { recursive: true });
fs.mkdirSync(path.resolve(__dirname, "./back/cache_dir/subtitles/"), { recursive: true });

/*
======= 
generate innertube data 
======= 
*/
console.log("== generating innertube data");
let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0";
if (!config.userAgent) {
    console.log("useragent not found in config, using \"" + ua + "\"");
    console.log("if you wish to use your own user agent," + "add a userAgent entry to config.json.");
    constants.headers["user-agent"] = ua;
} else {
    ua = config.userAgent;
}
fetch("https://www.youtube.com/", {
    "headers": {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "sec-gpc": "1",
        "upgrade-insecure-requests": "1",
        "user-agent": ua
    },
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET",
    "mode": "cors"
}).then(r => {
    // set cookies
    let cookie = r.headers.get("set-cookie").split(",");
    let cookieString = "";
    cookie.forEach(part => {
        if (part.split(";")[0].includes("=")) {
            cookieString += part.trimStart().split(";")[0] + "; ";
        }
    });
    constants.headers.cookie = cookieString;

    // set innertube context
    r.text().then(res => {
        let context = res.split(`"INNERTUBE_CONTEXT":`)[1]
            .split(`,"user":{"lockedSafetyMode":`)[0] + "}";
        constants.cached_innertube_context = JSON.parse(context);

        console.log("writing to constants");
        fs.writeFileSync(path.resolve(__dirname, "./back/yt2009constants.json"), JSON.stringify(constants));
        console.log("=== !!! ===");
        console.log("/back/yt2009constants.json was modified to include unique data.");
        console.log("this data may include the used useragent, your ip and others.");
        console.log("make sure to remove such data if you intend on sharing your copy.");
        setTimeout(function () {
            console.log("=== downloading assets ===");
            downloadFile();
        }, 402);
    });
});

/*
======= 
download site-assets 
======= 
*/
let files = [
    // List of file objects with URLs and paths...
];

const initialFileCount = files.length;
function downloadFile() {
    console.log("");
    let file = files[0];
    let fileNumber = initialFileCount - files.length + 1;
    let relativeFileName = path.basename(file.path);
    // save file
    setTimeout(function () {
        if (!fs.existsSync(file.path)) {
            console.log(`downloading ${relativeFileName} (${fileNumber}/${initialFileCount})`);
            fetch(file.url, {
                "headers": constants.headers
            }).then(r => {
                r.buffer().then(buffer => {
                    fs.writeFileSync(file.path, buffer);
                    // download the next file
                    files.shift();
                    if (files.length > 0) {
                        downloadFile();
                    } else {
                        // done
                        console.log("file download done!!");
                    }
                });
            });
        } else {
            // skip download if the file already exists
            console.log(`skipping ${relativeFileName}, file exists`);
            files.shift();
            if (files.length > 0) {
                downloadFile();
            } else {
                // done
                console.log("file download done!!");
            }
        }
    }, Math.floor(Math.random() * 604));
}
