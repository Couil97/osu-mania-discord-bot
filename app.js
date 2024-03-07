const { initializeDatabase } = require('./modules/database-module');
const { client } = require('./modules/discord-module');
const { sendMsg } = require('./modules/helper-cmds-module');
const { setToken } = require('./modules/osu-api-module');
const { startTracker } = require('./modules/tracker-module');
const { _track, _flush_tracker, _untrack, _compare, _link, _unlink, _activity, _help, _leaderboard, _ppat, _profile, _map, _scores } = require('./modules/user-commands-module');
const { admin_roles, prefix, admins, discord_token } = require('./modules/variables');
const os = require('os');

// Discord startup //

client.once('ready', async () => {
    console.log('Starting up osu!mania-bot v1.0.0');
    //sendMsg('454449831012728842', 'Booting up..');

    client.user.setActivity('!help -> list of commands');
    client.user.setStatus('online');

    await setToken();

    // Update token every 23 hours and 59 minutes
    setInterval(async () => {
        await setToken();
    }, (1000 * 60 * 60 * 24) - 1000 * 60);

    await initializeDatabase();
    startTracker();
});

// Command handling //

client.on('messageCreate', async function(message) {
    let time = Date.now();

    // Splits incoming message, space is used as a separator. First item always contains the command.
    // The rest of the message contains possible arguments.
    let args = message.content.split(' ');
    let cmd = args[0].toLowerCase();

    // Checks if string contains a prefix (configurable in config)
    let is_cmd = false;

    prefix.forEach(prefix => {
        if(cmd.includes(prefix)) {
            is_cmd = true;
            cmd.replace(prefix, '');
        }
    });

    cmd = cmd.substring(1);                     // Command
    args.shift();                               // Args
    message.args = args;                        // Discord msg obj + args

    // -------- Commands -------- //

    // If command doesn't start with prefix, ignore message.
    if(!is_cmd) return 0;

    switch(cmd) {
        // Displays a users score on a given map.
        // Args: link (string), username (string).
        case 'compare':
        case 'c': 
            await _compare(message); 
            break; 

        // Displays a users best score.
        // Args: score_index (int), username (string).
        case 'best':
        case 'b':
            await _activity(message, 'best');
            break;

        // Displays a users profile (pp, top scores, acc, etc.)
        // Args: username (string).
        case 'profile':
        case 'p':
            await _profile(message);
            break;
        
        // Displays a users recent score.
        // Args: score_index (int), username (string).
        case 'recent':
        case 'r':
            await _activity(message, 'recent'); 
            break;

        // Displays info about a map.
        // Args: link (string), mods ([+]string).
        case 'map':
        case 'm':
            await _map(message); 
            break;

        // Displays info about commands to user.
        // Args:
        case 'help':
        case 'h':
            await _help(message, client); 
            break;

        // Updates a maps leaderboards (adds the missing scores to the database). Only works for ranked / loved maps.
        // Args:
        case 'update':
        case 'u':
            //await _update(message);
            sendMsg(message.channel.id, 'Command not implemented yet');
            break;

        // Links users discord with a osu! username.
        // Args: username (string), userid (int).
        case 'link':
        case 'l':
            await _link(message); 
            break;

        // Unlinks discord user
        // Args: 
        case 'unlink':
        case 'ul':
            await _unlink(message); 
            break;

        // Calculates and shows estimated value of a play.
        // Args: accuracy (int[%]), performance points (string[pp])
        case 'ppat':
        case 'calc':
        case 'lookup':
        case 'ppfor':
            await _ppat(message); 
            break;

        // Displays the top50 of a given country.
        // Args: country code (string).
        case 'countryrank':
        case 'cr':
            //await _cr(message);
            sendMsg(message.channel.id, 'Command not implemented yet'); 
            break;

        // Displays the leaderboards of a given map.
        // Args: link (string), index (int).
        case 'leaderboard':
        case 'lb':
            await _leaderboard(message); 
            break;

        // Shows the dans a user has passed.
        // Args: username (string).
        case 'dans':
        case 'd':
            //await _dans(message);
            sendMsg(message.channel.id, 'Command not implemented yet'); 
            break;

        case 'unranked':
        case 'ur':
        case 'scores':
        case 'score':
        case 's':
            await _scores(message);
            break;
    }

    // ----- Admin Commands ---- //

    let admin = false;

    // Checks if user is admin. Admin roles and admins can be changed in the config.
    let roles = message.member.roles.cache.map(role => role = role.name);
    if(roles.some(r => admin_roles.includes(r))) admin = true;
    if(admins.some(r => r = message.author.id)) admin = true;

    // If user isn't admin, ignore message.
    if(!admin) return 0;

    switch(cmd) {
        // Adds a map to the dan pool. The bot will treat this map as a dan in the future and will post score as if they have passed a dan.
        // Args: link (string), pass condition (int[%]).
        case 'adddan':
        case 'ad':
            //await _add_dan(message); 
            sendMsg(message.channel.id, 'Command not implemented yet'); 
            break;

        // Tracks a given player. What scores you want the bot to post can be configured in the config file.
        // Args: link (string), username (string), userid (string).
        case 'track':
        case 't':
            await _track(message); 
            break;

        // Removes all tracked players (from channel)
        // Args:
        case 'flush':
        case 'f':
            await _flush_tracker(message); 
            break;

        // Untracks a given player.
        // Args: link (string), username (string), userid (string).
        case 'untrack':
        case 'ut':
            await _untrack(message); 
            break;

        // Adds a played to the "update leaderboard" list. This will include their scores in the leaderboard when an update is called but won't track them.
        // Useful if you wish fill out a, say a country leaderboard but don't want to track everyone.
        // Args: link (string), username (string), userid (string).
        case 'll':
            //await _add_ul(message);
            sendMsg(message.channel.id, 'Command not implemented yet'); 
            break;

        // Removes given player from "update leaderboard".
        // Args: link (string), username (string), userid (string).
        case 'rll':
            //await _remove_ul(message);
            sendMsg(message.channel.id, 'Command not implemented yet'); 
            break;
    }
    
    console.log(`\nTime elapsed: ${(Date.now() - time)}ms`);
})

// Error handling //

process.on('uncaughtException', function(err) {

    console.log('\n' + err.message + '\n');
    console.log(err.stack)
});

// Discord login //
  
try {
    client.login(discord_token).catch(console.error);
}
catch {
    os.system("kill 1")
}