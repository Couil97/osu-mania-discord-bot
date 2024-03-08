const { client } = require("./discord-module");
const { colors, api_retry_rate } = require("./variables");

let msgStack = require('../files/msg-stack.json');
const { saveJSON } = require("./file-modules");

// Delays a async function.
const delay = async (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms));

// Gets mod icon from discord server
function getIcon(icon) {
    switch (icon) {
        case 'F': icon = '<:Ficon:966761016983707689>'; break;
        case 'D': icon = '<:Dicon:955546384684179506>'; break;
        case 'C': icon = '<:Cicon:955546384659009576>'; break;
        case 'B': icon = '<:Bicon:955546384562528256>'; break;
        case 'A': icon = '<:Aicon:955546384403169290>'; break;
        case 'S': icon = '<:Sicon:955546384608665651>'; break;
        case 'SH': icon = '<:SHicon:955546384663187466>'; break;
        case 'X': icon = '<:Xicon:955546384688365638>'; break;
        case 'XH': icon = '<:XHicon:955546384679968768>'; break;
        default: icon = '<:Ficon:966013175743004782>'; break;
    }

    return icon
}

//Function for converting number without commas to number with commas
function toComma(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Converts string to gamemode
function gamemodeConverter(mode) {
    switch(mode) {
        case 'osu':         return 'osu';
        case 'std':         return 'osu';
        case 'standard':    return 'osu';
        case 'o':           return 'osu';
        case '0':           return 'osu';

        case 'taiko':       return 'taiko';
        case 'osutaiko':    return 'taiko';
        case 't':           return 'taiko';
        case '1':           return 'taiko';
        
        case 'ctb':         return 'fruits';
        case 'catch':       return 'fruits';
        case 'c':           return 'fruits';
        case '2':           return 'fruits';

        case 'm':           return 'mania';
        case 'mania':       return 'mania';
        case 'osumania':    return 'mania';
        case '3':           return 'mania';
    }
}

// Converts seconds to years/months/days etc..
function toDays(date) {
    let x = new Date();
    x = ((Date.parse(x) - Date.parse(date)) / 1000);

    let years, months, days, hours, minutes, seconds;
  
    years = Math.floor(x / (60 * 60 * 24 * 365))
    x = x - (years * (60 * 60 * 24 * 365))
  
    months = Math.floor(x / (60 * 60 * 24 * (365 / 12)))
    x = x - (months * (60 * 60 * 24 * (365 / 12)))
  
    days = Math.floor(x / (60 * 60 * 24))
    x = x - (days * (60 * 60 * 24))
  
    hours = Math.floor(x / (60 * 60))
    x = x - (hours * (60 * 60))
  
    minutes = Math.floor(x / (60))
    x = x - (minutes * (60))
  
    seconds = Math.floor(x)

    if(years    > 0) return `${years}y, ${months}mo, ${days}d`;
    if(months   > 0) return `${months}mo, ${days}d, ${hours}h`;
    if(days     > 0) return `${days}d, ${hours}h, ${minutes}m`;
    if(hours    > 0) return `${hours}h, ${minutes}m, ${seconds}s`;
    if(minutes  > 0) return `${minutes}m, ${seconds}s`;
    
    return `${seconds} s`;
}

// Checks if two arrays are equal
function isEqual(arr1, arr2) {
    let a, b;
  
    if (arr1.length > 0) a = arr1.sort().join(',');
    else a = arr1;
  
    if (arr2.length > 0) b = arr2.sort().join(',');
    else b = arr1;
  
    return a === b;
}

// Get colors from colors.json
function getColors(type) {
    return colors[type];
}

// Sends msg to discord client
function sendMsg(channel, msg) {
    client.channels.cache.get(channel).send(msg);
}

// Filters and gets arguments from user input
function getArgs(message) {  
    let args = message.args;
    let options = {option: [], number: []};

    for(let i = 0; i < args.length; i++) {
        if (args[i]) {
            if(args[i].includes('\"')) {
                let j = i+1;

                while(j < args.length + 1 && !args[j].includes('\"')) {
                    args[i] = args[i] + ' ' + args[j];
                    j++;
                }

                args[i] = args[i] + ' ' + args[j];

                args.splice(i+1, (j-i));
                args[i] = args[i].replace(/\"/g,'');
            }
        }
    }

    for (let arg of args) {
        args = arg.replace(',','');
        if (arg) {
            if(/^unranked$/i.test(arg)) options.type = 'unranked';
            else if(/^loved$/i.test(arg)) options.type = 'loved';
            else if(/^ranked$/i.test(arg)) options.type = 'ranked';
            else if(/^all$/i.test(arg)) options.type = 'all';
            else if(/^\d+\:\d+/g.test(arg) && /\d+\:\d+$/g.test(arg)) {
                options.ratio = arg.split(':');

                for(let i = 0; i < options.ratio.length; i++) {
                    options.ratio[i] = parseInt(options.ratio[i]);
                }
            }
            else if (/\*$/g.test(arg)) options.star_rating = parseFloat(arg.slice(0, -1));
            else if (/sort:/g.test(arg) && arg.length < 3) options.sort = arg.splice(5);
            else if (/\-\-[A-Za-z]+/g.test(arg)) options.option.push(arg.slice(2));
            else if (/\d+pp$/g.test(arg)) options.performance_points = parseInt(arg.slice(0, -2));
            else if (/%$/g.test(arg)) options.acc = parseFloat(arg.slice(0, -1));
            else if (/^\d+$/.test(arg)) options.number.push(arg - 1);
            else if (arg.includes('beatmaps/') || arg.includes('beatmapsets/')) {
                if (!arg.includes('beatmaps/')) {
                    if(arg.split('beatmapsets/')[1].includes('/')) options.beatmap_id = arg.split('beatmapsets/')[1].split('/')[1];
                    else {
                    options.beatmap_id = arg.split('beatmapsets/')[1]
                    }
                }
                else {
                    options.beatmap_id = arg.split('beatmaps/')[1];
                }
            } else if (arg.charAt(0) == '+') {
                options.mods = arg.toUpperCase();
                options.mods = options.mods.substring(1, options.mods.length).match(/.{1,2}/g);
            }
            else if (arg.charAt(arg.length - 1) == '%') options.percent = parseFloat(arg.slice(0, -1));
            else if (arg.length == 2 && /[A-Z]/g.test(arg)) options.country = arg;
            else if (arg.charAt(arg.length - 1).toLowerCase() == 'k' && (/^\d+$/).test(arg.substring(0, arg.length - 1))) options.variant = arg.slice(0, -1) + 'k';
            else if (!Object.hasOwn(options, 'username')) options.username = arg;
        }
    }

    // Defaults
    if(!options.gamemode) options.gamemode = 'mania';
    if(!options.number) options.number = 0;
    if(!options.username) options.username = message.author.username;
    if(!options.mods) options.mods = [];
    //if(!options.type) options.type = 'ranked';

    // Fail-safes
    if(options.percent > 100) options.percent = 100;
    if(options.number.length == 1) options.number = options.number[0];
    if(options.number.length == 0) options.number = 0
    if(options.number < 0) options.number = 0;


    return options
}

// Response if osu!api connection fails
async function faultyResponse(cb, res, args) {
    console.log(`${cb.name}: Failed`);
    console.log(cb);

    res = await res.json();

    if(Object.hasOwn(res, 'error')) return 0;

    await delay(api_retry_rate);
    return cb(args);
}

// Removes brackets (and other items) from osu! difficulty name
function sanitizeVersion(version) {
    if (version.includes('[') && version.includes('K]')) version = version.substring(5);
    return version;
}

// Adds to the msg stack (its where the bot see what msgs are above them)
function addToMsgStack(beatmap_id, channel) {
    if(!Object.hasOwn(msgStack, channel)) {
        msgStack[channel] = [beatmap_id];
    } else {
        msgStack[channel].unshift(beatmap_id);
        if(msgStack[channel].length > 100) {
            msgStack[channel].pop();
        }
    }

    saveJSON('./files/msg-stack.json', msgStack);
}

// Gets beatmap_id from msgStack
function getMsgStack(channel, cursor) {
    cursor = cursor || 0;

    if(!Object.hasOwn(msgStack, channel)) return null;
    if(msgStack[channel].length <= cursor) return null;

    return msgStack[channel][cursor];
}

// Replaces roman numerals with kanji
function replaceNumbers(number) {
    number = number.toString();

    number = number.replace(/0/g,'０');
    number = number.replace(/1/g,'１');
    number = number.replace(/2/g,'２');
    number = number.replace(/3/g,'３');
    number = number.replace(/4/g,'４');
    number = number.replace(/5/g,'５');
    number = number.replace(/6/g,'６');
    number = number.replace(/7/g,'７');
    number = number.replace(/8/g,'８');
    number = number.replace(/9/g,'９');

    return number;
}

// Truncates a string
function truncate(str, limit) {
    if(limit > str.length) return str;
    if(limit < 1) return '';

    return str.slice(0, limit - 2) + '..';
}

// Checks if arrays are equal
function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

module.exports = {
    delay: delay,
    getIcon: getIcon,
    toComma: toComma,
    gamemodeConverter: gamemodeConverter,
    toDays: toDays,
    isEqual: isEqual,
    getColors: getColors,
    sendMsg: sendMsg,
    getArgs: getArgs,
    faultyResponse: faultyResponse,
    sanitizeVersion: sanitizeVersion,
    addToMsgStack: addToMsgStack,
    getMsgStack: getMsgStack,
    replaceNumbers: replaceNumbers,
    truncate: truncate,
    arraysEqual: arraysEqual,
}