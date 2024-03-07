// Database of unranked and ranked scores
const Datastore = require('@seald-io/nedb');
const { getUserbase } = require('./variables');
const UR = new Datastore({ filename: `./db/UR.db` })

//Initalizes the DBs
function initializeDatabase() {
    console.log('Initalizing database..')
    return new Promise(async (resolve, reject) => {
        UR.loadDatabase(async (err, doc) =>  {
            if(err) reject(err);
            else {
                console.log('Indexing database..')
                await UR.ensureIndexAsync({ fieldName: 'map_id' });
                await UR.ensureIndexAsync({ fieldName: 'user_id' });
                console.log('Database loaded!')
                resolve();
            }
        });
    })
}

async function findUR(query, projection, limit, sort) {
    if(!projection) projection = {};
    if(limit && sort) return await UR.findAsync(query, projection).sort(sort).limit(limit);
    return await UR.findAsync(query, projection);
}

async function countUR(query) {
    return await UR.countAsync(query);
}

async function updateUR(query, update_query, options) {
    if(!options) options = {};
    await UR.updateAsync(query, update_query, options);

    UR.persistence.compactDatafile;
}

async function insertUR(doc) {
    await UR.insertAsync(doc);
}

async function updateUnrankedPerformancePoints(user_id) {
    let plays = await UR.findAsync({ user_id: user_id });

    plays.sort((a, b) => b.pp - a.pp);

    let total_performance_points = 0;
    let seen_maps = [];
    let count = 0;

    for(let play of plays) {
        if(seen_maps.indexOf(play.map_id) != -1) continue;

        total_performance_points = total_performance_points + (play.pp * 0.95 ** (count));
        seen_maps.push(play.map_id);
        count++;

        if(count == 100) break;
    }

    let userbase = getUserbase();
    let index = userbase.findIndex(user => user.id == user_id);

    let old_unranked_pp = userbase[index].unranked_pp;
    userbase[index].unranked_pp = total_performance_points.toFixed(2);

    return old_unranked_pp;
}

async function getLowerPPBoundry(user_id) {
    let plays = await UR.findAsync({ user_id: user_id, type: 'ranked' })

    plays.sort((a, b) => b.pp - a.pp);

    let seen_maps = [];
    let lower_boundry = 0;
    let count = 0;

    for(let play of plays) {
        if(seen_maps.indexOf(play.map_id) != -1) continue;

        lower_boundry = play.pp;

        seen_maps.push(play.map_id);

        count++;

        if(count == 100) break;
    }

    return lower_boundry;
}

async function getPosition(user_id, type, performance_points) {
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

    let i = 0;
    while(i < plays.length) {
        if(parseFloat(plays[i].pp) <= parseFloat(performance_points)) return i;
        i++;
    }

    return plays.length;
}

module.exports = {
    "initializeDatabase": initializeDatabase,
    "findUR": findUR,
    "countUR": countUR,
    "updateUR": updateUR,
    "insertUR": insertUR,
    "updateUnrankedPerformancePoints": updateUnrankedPerformancePoints,
    "getLowerPPBoundry": getLowerPPBoundry,
    "getPosition": getPosition,

}