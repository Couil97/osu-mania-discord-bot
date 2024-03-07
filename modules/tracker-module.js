const { findUR, updateUR, insertUR, getLowerPPBoundry, getPosition, updateUnrankedPerformancePoints } = require("./database-module");
const { isEqual, toComma, sendMsg, delay, addToMsgStack } = require("./helper-cmds-module");
const { performanceCalc, performanceCalcMax } = require("./mania-calc-module");
const { updateUser, getUser, getActivity, getRanking, needAttributes } = require("./osu-api-module");
const { makeScore, makeEmbed } = require("./render-module");
const { tracker_rate, getUserbase, wait_cycle, session_end, getDanList, isPostedScores, max_allowed_pp, addPostedScores, getApiUsageCount } = require("./variables")

// Starts the loop
async function startTracker() {
    trackerLoop();
}

/**
 * Tracker event loop
 * @param {Boolean} update - If update user should run or not 
 * @param {Number} current - Current userbase index
 * @param {Object} userbase - Userbase
 */
async function trackerLoop(args) {
    let current = 0, userbase = getUserbase();

    let start_time = Date.now();

    setInterval(async () => {
        // If there's no users in the userbase, wait until next loop to try again
        if(userbase.length != 0) {
            let user = userbase[current];
            let exit_loop = 100;
    
            // Exit loop acts as a fail safe incase all users are stuck in waiting
            do {
                exit_loop--;
                
                if(await checkUserWait(user) != 0) {
                    [current, userbase] = trackerIncrement(current, userbase);
                    user = userbase[current];
                }
                else break;
            } while(exit_loop);

            // Console logs
            let time = (Date.now() - start_time) / 1000 / 60;

            console.log(`\n\nCalls:\t${(getApiUsageCount() / time).toFixed(2)} / min`);
            console.log('User:\t' + user.username);

            if(time > 1) {
                
            }

            // Main tracker functions
            await tracker(user);
    
            [current, userbase] = trackerIncrement(current, userbase);
        }
    }, tracker_rate);
}

// Increases tracker to next user
function trackerIncrement(current, userbase) {
    current++;

    // End of loop, update userbase, reset current
    if(current >= userbase.length) {
        current = 0;
        userbase = getUserbase();
    }

    return [current, userbase];
}

// Updates and checks how many cycles a user has to wait before tracker checks users recent scores
async function checkUserWait(user) {
    if(!user.wait) user.wait = 1;
    user.wait--;

    if(user.wait <= 0) {
        let user_info = await getUser({user_id: user.id});
        
        let time_since = Date.now() - (user.session.activation_time || 0);

        time_since /= 1000;                                 // Seconds
        time_since /= 60;                                   // Minutes
        time_since /= 60;                                   // Hours

        let hours = time_since;

        user.wait = 1 + Math.ceil(time_since / wait_cycle); // Wait cycle (hours)

        if(!Object.hasOwn(user, 'session')) {
            user.session = {};

            user.session.active = false;

            user.session.pp = 0;
            user.session.global_rank = 0;
            user.session.country_rank = 0;
        }

        if(user.session.active && hours >= session_end) {
            user.session.active = false;

            user.session.pp = 0;
            user.session.global_rank = 0;
            user.session.country_rank = 0;
        }

        if(user.wait <= 0) user.wait = 1;

        if(!Object.hasOwn(user, 'current')) user.current = {};

        user.current.global_rank = user.statistics.global_rank;
        user.current.country_rank = user.statistics.country_rank;
        user.current.pp = user.statistics.pp;
        
        await updateUser(user_info, false);

        return 0;
    } else return user.wait;
}

async function tracker(user) {
    // Gets recent activity
    let activities = await getActivity({user_id: user.id, type: 'recent'});
    if(activities.length < 0) return 0

    if(!Object.hasOwn(user, 'session')) user.session = {};

    if(!user.session.active) {
        user.session.active = true;
        user.session.activation_time = Date.now();
    }

    user.session.global_rank -= user.statistics.global_rank - user.current.global_rank;
    user.session.country_rank -= user.statistics.country_rank - user.current.country_rank;
    user.session.pp += user.statistics.pp - user.current.pp;

    await updateUser(user, false);

    for(activity of activities) {
        if(isPostedScores({score: activity.score, beatmap_id: activity.beatmap.id, user_id: user.id})) continue;
        await tracked_score(activity, user);
        await addPostedScores({score: activity.score, beatmap_id: activity.beatmap.id, user_id: user.id});
        await delay(1000);
    }

}

async function tracked_score(activity, user) {
    let dan = getDanInformation(activity);
    let plays = await findUR({ $and: [{ map_id: activity.beatmap.id }, { user_id: user.id }] });

    let attr = await needAttributes(activity.beatmap.id, activity.mods, true);
    if(attr){
        activity.attributes = attr;
    } 

    // Calculates performance points based on sr
    let sr = (Object.hasOwn(activity, 'attributes') ? activity.attributes.star_rating.toFixed(2) : activity.beatmap.difficulty_rating.toFixed(2));
    let performance_points = performanceCalc({sr: sr, acc: activity.accuracy, beatmap: activity.beatmap, score: activity, mods: activity.mods});
    let max_performance_points = performanceCalcMax({sr: sr, beatmap: activity.beatmap});

    activity.max_pp = max_performance_points;

    if(!activity.pp || activity.pp < 10) activity.pp = performance_points;
    let personal_best, is_new = true;

    // If prev score exists, check if pb
    if(plays.length > 0) {
        plays.sort((a, b) => {return b.pp - a.pp || b.score - a.score});

        for(let play of plays) {
            if(!isEqual(activity.mods, play.mods)) continue;

            is_new = false;

            if(parseInt(activity.score) <= parseInt(play.score)) continue;
    
            personal_best = {
                pp_diff: activity.pp - play.pp,
                score_diff: activity.score - play.score,
                accuracy_diff: activity.accuracy - play.acc
            }
        }
    }

    if(!personal_best && !is_new) return 0;
    if(activity.pp > max_allowed_pp) return 0;

    let type = 'unranked'

    if (activity.beatmap.ranked == 1 || activity.beatmap.ranked == 2) type = 'ranked'
    if (activity.beatmap.ranked == 3) type = 'qualified'
    if (activity.beatmap.ranked == 4) type = 'loved'

    activity.type = type;
    activity.personal_best = personal_best;

    await saveScore(activity, user, dan);                                // Legacy database handeling, change to be more inline with osu! later

    let old_unranked_pp = await updateUnrankedPerformancePoints(user.id);
    let lower_boundry = await getLowerPPBoundry(user.id);

    if(activity.pp < lower_boundry && !dan.is_dan) return 0;
    
    let position = await getPosition(user.id, (type == 'ranked') ? 'ranked' : 'all', activity.pp);
    let dan_text = '', pb_text = '', tracker_text = '';

    if(dan.is_dan && dan.passed) dan_text = '\n> ```Passed ' + dan.name + '!```';
    if(personal_best) pb_text = "\n> ```Improvment: " + (personal_best.score_diff > 0 ? '+' + toComma(personal_best.score_diff) : '' + toComma(personal_best.score_diff)) + ' score, ' + (personal_best.accuracy_diff > 0 ? '+' + (Math.round((personal_best.accuracy_diff) * 10000) / 100).toFixed(2) : '' + (Math.round((personal_best.accuracy_diff) * 10000) / 100).toFixed(2)) + '% ```';

    if(type == 'ranked') {
        let pp_diff = (user.statistics.pp - user.current.pp).toFixed(2);
        if(pp_diff > 0) pp_diff = '+' + pp_diff;

        let session_pp = (user.session.pp > 0 ? '+' : '') + user.session.pp.toFixed(2);
        let session_global_rank = (user.session.global_rank > 0 ? '+' : '') + user.session.global_rank.toFixed(0);

        tracker_text = `\n> **#${toComma(user.current.global_rank)} → #${toComma(user.statistics.global_rank)}** (:flag_${user.country.code.toLowerCase()}:: #${toComma(user.current.country_rank)} → #${user.statistics.country_rank}) ${session_global_rank} ranks/sesh`;
        tracker_text += `\n> Total pp: **${(Math.round(user.statistics.pp * 100) / 100).toFixed(2)}** (${pp_diff}pp, ${session_pp}pp/sesh)\n> `
    } else {
        let pp_diff = (user.unranked_pp - old_unranked_pp).toFixed(2);
        if(isNaN(pp_diff)) pp_diff = 0.00;
        if(pp_diff > 0) pp_diff = '+' + pp_diff;

        tracker_text = `\n> Total unranked pp: **${(Math.round(user.unranked_pp * 100) / 100).toFixed(2)}** (${pp_diff}pp)\n> `;
    }

    let score = await makeScore(activity, dan_text, pb_text, tracker_text);
    let emb = await makeEmbed({
        type: type,
        number: position,
        user: user.username,
        user_id: user.id,
        desc: score,
        card: activity.beatmapset.covers.card,
        avatar: activity.user.avatar_url,
        created_at: activity.created_at
    });

    user.channel.forEach(channel => {
        sendMsg(channel, emb);
        addToMsgStack(activity.beatmap.id, channel);
    });

    if(type == 'ranked' && (user.current.country_rank - user.statistics.country_rank > 0)) passedInRank(user)
}

async function passedInRank(user) {
    let amount = user.current.country_rank - user.statistics.country_rank;
    let page = Math.ceil(user.current.country_rank / 50);

    let ranking = await getRanking({country: 'SE', page: page, type: 'country'});

    let post = '';
    let start = user.current.country_rank - 2;
    if(start < 1) start = 1;

    for(let i = start; i < (user.current.country_rank + 1); i++) {
        post += '[' + mode_text + '] **' + activity.user.username + '** passed **' + country.ranking[(i - 1) + userID.statistics.country_rank - ((page - 1) * 50)].user.username + '** achieving rank **#' + userID.statistics.global_rank + '** (#' + userID.statistics.country_rank + ' :flag_se:) \n'
    }

    if (num != -1) {
        sendMsg('977965472169492560', '**+' + num + ' Country Ranks!**\n' + post)
    }
}

function getDanInformation(activity) {
    let dan_list = getDanList();
    let dan = {is_dan: false};

    let index = dan_list.findIndex(dan => dan.id == activity.beatmap.id);
    if(index == -1) return dan;

    if(['NF', 'HT', 'DC', 'EZ'].some(mod => activity.mods.includes(mod))) {
        dan.passed = false;
        return dan;
    }

    if(activity.accuracy > (dan_list[index].acc / 100)) {
        dan.passed = false;
        return dan;
    }

    dan.passed = true;
    dan.name = (dan_list[index].dan.add ? dan_list[index].dan.add : dan_rank + ' ' + dan_list[i].dan.type);

    return dan;
}

async function saveScore(activity, user, dan) {
    let top_play = {
        map_id: activity.beatmap.id,
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
        max_combo: activity.attributes.max_combo,
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
        type: activity.type,
        dan: dan
    }

    // let score_copy = Object.assign({}, activity);
    // delete score_copy.user;
    // score_copy.dan = dan;

    if(activity.personal_best) updateUR({ $and: [{ map_id: activity.beatmap.id }, { user_id: user.id }, { mods: activity.mods }] }, { $set: top_play });
    else insertUR(top_play);
}

module.exports = {
    startTracker: startTracker,
}