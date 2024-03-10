const { findUR, updateUR, countUR } = require("./database-module");
const { faultyResponse } = require("./helper-cmds-module");
const { attributeCalc } = require("./mania-calc-module");
const { osu_secret, osu_client_id, increaseAPIUsage, osu_token, setOsuToken, getOsuToken, getUserbase, setUserbase } = require("./variables");

// Gets osu!token (https://osu.ppy.sh/wiki/en/osu%21api)
// .env file needs to have a authorized sercret and client id for function to work.
async function setToken() {
    let item = null;

    const url = new URL("https://osu.ppy.sh/oauth/token");
    let headers = {"Accept": "application/json", "Content-Type": "application/json"};
    let body = {"client_id": osu_client_id, "client_secret": osu_secret, "grant_type": "client_credentials", "scope": "public"}

    const res = await fetch(url, {method: "POST", headers, body: JSON.stringify(body)})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(setToken, res, args);
    item = await res.json();

    setOsuToken(item.access_token);
}

// Returns info about a user.
async function getUser(args) {
    let item = null;
    
    let token   = getOsuToken();
    let user    = args.user_id    || args.username || null;
    let mode    = args.mode       || 'mania';

    if(!user || !token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/users/${user}/${mode}`);
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getUser, res, args);
    item = await res.json();
  
    return item;
}

// Returns users best, firsts or recent scores.
async function getActivity(args) {
    let item = null;
    
    let token   = getOsuToken();
    let user    = args.user_id    || args.username || null;
    let mode    = args.mode       || 'mania';
    let type    = args.type       || 'recent';

    let limit   = args.limit      || '100';
    let fails   = args.fails      || '0';
    let offset  = args.offset     || '0';

    if(!user || !token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/users/${user}/scores/${type}`);
    let params = {"include_fails": fails, "mode": mode, "limit": limit, "offset": offset};
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getActivity, res, args);
    item = await res.json();
  
    return item;
}
 
/**
 * Returns difficulty attributes of beatmap with specific mode and mods combination. 
 * @param {String} beatmap_id - Id of beatmap (required)
 * 
 * @param {String} [mods=[]] - Mods used, default NM (optional)
 * @param {String} [ruleset="mania"] - Gamemode, default mania (optional)
 */
async function getBeatmapAttributes(args) {
    let item = null;
    
    let token   = getOsuToken();
    let beatmap = args.beatmap_id || null;

    let mods    = args.mods       || [];
    let ruleset = args.ruleset    || 'mania';

    if(!beatmap || !token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap}/attributes`);
    let body = {"mods": mods, "ruleset": ruleset}
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    const res = await fetch(url, {method: "POST", headers, body: JSON.stringify(body)})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getBeatmapAttributes, res, args);
    item = await res.json();
  
    return item;
}

/**
 * Gets beatmap data
 * @param {String} beatmap_id - Id of beatmap (required) 
 */
async function getBeatmap(args) {
    let item = null;
    
    let token   = getOsuToken();
    let beatmap = args.beatmap_id || null;

    if(!beatmap || !token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap}`);
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    const res = await fetch(url, { method: "GET", headers })
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getBeatmap, res, args);
    item = await res.json();
  
    return item;
}

/**
* Gets the current ranking for the specified type and game mode.
* @param {String} [type="performance"] - Type of ranking [charts, country, performance, score] (required)
* @param {String} [mode="mania"] - Gamemode, default mania (optional)
*
* @param {String} country - Country code (optional)
* @param {Number} page - Page of rankings (optional)
* @param {String} [mode="mania"] - Gamemode, default mania (optional)
* @param {String} [filter="all"] - Ranking filter (optional)
* @param {String} [variant] - Keycount (optional)
* @returns 
*/
async function getRanking(args) {
    let item = null;
    
    let token   = getOsuToken();
    let mode    = args.mode         || 'mania';

    let country = args.country      || 'SE';
    let page    = args.page         || '0';
    let type    = args.type         || 'performance'; // charts, country, performance, score
    let filter  = args.filter       || 'all'; // all, friends
    let variant = args.variant;

    if(!token || !type) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/rankings/${mode}/${type}`);
    let params = {"country": country, "filter": "all", "page": page};

    if(type == 'performance') {
        if(args.country) params.country = country;
        if(args.variant) params.variant = variant;
    }
    
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getRanking, res, args);
    item = await res.json();
  
    return item;
}

/**
 * Return a User's scores on a Beatmap. Only works on ranked/loved maps.
 * @param {String} user_id - Id of user (required) 
 * @param {String} beatmap_id - Id of beatmap (required)
 * 
 * @param {String} [mode="mania"] - Gamemode, default mania (optional)
 */
async function getUserScores(args) {
    let item = null;
    
    let token   = getOsuToken();
    let user    = args.user_id    || null;
    let beatmap = args.beatmap_id || null;
    let mode    = args.mode       || 'mania';

    if(!user || !beatmap || !token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap}/scores/users/${user}/all`);
    let params = {"mode": mode};
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getUserScores, res, args);
    item = await res.json();
  
    return item;
}

/**
 * Return a User's score on a Beatmap. Only works on ranked/loved maps.
 * @param {String} user_id - Id of user (required) 
 * @param {String} beatmap_id - Id of beatmap (required)
 * 
 * @param {String} [mode="mania"] - Gamemode, default mania (optional)
 */
async function getUserScore(args) {
    let item = null;
    
    let token   = getOsuToken();
    let user    = args.user_id    || null;
    let beatmap = args.beatmap_id || null;
    let mode    = args.mode       || 'mania';

    if(!user || !beatmap || !token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap}/scores/users/${user}`);
    let params = {"mode": mode};
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getUserScore, res, args);
    item = await res.json();
  
    return item;
}

// Returns the top scores for a beatmap (legacy)
async function getScoresLegacy(args) {
    let item = null;
    
    let token   = osu_token;
    let beatmap = args.beatmap_id || null;
    let mode    = args.mode       || 'mania';
    let mods    = args.mods       || [];

    if(!user || !beatmap || !osu_token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap}/scores`);
    let params = {"mode": mode, "mods": mods};
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getScoresLegacy, res, args);
    item = await res.json();
  
    return item;
}

// Returns the top scores for a beatmap.
async function getScores(args) {
    let item = null;
    
    let token   = osu_token;
    let beatmap = args.beatmap_id || null;
    let mode    = args.mode       || 'mania';
    let mods    = args.mods       || [];
    let legacy  = args.legacy     || '0';

    if(!user || !beatmap || !osu_token) return null;

    const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap}/solo-scores`);
    let params = {"mode": mode, "mods": mods, "legacy_only": legacy};
    let headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${token}`};

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const res = await fetch(url, {method: "GET", headers})
    increaseAPIUsage();
  
    if (!res.ok) return await faultyResponse(getScores, res, args);
    item = await res.json();
  
    return item;
}

// Updates users osu! user information
async function updateUser(user, fetchUser) {
    let userbase = getUserbase();

    let user_info = user;
    if(fetchUser) user_info = await getUser({user_id: user.id});
    let index = userbase.findIndex(x => x.id == user.id);

    if(index == -1) return 0;

    for(let key in user_info) {
        if (userbase[index].hasOwnProperty(key)) {
            userbase[index][key] = user_info[key];
        }
    }

    await setUserbase(userbase);
    return userbase[index];
}

// Get user info from database / from api
async function getUserFromDatabase(username) {
    let userbase = getUserbase();
    let index = userbase.findIndex(x => x.username == username);
    let user;
    
    if(index == -1) {
        user = await getUser({username: username});
        if(!user) {
            return null;
        }
    } else {
        user = userbase[index];
    }
    
    return user;
}

// If score contains difficulty altering mods, get map attributes
async function needAttributes(beatmap_id, mods) {
    // If play contains any star rating altering mods, include attributes in activity object
    // if(mods.some(mod => ['DT','NC','HT','DC'].includes(mod) || force_load == true)) {
    let attr = await attributeCalc({beatmap_id: beatmap_id, mods: mods});
    return {star_rating: attr.starRating, max_combo: attr.maxCombo};
}

async function addBestToDatabase(user) {
    let best = await getActivity({user_id: user.id, type: 'best'});

    for([index, play] of best.entries()) {
        if(await checkIfScore(play, user)) continue;

        let type = 'unranked'

        if (play.beatmap.ranked == 1 || play.beatmap.ranked == 2) type = 'ranked'
        if (play.beatmap.ranked == 3) type = 'qualified'
        if (play.beatmap.ranked == 4) type = 'loved'

        play.type = type;
        let attr = await needAttributes(play.beatmap.id, play.mods, true);

        if(attr) {
            play.sr = attr.star_rating.toFixed(2);
            play.max_combo = attr.max_combo;
        } else {
            play.sr = play.beatmap.difficulty_rating;
            play.max_combo = '????'
        }

        await saveScore(play, user);                                // Legacy database handeling, change to be more inline with osu! later
    }
}

async function checkIfScore(activity, user) {
    let scores = await findUR({ map_id: parseInt(activity.beatmap.id)});

    for(let score of scores) {
        if(score.user_id == user.id) {
            if(score.score == activity.score) {
                return true;
            }
        }
    }

    return false;
}

async function saveScore(activity, user) {
    let top_play = {
        map_id: activity.beatmap.id,
        score_id: activity.id,
        title: activity.beatmapset.title,
        creator: activity.beatmapset.creator,
        keys: activity.beatmap.cs + 'K',
        sr: activity.sr,
        pp: activity.pp,
        max_pp: activity.max_pp,
        version: activity.beatmap.version,
        mods: activity.mods,
        rank: activity.rank,
        score: activity.score,
        combo: activity.max_combo,
        max_combo: play.max_combo,
        acc: activity.accuracy,
        count_geki: activity.statistics.count_geki,
        count_300: activity.statistics.count_300,
        count_katu: activity.statistics.count_katu,
        count_100: activity.statistics.count_100,
        count_50: activity.statistics.count_50,
        count_miss: activity.statistics.count_miss,
        card: activity.beatmapset.covers.card,
        pc: activity.perfect,
        date: activity.created_at,
        user_id: user.id,
        username: user.username,
        type: activity.type
    }

    await updateUR({ $and: [{ map_id: activity.beatmap.id }, { user_id: user.id }, { mods: activity.mods }] }, { $set: top_play }, { upsert: true });
}

async function getUserPlays(user_id, type = 'ranked', slice = true) {
    let query = {user_id: user_id, type: type};

    if(type == 'all') query = { user_id: user_id };
    else if(type == 'unranked') query = { $and: [{ user_id: user_id }, { $not: { type: 'ranked' } }] };
    else query = { user_id: user_id, type: type };

    let plays = await findUR(query);

    plays.sort((a , b) => b.pp - a.pp);

    let seen_plays = [];

    for(let i = 0; i < plays.length; i++) {
        if(seen_plays.includes(plays[i].map_id)) {
            plays.splice(i, 1);
            i--;
            continue;
        }
        
        seen_plays.push(plays[i].map_id);
    }

    if(!slice) return plays;
    if(seen_plays.length == 100) return plays.slice(0, 99);
    if(type == 'ranked') return await getActivity({user_id: user.id, type: 'best'});

    return plays;
}

async function getPlayerStats(plays, user_id, type = 'all') {
    if(!plays) plays = await getUserPlays(user_id, type);

    let total_pp = 0;
    let total_acc = 0;

    for(let i = 0; i < plays.length; i++) {
        total_pp = total_pp + (plays[i].pp * 0.95 ** (i));
        total_acc = total_acc + plays[i].acc;
    }

    total_acc = (total_acc / (plays.length || 1)) * 100

    let query;

    if(type == 'all') query = { user_id: user_id };
    else if(type == 'unranked') query = { $and: [{ user_id: user_id }, { $not: { type: 'ranked' } }] };
    else query = { user_id: user_id, type: type };

    return {
        pp: parseFloat(total_pp.toFixed(2)), 
        acc: parseFloat(total_acc.toFixed(2)), 
        beatmap_plays: parseInt(await countUR(query))
    };
}

module.exports = {
    "setToken": setToken,
    "getUser": getUser,
    "getActivity": getActivity,
    "getBeatmapAttributes": getBeatmapAttributes,
    "getBeatmap": getBeatmap,
    "getRanking": getRanking,
    "getUserScores": getUserScores,
    "getUserScore": getUserScore,
    "getScoresLegacy": getScoresLegacy,
    "getScores": getScores,
    "updateUser": updateUser,
    "getUserFromDatabase": getUserFromDatabase,
    "needAttributes": needAttributes,
    "addBestToDatabase": addBestToDatabase,
    "getUserPlays": getUserPlays,
    "getPlayerStats": getPlayerStats
}