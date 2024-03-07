const fs = require('fs').promises;
const fsSync = require('fs');

async function saveJSON(path, json) {
    await fs.writeFile(path, JSON.stringify(json));
    return 0;
}

async function saveBeatmap(beatmap, beatmap_id) {
    await fs.writeFile(`./beatmaps/${beatmap_id}.osu`, beatmap);
    return 0;
}

async function getFileNamesInDir(dir) {
    let files = await fs.readdir(dir);

    return files.map(x => x.replace('.osu', '')) || null;
}

function checkingFile(path, default_value) {
    let check = fsSync.existsSync(path);
    if(!check) {
        console.log(`File not found: ${path}\nCreating new file..`)
        fsSync.writeFileSync(path, JSON.stringify(default_value));
    }
    if(check) {

        try {
            fsSync.readFileSync(path);
        } catch {
            console.log(`Could not validate: ${path}\nRecreating file..`)
            fsSync.writeFileSync(path, JSON.stringify(default_value));
        }
    }
}

function checkFiles() {
    console.log('Checking files...')

    let check = fsSync.existsSync('./files');
    if(!check) fs.mkdir('./files');

    check = fsSync.existsSync('./beatmaps');
    if(!check) fs.mkdir('./beatmaps');

    check = fsSync.existsSync('./db');
    if(!check) fs.mkdir('./db');

    let files = [
        {
            name: 'beatmaps.json',
            vaule: []
        },
        {
            name: 'colors.json',
            vaule: {
                "best": "#E74C3C",
                "recent": "#ECF0F1",
                "compare": "#F1C40F",
                "ranked": "#2ECC71",
                "unranked": "#808080",
                "loved": "#AF7AC5",
                "approved":	"#2ECC71",
                "qualified":"#3498DB",
                "help": "#607d8b",
                "leaderboard": "#9dfc03"
            }
        },
        {
            name: 'dan_list.json',
            vaule: []
        },
        {
            name: 'discord-links.json',
            vaule: []
        },
        {
            name: 'msg-stack.json',
            vaule: {}
        },
        {
            name: 'posted_scores.json',
            vaule: []
        },
        {
            name: 'userbase.json',
            vaule: []
        }
    ]

    for(let file of files) {
        checkingFile(`./files/${file.name}`, file.vaule);
    }
}

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

module.exports = {
    "saveJSON": saveJSON,
    "saveBeatmap": saveBeatmap,
    "getFileNamesInDir": getFileNamesInDir,
    "checkFiles": checkFiles,
}