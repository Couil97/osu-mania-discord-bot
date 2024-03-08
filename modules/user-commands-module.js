const { findUR } = require("./database-module");
const { sendMsg, getArgs, addToMsgStack, getMsgStack, truncate } = require("./helper-cmds-module");
const { performanceCalc, accuracyCalc } = require("./mania-calc-module");
const { getActivity, getBeatmapAttributes, getUserScores, getUserFromDatabase, getBeatmap, needAttributes, addBestToDatabase, getUserPlays, getRanking } = require("./osu-api-module");
const { makeScore, makeEmbed, makeHelpEmbed, makeBasicEmbed, makePPAt, makeProfile, makeMap, makeMapEmbed, makeUserScores } = require("./render-module");
const { getUserbase, setUserbase, getDiscordLinks, setDiscordLinks } = require("./variables");

// ---- Tracking Commands ---- //

async function _track(message) {
    // If username isn't provided, ignore msg
    let args = getArgs(message);

    let country = args.country;
    let lowerLimit = 0;
    let upperLimit = 49;

    if(typeof args.number == 'object') {
        lowerLimit = args.number[0];
        upperLimit = args.number[1];
    } else {
        upperLimit = args.number ?? 49;
    }

    let users = [];

    if(args.option == 'list') {
        let userbase = getUserbase();

        let users = [];

        for(let user of userbase) {
            if(user.channel.indexOf(message.channel.id) > -1) users.push((users.length + 1) + '. ' + user.username);
        }

        sendMsg(message.channel.id, `List of tracked users:\n${users.join('\n')}`);
        return 0;
    }

    if(country) {
        if(lowerLimit < 0) lowerLimit = 0;
        if(upperLimit > 200) upperLimit = 200;

        if(lowerLimit > 0) sendMsg(message.channel.id, `Tracking top ${lowerLimit+1}-${upperLimit+1} of ${country}`);
        else sendMsg(message.channel.id, `Tracking top ${upperLimit+1} of ${country}`);
        sendMsg(message.channel.id, 'Updating top-plays..');

        let first_page = Math.floor(lowerLimit / 50);
        let pages = Math.ceil(upperLimit / 50);
        let rankings = [];

        for(let i = first_page; i < pages; i++) {
            let res = await getRanking({type: 'performance', country: country, page: (pages-1)});
            rankings = rankings.concat(res.ranking);
        }

        rankings = rankings.slice((lowerLimit + 1), (upperLimit + 1));
        users = rankings.map(x => {
            let statistics = Object.assign(x);
            x = Object.assign(x.user);
            
            delete statistics.user;
            x.statistics = statistics;

            return x;
        })
    } else {
        args = await validateArgs({
            username: args.username,
        }, message.channel.id, '!track');

        users.push(args.user);

        if(!args) return 0;
    }

    let userbase = getUserbase();

    for(let user of users) {
        // Check if user is in database. If yes, check if channel is in database
        let idx = userbase.findIndex(x => x.id == user.id);
        if(idx > -1) {
            if(userbase[idx].channel.indexOf(message.channel.id) > -1) {
                if(users.length < 2) sendMsg(message.channel.id, `${user.username} already tracked!`);
                continue;
            } else {
                userbase[idx].channel.push(message.channel.id);
                await setUserbase(userbase);
            }
        }

        if(!country) sendMsg(message.channel.id, `Tracking user: ${user.username}`);
        
        let timer = Date.now();

        // If user hasn't been tracked, create a new 
        if(idx == -1) {
            user.channel = [message.channel.id];
            user.unranked_pp = 0;

            userbase.push(user);
            await setUserbase(userbase);

            if(!country) sendMsg(message.channel.id, 'Updating top-plays..');
            await addBestToDatabase(user);
        }
    }
}

async function _flush_tracker(message) {
    let userbase = getUserbase();
    
    // Removes user if they're in a channel
    // If channel array is empty, remove user
    for(let i = 0; i < userbase.length; i++) {
        let index = userbase[i].channel.indexOf(message.channel.id);
        if (index > -1) {
            userbase[i].channel.splice(index, 1);
            if(userbase[i].channel.length == 0) {
                userbase.splice(i, 1);
                i--;
            }
        }
    }

    await setUserbase(userbase);
    sendMsg(message.channel.id, `Flushed tracker in channel: ${message.channel.name}`);

    return 0;
}

async function _untrack(message) {
    // If username isn't provided, ignore msg
    let args = getArgs(message);
    let username = args.username
    
    let userbase = getUserbase();
    
    // Looks for user, if no user return
    let user_index = userbase.findIndex(user => user.username = username);
    if (user_index == -1) {
        sendMsg(message.channel.id, `User is not tracked!`);
        return 0;
    }
    
    // Looks for channel, if no channel return
    let channel_index = userbase[user_index].channel.indexOf(message.channel.id);
    if (channel_index == -1) {
        sendMsg(message.channel.id, `User is not tracked!`);
        return 0;
    }

    // Removes user from channel. If channel is empty, remove user
    userbase[user_index].channel.splice(channel_index, 1);
    if(userbase[user_index].channel.length == 0) {
        userbase.splice(user_index, 1);
    }

    await setUserbase(userbase);
    sendMsg(message.channel.id, `Untracked ${username} in channel: ${message.channel.name}`);

    return 0;
}

// ---- Activity Commands ---- //

/**  
    @param {String} username
    @param {Number} cursor 
    @returns 
*/
async function _activity(message, type) {
    // If username isn't provided, ignore msg
    let args = getArgs(message);
    let cursor, activity, attr;

    if(args.type) {
        args = await validateArgs({
            username: args.username,
            number: args.number,
            type: args.type,
        }, message.channel.id, `!${type.substring(0,1)}`);

        let user = args.user;
        cursor = args.number;
        activity = await getUserPlays(user.id, args.type, false);

        activity.sort((a,b) => b.pp - a.pp);

        if(cursor > activity.length - 1) cursor = activity.length - 1;

        activity[cursor].user = user;

        attr = await needAttributes(activity[cursor].map_id, activity[cursor].mods);
        if(attr) activity[cursor].attributes = attr;
    } else {
        args = await validateArgs({
            username: args.username,
            cursor: args.number,
            activity: null,
            type: type,
        }, message.channel.id, `!${type.substring(0,1)}`);

        if(!args) return 0;
    
        cursor = args.cursor;
        activity = args.activity;

        attr = await needAttributes(activity[cursor].beatmap.id, activity[cursor].mods);
        if(attr) activity[cursor].attributes = attr;
    }

    let score = await makeScore(activity[cursor]);

    let emb = await makeEmbed({
        type: type,
        number: cursor,
        user: activity[cursor].user.username,
        user_id: activity[cursor].user.id,
        desc: score,
        card: activity[cursor].card || activity[cursor].beatmapset.covers.card,
        avatar: activity[cursor].user.avatar_url,
        created_at: activity[cursor].created_at || activity[cursor].date
    });

    sendMsg(message.channel.id, emb);
    addToMsgStack(activity[cursor].map_id || activity[cursor].beatmap.id, message.channel.id);
}

// --- Comparison Commands --- //

/**  
    @param {String} username
    @param {Number} cursor
    @param {String} link
    @returns 
*/
async function _compare(message) {
    // If username isn't provided, ignore msg
    let args = getArgs(message);

    args = await validateArgs({
        username: args.username,
        beatmap_id: args.beatmap_id,
        index: args.number,
    }, message.channel.id, '!c');

    if(!args) return 0;

    let user = args.user;
    let beatmap_id = args.beatmap_id

    // Gets scores, beatmap from osu!api
    let scores = await getUserScores({user_id: user.id, beatmap_id: beatmap_id});
    let beatmap = await getBeatmap({beatmap_id: beatmap_id});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    if(!scores || scores.scores.length == 0) {
        scores = await findUR({ $and: [{ user_id: user.id }, { map_id: beatmap.id }] });
        if(scores.length == 0) {
            sendMsg(message.channel.id, `No scores from ${user.username} found`);
            return 0;
        }
    } else {
        scores = scores.scores;
    }
    
    let is_dt = false, is_ht = false;
    
    for(let score of scores) {
        if(score.mods.some(mod => ['DT','NC'].includes(mod))) {
            is_dt = true;
        }

        if(score.mods.some(mod => ['HT','DC'].includes(mod))) {
            is_ht = true;
        }
    }

    let dt_attributes, ht_attributes;

    if(is_dt) dt_attributes = await getBeatmapAttributes({beatmap_id: beatmap_id, mods: ['DT']});
    if(is_ht) dt_attributes = await getBeatmapAttributes({beatmap_id: beatmap_id, mods: ['HT']});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    let desc = '';

    for(let i = 0; i < scores.length; i++) {

        scores[i].beatmapset = beatmap.beatmapset;
        scores[i].beatmap = beatmap;

        scores[i].user = user;

        if(scores[i].mods.some(mod => ['DT','NC'].includes(mod))) {
            scores[i].attributes = dt_attributes.attributes;
        }

        if(scores[i].mods.some(mod => ['HT','DC'].includes(mod))) {
            scores[i].attributes = ht_attributes.attributes;
        }

        desc += await makeScore(scores[i]);
        if(i != scores.length - 1) desc += '\n \n';
    }

    let emb = await makeEmbed({
        type: 'compare',
        user: user.username,
        user_id: user.id,
        desc: desc,
        card: beatmap.beatmapset.covers.card,
        avatar: user.avatar_url,
    });

    sendMsg(message.channel.id, emb);
    addToMsgStack(beatmap.id, message.channel.id);

}

/**
 * Command to view a maps leaderboard.
 * @param {String} link - Link to beatmap (required)
 * @param {Number} cursor - Cursor (optional)
 * @param {String} username - Username (optional)
 * 
*/
async function _leaderboard(message) {    
        // If beatmap isn't provided, ignore msg
        let args = getArgs(message);

        args.number = args.number || 0;

        let username = args.username || null;
        let mods = args.mods || null;
        let sort = args.sort || 'score';
        let option = args.option || [];

        args = await validateArgs({
            beatmap_id: args.beatmap_id,
            index: args.number,
        }, message.channel.id, '!lb');
    
        if(!args) return 0;

        let beatmap_id = parseInt(args.beatmap_id);

        let plays = [];

        //if(mods.length > 0) plays = await findUR({map_id: beatmap_id, mods: mods});
        plays = await findUR({ map_id: beatmap_id });
        let scores_amt = plays.length;

        if(plays.length == 0) {
            sendMsg(message.channel.id, 'No plays found on this map!' + (scores_amt > 0 ? '\nType !lb --all to show all scores!' : ''));
            return 0;
        }
        
        let title = plays[0].title;
        let version = plays[0].version;
        let card = plays[0].card;

        plays.sort((a, b) => b.pp - a.pp);
        let highest_pp = parseInt(String(plays[0])).toFixed(0);

        plays.sort((a, b) => b[sort] - a[sort]);

        let userbase = getUserbase();

        if(!option.includes('all')) {
            let seen_users = [];

            for(let i = 0; i < plays.length; i++) {
                if(seen_users.includes(plays[i].user_id)) {
                    plays.splice(i, 1);
                    i--;
                    continue;
                }

                if(userbase.findIndex(user => user.id == plays[i].user_id && user.channel.includes(message.channel.id)) == -1) {
                    plays.splice(i, 1);
                    i--;
                    continue;
                }
                
                seen_users.push(plays[i].user_id);
            }
        }
        
        //                    4                    36 
        let desc = '```ansi\nRANK                SCORES               \n';
        desc +=             '----+------------------------------------\n';

        let counter = 1;

        //if(beatmap.ranked > 0) updateLeaderboard()            //Later

        for(let play of plays) {
            if(counter > 999) break;

            let row = `#${counter}`.padEnd(4, ' ');
            counter++;

            let row_space = 36;

            let mods = '+' + play.mods.join('') + ' ';
            if(play.mods.length == 0) mods = '';
            let score = String(play.score).substring(0, 3);
            if(score == 1000000) score = '1000';
            let accuracy = (play.acc * 100).toFixed(2);
            if(accuracy == 100) accuracy = '100.0';
            
            row_space -= 8;                                     //_99.99%_
            if(mods.length) row_space -= mods.length            //_+DTMR
            row_space -= 1 + score.length;                      //_999k _1000k
            row_space -= 1 + (highest_pp.length + 2);           //_1000pp

            let user = play.username.replace(/\[.*\]/g, '');
            user = truncate(user, row_space);

            row += `| ${accuracy}% ${user.padEnd(row_space)}${mods}${score}k ${parseInt(play.pp)}pp\n`;
            desc += (String(username).toLowerCase() == String(play.username).toLowerCase() ? '\u001b[1;32m' + row + '\u001b[0m' : row);
        }

        desc +=         '----+------------------------------------```';

        let EMB = await makeBasicEmbed({
            color: 'leaderboard',
            header: `${title} [${version.replace(/\[.k\]/,'')}]`,
            header_link: `https://osu.ppy.sh/beatmaps/${beatmap_id}`,
            desc: desc,
            image: card,
            footer: `Showing ${plays.length} plays out of ${scores_amt}. Type !lb --all to see all plays`
        })

        sendMsg(message.channel.id, EMB)
}

// ----- Discord Commands ---- //

async function _link(message) {
    // If username isn't provided, ignore msg
    let args = getArgs(message);
    let username = args.username || null;

    if(!username) {
        sendMsg(message.channel.id, 'No username given!')
        return 0;
    }

    // Gets user data from database/api
    let user = await getUserFromDatabase(username);
    let discord_links = getDiscordLinks();
    let index = discord_links.findIndex(link => link.discord_id == message.author.id);

    if(index != -1) {
        if(discord_links[index].user_id == user.id) {
            sendMsg(message.channel.id, 'User already linked to this discord account!');
            return 0;
        }

        discord_links[index].user_id = user.id;
    } else {
        discord_links.push({user_id: user.id, discord_id: message.author.id});
    }

    await setDiscordLinks(discord_links);

    sendMsg(message.channel.id, `${user.username} now linked to ${message.author}`);
    return 0;
}

async function _unlink(message) {
    let discord_links = getDiscordLinks();
    let index = discord_links.findIndex(link => link.discord_id == message.author.id);

    if(index == -1) {
        sendMsg(message.channel.id, `No osu! account is linked to ${message.author.name}!`);
        return 0;
    }

    discord_links.splice(index,1);

    await setDiscordLinks(discord_links);
    sendMsg(message.channel.id, `Removed link to ${message.author}`);
}

// ------ Help Commands ------ //

async function _help(message, client) {
    let discord_bot = await client.users.fetch("954463913376878633");

    let desc = '**User commands**:';

    desc += '\n\n';

    desc += '`!c`\n';
    desc += 'Displays a users score on a given map\n'
    desc += 'Args: user-link **OR** username';

    desc += '\n\n';

    desc += '`!b`\n';
    desc += 'Displays a users best score\n'
    desc += 'Args: username, score-index (optional), type [all, ranked, ...] (optional)'

    desc += '\n\n';

    desc += '`!p`\n';
    desc += 'Displays a users profile (pp, top scores, acc, etc.)\n'
    desc += 'Args: username, type [all, ranked, ...] (optional)';

    desc += '\n\n';

    desc += '`!r`\n';
    desc += 'Displays a users recent score\n'
    desc += 'Args: username, score-index (optional)';

    desc += '\n\n';

    desc += '`!m`\n';
    desc += 'Displays info about a map\n'
    desc += 'Args: beatmap-link, mods (optional, ex: +DT)';

    desc += '\n\n';

    desc += '`!update`\n';
    desc += 'Updates a maps leaderboards (adds the missing scores to the database). Only works for ranked / loved maps\n'
    desc += 'Args: beatmap-link (optional)';

    desc += '\n\n';

    desc += '`!link`\n';
    desc += 'Links users discord with a osu! username\n'
    desc += 'Args: username **OR** user-link';

    desc += '\n\n';

    desc += '`!unlink`\n';
    desc += 'Unlinks discord account from given osu! username\n'
    desc += 'Args:';

    desc += '\n\n';

    desc += '`!ppat`\n';
    desc += 'Calculates and shows estimated value of a play\n'
    desc += 'Args: beatmap-link, accuracy (ex: 99%) **OR** performance points (ex: 99pp)';

    desc += '\n\n';

    desc += '`!cr`\n';
    desc += 'Displays the top 50 of a given country\n'
    desc += 'Args: country-code (ex: SE)';

    desc += '\n\n';

    desc += '`!lb`\n';
    desc += 'Displays the local leaderboards of a given map\n'
    desc += 'Args: link (optional), index (optional)';

    desc += '\n\n';

    desc += '`!dans`\n';
    desc += 'Shows the dans a user has passed\n'
    desc += 'Args: username (optinal if !linked)';

    desc += '\n\n\n\n**Admin commands**:';

    desc += '\n\n';

    desc += '`!add-dan`\n';
    desc += 'Adds a map to the dan pool. The bot will treat this map as a dan in the future and will always post a score of it if it\'s a pb\n'
    desc += 'Args: beatmap-link, pass condition (ex: 96%)';

    desc += '\n\n';

    desc += '`!track`\n';
    desc += 'Tracks a given player\n'
    desc += 'Args: user-link **OR** username **OR** country code (optional), start index (optional), end index';

    desc += '\n\n';

    desc += '`!flush`\n';
    desc += 'Removes all tracked players (from the discord channel)\n'
    desc += 'Args:';

    desc += '\n\n';

    desc += '`!untrack`\n';
    desc += 'Untracks a single player\n'
    desc += 'Args: user-link **OR** username';

    let msg = makeHelpEmbed(discord_bot, desc);
    sendMsg(message.channel.id, msg);
}

// ------- PP Commands ------- //

async function _ppat(message) {
    // If beatmap isn't provided, ignore msg
    let args = getArgs(message);

    let username = args.username || null;
    let beatmap_id = args.beatmap_id;
    let sr = args.sr;
    let mods = args.mods;
    let ratio = args.ratio || null;

    if(!beatmap_id) {
        beatmap_id = getMsgStack(message.channel.id, args.number);
    }

    if(!beatmap_id && !sr) {
        sendMsg(message.channel.id, `You need to provide a **beatmap link**. \n!ppat <beatmap-link> <pp|acc>`);
        return 0;
    }

    let user;
    if(username) {    
        // Gets user data from database/api
        user = await getUserFromDatabase(args.username);
    }

    let pp = args.pp;
    let accuracy = args.acc;

    if(!pp && !accuracy) {
        sendMsg(message.channel.id, `You need to provide atleast one of **pp** or **accuracy** for command to work. \n!ppat <beatmap-link | star-rating> <pp | acc>`);
        return 0;
    }

    let beatmap = await getBeatmap({beatmap_id: beatmap_id});
    let attr = await needAttributes(beatmap_id, mods);                      // Legacy function, replace when mania_sr_calc works

    if(attr) sr = attr.star_rating;
    else if(!sr) sr = beatmap.difficulty_rating;

    if(pp) {
        accuracy = accuracyCalc({sr: sr, pp: pp, beatmap: beatmap, mods: mods, ratio: ratio});
    } else {
        pp = performanceCalc({sr: sr, acc: accuracy, beatmap: beatmap, ratio: ratio});
    }

    let best = await getUserPlays(user.id);
    let current_pp = 0, new_pp = 0, found = false;

    for (let i = 0; i < best.length; i++) {
        current_pp = current_pp + (best[i].pp * 0.95 ** (i));
    }

    for (let i = 0; i < best.length; i++) {
        if(pp > best[i].pp && found == false) {
            best.splice(i, 0, { pp: pp});
            best.pop();

            found = true;
        }

        new_pp = new_pp + (best[i].pp * 0.95 ** (i));
    }

    let bonus_pp = user.statistics.pp - current_pp;
    
    current_pp += bonus_pp;
    new_pp += bonus_pp;

    let delta = new_pp - current_pp;
    let msg = await makePPAt({
        pp: pp,
        accuracy: accuracy,
        mods: mods,
        current_pp: current_pp,
        new_pp: new_pp,
        delta: delta
    }, beatmap, user);

    sendMsg(message.channel.id, msg);
}

// --- Statistical Commands -- //

async function _profile(message) {
    let args = getArgs(message);

    let type = args.type;

    args = await validateArgs({
        username: args.username,
    }, message.channel.id, `!p`);

    if(!args) return 0;

    let user = args.user;

    if(!user.statistics.global_rank && type == 'ranked') {
        sendMsg(message.channel.id, `${user.username} does not have a mania rank!`);
        return 0;
    }

    let desc = await makeProfile(user, type);
    let EMB = await makeBasicEmbed({
        desc: desc, 
        //thumbnail: user.avatar_url, 
        header: `${user.username}'s ${type} profile!`, 
        header_link: `https://osu.ppy.sh/users/${user.id}`,

    });

    sendMsg(message.channel.id, EMB);
}

async function _map(message) {
    let args = getArgs(message);

    args = await validateArgs({
        beatmap_id: args.beatmap_id,
        index: args.number,
        mods: args.mods
    }, message.channel.id, `!m`);

    let mods = args.mods;
    let beatmap_id = args.beatmap_id

    let beatmap = await getBeatmap({beatmap_id: beatmap_id});   

    let attr = await needAttributes(beatmap.id, mods);
    if(attr) beatmap.attributes = attr;

    let desc = await makeMap(beatmap, mods);
    let EMB = await makeMapEmbed({desc: desc, card: beatmap.beatmapset.covers.card, color: beatmap.status});
    
    sendMsg(message.channel.id, EMB);
    addToMsgStack(beatmap.id, message.channel.id);
}

async function _scores(message) {
    let args = getArgs(message);
    let type = args.type || 'all';
    let cursor = args.number;

    args = await validateArgs({
        username: args.username,
    }, message.channel.id, `!scores`);

    if(!args) return 0;
    let user = args.user;

    let desc = await makeUserScores(user, type, cursor);
    let EMB = await makeBasicEmbed({
        desc: desc, 
        header: `${user.username}'s ${type} scores!`, 
        header_link: `https://osu.ppy.sh/users/${user.id}`,
        footer: `\u2800`.repeat(60) + '\n',
        timestamp: false
    });

    sendMsg(message.channel.id, EMB);
}

// --- Validation Commands --- //

async function validateArgs(args, channel, cmd) {
    if(Object.hasOwn(args, 'username')) {
        if(!args.username) {
            sendMsg(channel, `No username given! Please type ${cmd} <username>`)
            return null;
        }
    
        // Gets user data from database/api
        args.user = await getUserFromDatabase(args.username);
    
        if(!args.user) {
            sendMsg(channel, `${args.username} is not a user`);
            return null;
        }
    }
    
    if(Object.hasOwn(args, 'beatmap_id') && !args.beatmap_id) {
        args.beatmap_id = getMsgStack(channel, args.index);
        if(!args.beatmap_id) {
            sendMsg(channel, `No beatmap found! Please type ${cmd} <beatmap link>`);
            return null;
        }
    }

    if(Object.hasOwn(args, 'activity')) {
        // Gets activity
        args.activity = await getActivity({user_id: args.user.id, type: args.type});

        if(args.activity.length < 0 || !args.activity) {
            sendMsg(channel, `No ${args.type} plays for ${args.user.username}`);
            return 0
        }

        if(Object.hasOwn(args, 'cursor') && args.cursor > args.activity.length) {
            sendMsg(channel, `Out of range, ${args.user.username} only has ${args.activity.length} ${args.type} scores!`);
            return 0
        }
    }

    return args;
}

module.exports = {
    "_track": _track,
    "_flush_tracker": _flush_tracker,
    "_untrack": _untrack,
    "_activity": _activity,
    "_compare": _compare,
    "_link": _link,
    "_unlink": _unlink,
    "_help": _help,
    "_leaderboard": _leaderboard,
    "_ppat": _ppat,
    "_profile": _profile,
    "_map": _map,
    "_scores": _scores,
}