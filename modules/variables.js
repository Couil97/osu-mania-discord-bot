require('dotenv').config() // .env for secret variables
const fs = require('fs').promises;

const { checkFiles } = require('./file-modules');

// Command prefix
const prefix = ['!','$', ';'];

// Admin roles
const admin_roles = ['Moderator', 'Mod', 'Admin', 'Owner'];

// Admins (discord IDs)
const admins = [process.env.DISCORD_ID];

// Discord token
const discord_token = process.env.DISCORD_TOKEN;

// osu! secret and client id
const osu_secret = process.env.OSU_SECRET;
const osu_client_id = process.env.OSU_CLIENT_ID;

// osu_token with set/get functions
let osu_token;

function setOsuToken(value) {
    osu_token = value;
}
function getOsuToken() {
    return osu_token;
}

// Amount of hours before session ends
const session_end = 4;

// Maximum allowed performance point play (to stop glitched maps)
const max_allowed_pp = 2500;

// osu!api usage tracker
let api_usage_count = 0;

function increaseAPIUsage() {
    api_usage_count++;
}
function getApiUsageCount() {
    return api_usage_count;
}

// osu!api retry rate
const api_retry_rate = 5000;

// osu!tracker rate
const tracker_rate = 2 * 1000;

// Tracker wait cycle (hours)
const wait_cycle = 3;

checkFiles();
    
// Colors for embeded.
const colors = require("../files/colors.json");

// Beatmap links to their respective files
let beatmaps_links = require('../files/beatmaps.json');
async function setBeatmapLinks(beatmaps) {
    beatmaps_links = beatmaps
    await fs.writeFile('./files/beatmaps.json', JSON.stringify(beatmaps_links), 'utf-8');

    return 0;
}
function getBeatmapsLinks() {
    return beatmaps_links;
}

// Links between discord and osu!
var discord_links = require("../files/discord-links.json");
async function setDiscordLinks(dl) {
    discord_links = dl;
    await fs.writeFile('./files/discord-links.json', JSON.stringify(discord_links), 'utf-8');

    return 0;
}
function getDiscordLinks() {
    return discord_links;
}

// Scores already posted by the bot (10000 limit)
let posted_scores = require("../files/posted_scores.json");
async function addPostedScores(score) {
    posted_scores.push(score);

    if(posted_scores.length > 10000) {
        posted_scores.shift();
    }

    await fs.writeFile('./files/posted_scores.json', JSON.stringify(posted_scores), 'utf-8');

    return 0;
}
function getPostedScores() {
    return posted_scores;
}
function isPostedScores(args) {
    let index = posted_scores.findIndex(item => item.score == args.score && item.beatmap_id == args.beatmap_id && item.user_id == args.user_id);

    if(index == -1) return false;
    else return true;
}

// Userbase for tracker
var userbase = require("../files/userbase.json");
async function setUserbase(ub) {
    userbase = ub;
    await fs.writeFile('./files/userbase.json', JSON.stringify(userbase), 'utf-8');

    return 0;
}
function getUserbase() {
    return userbase;
}

// Dan list
var dan_list = require("../files/dan_list.json");
async function addToDanList(dan) {
    let index = dan_list.findIndex(item => item.id == dan.id);
    if(index != -1) {
        for(key in dan_list) {
            dan_list[key] = dan[key];
        } 
    } else {
        dan_list.push(dan);
    }

    await fs.writeFile('./files/dan_list.json', JSON.stringify(dan_list), 'utf-8');

    return 0;
}
function getDanList() {
    return dan_list
}

module.exports = {
    prefix: prefix,
    admin_roles: admin_roles,
    admins: admins,
    discord_token: discord_token,
    osu_secret: osu_secret,
    osu_client_id: osu_client_id,
    setOsuToken: setOsuToken,
    getOsuToken: getOsuToken,
    increaseAPIUsage: increaseAPIUsage,
    getApiUsageCount: getApiUsageCount,
    session_end: session_end,
    max_allowed_pp: max_allowed_pp,
    api_retry_rate: api_retry_rate,
    tracker_rate: tracker_rate,
    colors: colors,
    setDiscordLinks: setDiscordLinks,
    getDiscordLinks: getDiscordLinks,
    wait_cycle: wait_cycle,
    addPostedScores: addPostedScores,
    getPostedScores: getPostedScores,
    isPostedScores: isPostedScores,
    setUserbase: setUserbase,
    getUserbase: getUserbase,
    addToDanList: addToDanList,
    getDanList: getDanList,
    setBeatmapLinks: setBeatmapLinks,
    getBeatmapsLinks: getBeatmapsLinks,
}