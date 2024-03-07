const { sanitizeVersion, toComma, getColors, toDays, getIcon, replaceNumbers, truncate, sendMsg } = require("./helper-cmds-module");
const { EmbedBuilder } = require("./discord-module");
const { performanceCalc, performanceCalcMax } = require("./mania-calc-module");
const { getUserPlays, getPlayerStats } = require("./osu-api-module");


/**
 * Makes a score string used in embeds.
 * @param {Object} score - Score object combined with beatmap, beatmapset and (optional) attribute object. (required)
*/
async function makeScore(score, dan_text, pb_text, tracker_text) {
    if(score.statistics) Object.assign(score, score.statistics); //Legacy fix

    let sr, max_combo;
    if(Object.hasOwn(score, 'attributes')) {
        sr = score.attributes.star_rating.toFixed(2);
        max_combo = score.attributes.max_combo;
    } else {
        sr = score.beatmap.difficulty_rating.toFixed(2);
        max_combo = score.max_combo || '????';
    }

    let title, creator;

    if(Object.hasOwn(score, 'beatmapset')) {
        title = score.beatmapset.title;
        creator = score.beatmapset.creator; 
    } else {
        title = score.title;
        creator = score.creator;
    }

    let keys, version, beatmap_link;

    if(Object.hasOwn(score, 'beatmap')) {
        keys = score.beatmap.cs + 'K';
        version = sanitizeVersion(score.beatmap.version);
        beatmap_link = score.beatmap.url;
    } else {
        keys = score.keys;
        version = sanitizeVersion(score.version);
        beatmap_link = `https://osu.ppy.sh/beatmaps/${score.map_id}`;
    }

    let user_id;

    if(Object.hasOwn(score, 'user')) {
        user_id = score.user.id;
    } else {
        user_id = score.user_id;
    }

    let mods =          (score.mods.length == 0 ? 'NM' : score.mods);
    let rank =          score.rank;
    let map_score =     toComma(score.score);
    let combo =         score.combo                 || score.max_combo;
    combo =             toComma(combo);
    let acc =           score.accuracy              || score.acc;
    acc =               (acc * 100).toFixed(2);
    let pc =            score.perfect               || score.pc;
    pc =                (pc) ? 'PC' : '';
    let score_link =    score.id || null;
    score_link =        (score_link) ? `https://osu.ppy.sh/scores/${score.id}` : null;
    let user_link =     `https://osu.ppy.sh/users/${user_id}`;
    let pp =            (score.pp && score.pp > 0) ? score.pp : performanceCalc({sr: sr, acc: acc, beatmap: score.beatmap, score: score, mods: score.mods});
    pp =                parseFloat(pp).toFixed(2);
    let max_pp =        await performanceCalcMax({sr: sr, beatmap: score.beatmap, beatmap_id: score.map_id});
    max_pp =            parseFloat(max_pp).toFixed(2);
    let played_time =   score.created_at || score.date;
    played_time =       `Played ${toDays(played_time)}`;

    let desc =  `**${title}** [${creator}] (${sr}★ ${keys}) \`+${mods}\`\n> `;
    desc +=     `${getIcon(rank)} ${version} • **${pp}**pp (${max_pp} mxpp)\n> `;
    desc +=     `Score: **${map_score}**, Combo: **${combo}**/${max_combo}x\n> `;
    desc +=     `**${acc}%** \`[${score.count_geki} • ${score.count_300} • ${score.count_katu} • ${score.count_100} • ${score.count_50} • ${score.count_miss}]\` ${pc}\n> `;
    desc +=     `\n> `;
    desc +=     `${(score_link) ? `**[Score Link](${score_link})** • ` : ''}**[Beatmap Link](${beatmap_link})** • **[User Link](${user_link})**\n> `;

    desc +=     dan_text || '';
    desc +=     pb_text || '';
    desc +=     tracker_text || '';
    desc +=     `\n> `;

    desc +=     `_${played_time} ago_`;

    return desc;
}

async function makePPAt(score, beatmap, user) {
    let mods = score.mods;
    if(mods.length < 1) mods = '+NM';
    else mods = '+' + mods.join(',');

    let msg = '```cc\n\n' + truncate(beatmap.beatmapset.title, 30) + ' [' + sanitizeVersion(beatmap.version) + '] ' + mods + '\n   ▪ ' + toComma(parseFloat(score.pp).toFixed(2)) + 'pp (at ' + score.accuracy.toFixed(2) + '%)' +
    '\n\n  ' + user.username + ' (' + toComma(score.current_pp.toFixed(2)) + 'pp ➞ ' + toComma((score.new_pp).toFixed(2)) + 'pp) ' + (score.delta > 0 ? '+' : '') + score.delta.toFixed(2) + 'pp\n ```';

    return msg;
}

async function makeMap(beatmap, mods) {
	let star_rating = beatmap.difficulty_rating;

	if(Object.hasOwn(beatmap, 'attributes')) {
		star_rating = beatmap.attributes.star_rating.toFixed(2);
	}

	let bpm = beatmap.bpm;
	let od = beatmap.accuracy;
	let hp = beatmap.drain;

	if(mods.includes('DT') || mods.includes('NC')) {
		bpm = 	(bpm * 1.5).toFixed(1);
		od = 	(od * 1.5).toFixed(1);
		hp = 	(hp * 1.5).toFixed(1);
	}
	if(mods.includes('HT') || mods.includes('DC')) {
		bpm = 	(bpm * 0.75).toFixed(1);
		od = 	(od * 0.75).toFixed(1);
		hp = 	(hp * 0.75).toFixed(1);
	}

	if(!mods || mods.length == 0) mods = '+NM';
	else mods = '+' + mods.join(',');

let desc = 	`**${beatmap.beatmapset.title}** [${sanitizeVersion(beatmap.version)}] (${star_rating}★ ${beatmap.cs + 'k'}) \`${mods}\`\nby _${beatmap.beatmapset.creator}_\n\n`;
	desc +=	`> **${'Stats'.padEnd(10, '\u2800')}**\`${makeGrid('BPM', bpm, 3, false)}${makeGrid('OD', od, 3, false)}${makeGrid('HP', hp, 3, true)}\`\n`;
	desc +=	`> **${'Objects'.padEnd(10, '\u2800')}** \`${makeGrid('Rice', beatmap.count_circles, 2, false)}${makeGrid('LNs', beatmap.count_sliders, 2, true)}\`\n`;
	desc +=	`> **${'Plays'.padEnd(10, '\u2800')}**\`${makeGrid('Playcount', beatmap.playcount, 2, false)}${makeGrid('Passcount', beatmap.passcount, 2, true)}\`\n`;
	desc +=	`> **${'Combo'.padEnd(7, '\u2800')}**\u3000 \`${makeGrid('Max Combo', beatmap.max_combo, 1, true)}\`\n> \n`;
	desc +=	'> **Performance points**```';
	desc += `SS%: ${formatPPString(performanceCalc({sr: star_rating, acc: 100, beatmap: beatmap}))}pp | 99%: ${formatPPString(performanceCalc({sr: star_rating, acc: 99, beatmap: beatmap}))}pp | 98%: ${formatPPString(performanceCalc({sr: star_rating, acc: 98, beatmap: beatmap}))}pp\n> 96%: ${formatPPString(performanceCalc({sr: star_rating, acc: 96, beatmap: beatmap}))}pp | 93%: ${formatPPString(performanceCalc({sr: star_rating, acc: 93, beatmap: beatmap}))}pp | 90%: ${formatPPString(performanceCalc({sr: star_rating, acc: 90, beatmap: beatmap}))}pp`;
	desc += '```\n\n'
	desc += `:heart: **${beatmap.beatmapset.favourite_count}**\u3000:arrow_forward: **${beatmap.beatmapset.play_count}**`;
	return desc;
}

function makeGrid(name, value, columns, end) {
	let grid_size = 42 / columns;
	if(end) return String(` ${name}`).padEnd(grid_size - String(value).length - 1, ' ') + value + ' ';
	return String(` ${name}`).padEnd(grid_size - String(value + ' |').length, ' ') + value + ' |';
}

function formatPPString(pp_string) {
	String(pp_string).slice(0,6);

	return pp_string.padEnd(6, '0');
}

/**
 * Makes embed from score
 * @param {String} type - (required)
 * @param {Number} number - (optional)
 * @param {boolean} is_pb - (optional)
 * @param {String} username - (required)
 * @param {String} user_id - (optional)
 * @param {String} desc - (required)
 * @param {String} card - (optional)
 * @param {String} avatar - (optional)
 */
async function makeEmbed(args) {
    let type = args.type || 'unranked';
    let number = (args.number == null ? null : args.number + 1);
    let user = args.user || 'unknown';
    let user_id = args.user_id || user;
    let desc = args.desc || '';
    let card = args.card || null;
    let avatar = args.avatar || null;
    let color = getColors(type);

    let header = `${type[0].toUpperCase() + type.slice(1)} ${(number ? '#' + number + ' ' : '')}score from ${user} ${(args.is_pb ? '￤　NEW PB' : '')}`;
    let footer = `Type !c to compare!`;

    const EMB = new EmbedBuilder()
    .setColor(color)
    .setAuthor({name: header, iconURL: 'https://lemmmy.pw/osusig/img/mania.png', url: `https://osu.ppy.sh/users/${user_id}`})
    .setDescription(desc)
    .setImage(card)
    .setFooter({text: footer, iconURL: avatar})
    .setTimestamp()

    return {embeds: [EMB]};
} 

async function makeBasicEmbed(args) {
    let header = args.header || '';
    let header_link = args.header_link || '';
    let desc = args.desc || '';
    let footer = args.footer || ' ';
    let image = args.image || null;
    let thumbnail = args.thumbnail || null;
    let color = getColors(args.color) || '#808080';
    let timestamp = args.timestamp;
    if(timestamp == null) timestamp = true;

    const EMB = new EmbedBuilder()
    .setColor(color)
    .setAuthor({name: header, iconURL: 'https://lemmmy.pw/osusig/img/mania.png', url: header_link})
    .setDescription(desc)
    .setImage(image)
    .setThumbnail(thumbnail)
    .setFooter({text: footer});
    if(timestamp) EMB.setTimestamp();

    return {embeds: [EMB]};
}

async function makeProfile(user, type) {
    let previous_names = user.previous_usernames;
    let country = user.country.code;
    let follower_count = user.follower_count;
    let mapping_follower_count = user.mapping_follower_count;
    let highest_rank = user.rank_highest.rank;
    let highest_rank_date = user.rank_highest.updated_at;
    let first_amt = user.scores_first_count;
    let global_rank = user.statistics.global_rank;
    let country_rank = user.statistics.country_rank;
    let play_count = user.statistics.play_count;
    let replay_count = user.statistics.replays_watched_by_others;

    let pp, accuracy, beatmap_playcount;
    let plays = await getUserPlays(user.id, type);

    if(type == 'ranked') {
        pp = user.statistics.pp;
        accuracy = user.statistics.hit_accuracy.toFixed(2);
        beatmap_playcount = user.beatmap_playcounts_count;
    } else {
        let stats = await getPlayerStats(plays, user.id, type);
        pp = stats.pp;
        accuracy = stats.acc;
        beatmap_playcount = stats.beatmap_plays;
    }

    pp = pp.toFixed(2) + 'pp';

    let padding = 36 + pp.length;

    let title =     `\n\`\`\`ansi\n\u2800${pp.padStart(Math.ceil(padding / 2), ' ')}\`\`\`\n`;
    let desc =      `\u2800:heart:\u2800**${follower_count}**\u2800\u2800:map:\u2800**${mapping_follower_count}**\n\n`
    desc +=         `**${user.username}**\n\n`;
    desc +=         `**${'Rank'.padEnd(9, '\u2800')}**#${toComma(global_rank)} (:flag_${country.toLowerCase()}: #${toComma(country_rank)})\n`
    desc +=         `**${'Top Rank'.padEnd(10, '\u2800')}**#${highest_rank} (${highest_rank_date.split('T')[0]})\n`;
    desc +=         `**${'Accuracy'.padEnd(10, '\u2800')}**${accuracy}%\n\n`;
    desc +=         `**${'1s'.padEnd(9, '\u2800')}**${first_amt}\n`;
    desc +=         `**${'PC'.padEnd(8, '\u2800')}** ${play_count}\n`;
    desc +=         `**${'Replays'.padEnd(10, '\u2800')}**${replay_count}\n\n`;
    if(previous_names.length > 0) desc += `**${'Alias'.padEnd(10, '\u2800')}**||${truncate(previous_names.slice(0,3).join(', ') + (previous_names.length > 3 ? ', etc.' : ''), 45)}||\n\n`;

    desc +=         '```\n';

    for(let i = 0; i < plays.length && i < 5; i++) {
        plays[i].pp = toComma(parseFloat(plays[i].pp).toFixed(0));
        let title_padding = 36 - (String(plays[i].pp) + 'pp').length

        desc += `${i+1}. ${truncate(plays[i].title, title_padding).padEnd(title_padding, ' ')} ${plays[i].pp}pp\n`;
    }

    desc +=         '\n```';

    return title + desc;
}

async function makeUserScores(user, type, page = 0) {
    let plays = await getUserPlays(user.id, type, false);
    let stats = await getPlayerStats(plays, user.id, type);

    let pp_length = 60 - 16 - 6 - 4;

    let stats_string = '```ansi\n \n' + `${' '.repeat(4) + 'Total PP:'.padEnd(16, ' ')} \u001b[1;32m${(stats.pp + 'pp').padStart(pp_length, ' ')}\n\u001b[0;0m${' '.repeat(4) + 'Accuracy:'.padEnd(16, ' ')} \u001b[1;32m${(stats.acc + '%').padStart(pp_length, ' ')}\n\u001b[0;0m${' '.repeat(4) + 'Beatmaps Played:'.padEnd(16, ' ')} \u001b[1;32m${String(stats.beatmap_plays).padStart(pp_length, ' ')}` + '\n \n```';

    let desc = '';

    plays = plays.splice(page, 5);

    let counter = page + 1; 

    for(let play of plays) {
        let mods = play.mods;
        if(mods.length < 1) mods = '';  
        else mods = ' `+' + mods.join(',') + '`';

        let title = truncate(play.title, 42);
        if((title.match(/\[/g) || []).length - (title.match(/\]/g) || []).length) title = title.split('[')[0];

        desc += `**${counter}﹒ [${title}](https://osu.ppy.sh/beatmaps/${play.map_id})** [${play.creator}] (${parseFloat(play.sr).toFixed(2)}★ ${play.keys})${mods}\n`;
        desc += `> ${getIcon(play.rank)} ${sanitizeVersion(play.version)} • **${toComma(parseFloat(play.pp).toFixed(2))}**pp\n`;
        desc += `> **${(play.acc * 100).toFixed(2)}%** Score: **${toComma(play.score)}** Combo: **${toComma(play.combo)}**/${toComma(play.max_combo)}x\n\n`

        counter++;
    }

    return desc + stats_string;
}

async function makeMapEmbed(args) {
	let desc = args.desc;
	let card = args.card;
	let color = getColors(args.color);

	const EMB = new EmbedBuilder()
	.setColor(color)
    .setDescription(desc)
	.setImage(card)

    return {embeds: [EMB]};
}

function makeHelpEmbed(discord_bot, desc) {
    let color = getColors('help');

    const EMB = new EmbedBuilder()
    .setColor(color)
    .setThumbnail('https://cdn.discordapp.com/' + 'avatars/' + discord_bot.id + '/' + discord_bot.avatar + '.png')
    .setAuthor({ name: 'OSUBOTTER Commands' })
    .setDescription(desc)
    .setTimestamp()

    return {embeds : [EMB]};
}

module.exports = {
    "makeScore": makeScore,
    "makeEmbed": makeEmbed,
    "makeMap": makeMap,
	"makeMapEmbed": makeMapEmbed,
    "makeHelpEmbed": makeHelpEmbed,
    "makeBasicEmbed": makeBasicEmbed,
    "makePPAt": makePPAt,
    "makeProfile": makeProfile,
    "makeUserScores": makeUserScores,
}