const { BeatmapDecoder } = require('osu-parsers');
const { ManiaRuleset } = require('osu-mania-stable');
const { saveBeatmap } = require('./file-modules');
const { increaseAPIUsage, getBeatmapsLinks, setBeatmapLinks } = require('./variables');
const { delay } = require('./helper-cmds-module');

/**
 * Calculates pp based on sr, acc and beatmap
 * @param {number} sr - Star rating 
 * @param {number} acc - Accuracy 
 * @param {object} beatmap - Beatmap object
 */
function performanceCalc(args) {
    let sr = args.sr || 0;

    let acc = args.acc || null;
    let score = args.score || null;

    let mods = args.mods || [];
    let beatmap = args.beatmap || null;

    let ratio = args.ratio || null;

    if(!sr || !acc || !beatmap) return 0;

    let multiplier = 8;
    let total_hits = (
        beatmap.count_circles +
        beatmap.count_sliders +
        beatmap.count_spinners
    )

    //Assumes .78 ~1/5.0 ratio as the best ratio a player can get
    //Assumes .28 ~3.5/1 ratio as the lowest ratio a player can get

    let x = (beatmap.count_circles / beatmap.count_sliders)
    let adj = (((acc - 95) * 20) / 100)
    adj = (adj < 0 ? 0 : adj);

    if (ratio && ratio.length == 2) {
        let customRatio = ratio[0] / (ratio[0] + ratio[1]);
        customAcc = ((300 + (20 * customRatio)) / 320 / 100) * acc;
    } else if (ratio && ratio.length >= 5) {
        customAcc = (
            (ratio[0] * 320 +
                ratio[1] * 300 +
                ratio[2] * 200 +
                ratio[3] * 100 +
                ratio[4] * 50)
            / (total_hits * 320)
        )
    }
    else if (!score) { 
        let customRatio = (0.50 * Math.max(adj, (x / (x + 1)))) + 0.28;
        customAcc = ((300 + (20 * customRatio)) / 320 / 100) * acc;
    }
    else {
        customAcc = (
            (score.statistics.count_geki || score.count_geki * 320 +
                score.statistics.count_300 || score.count_300 * 300 +
                score.statistics.count_katu || score.count_katu * 200 +
                score.statistics.count_100 || score.count_100 * 100 +
                score.statistics.count_50 || score.count_50 * 50)
            / (total_hits * 320)
        )
    }

    let strainValue = Math.pow(Math.max(sr - 0.15, 0.05), 2.2);
    strainValue *= Math.max(0, 5 * customAcc - 4);
    strainValue *= (1 + 0.1 * Math.min(1, total_hits / 1500));

    if (mods.includes('NF')) multiplier *= 0.75;
    if (mods.includes('SO')) multiplier *= 0.95;
    if (mods.includes('EZ')) multiplier *= 0.50;

    return (strainValue * multiplier).toFixed(2);
}

/**
 * Calculates max pp based on sr, acc and beatmap
 * @param {number} sr - Star rating 
 * @param {number} acc - Accuracy 
 * @param {object} beatmap - Beatmap object
 */
async function performanceCalcMax(args) {
    let sr = args.sr || 0;
    let mods = args.mods || [];
    let beatmap = args.beatmap || null;

    let beatmap_id = args.beatmap_id || null;
    if(beatmap_id) {
        const decoder = new BeatmapDecoder();
        const decodePath = `./beatmaps/${beatmap_id}.osu`;
        
        // Get beatmap object.
        const parsed = await decoder.decodeFromPath(decodePath, {
            parseGeneral: false,
            parseEditor: false,
            parseMetadata: false,
            parseDifficulty: false,
            parseEvents: false,
            parseTimingPoints: false,
            parseStoryboard: false,
            parseColours: false,
          });

        beatmap = {total_hits: parsed.hitObjects.length};
    }

    if(!sr || !beatmap) return 0;
    
    let multiplier = 8;
    let total_hits = beatmap.total_hits || (
        beatmap.count_circles +
        beatmap.count_sliders +
        beatmap.count_spinners
    )

    let strainValue = Math.pow(Math.max(sr - 0.15, 0.05), 2.2);
    strainValue *= Math.max(0, 5 * 1 - 4);
    strainValue *= (1 + 0.1 * Math.min(1, total_hits / 1500));

    if (mods.includes('NF')) multiplier *= 0.75;
    if (mods.includes('SO')) multiplier *= 0.95;
    if (mods.includes('EZ')) multiplier *= 0.50;

    return (strainValue * multiplier).toFixed(2);
}

/**
 * Calculates accuaracy needed to achieve given pp
 * @param {number} sr - Star rating 
 * @param {number} pp - Performance points 
 * @param {object} beatmap - Beatmap object
 * @param {Array} mods - Mods
 */
function accuracyCalc(args) {
    let multiplier = 8;
  
    if (args.mods.includes('NF')) multiplier *= 0.75;
    if (args.mods.includes('SO')) multiplier *= 0.95;
    if (args.mods.includes('EZ')) multiplier *= 0.50;
  
    let total_hits = (
      args.beatmap.count_circles +
      args.beatmap.count_sliders +
      args.beatmap.count_spinners
    )
  
    let avg = (args.beatmap.count_circles / args.beatmap.count_sliders);
  
    let acc = ((args.pp / ((Math.pow(Math.max(args.sr - 0.15, 0.05), 2.2) * (1 + 0.1 * Math.min(1, total_hits / 1500)) * multiplier)) + 4) / 5) / ((300 + (20 * ((0.50 * (avg / (avg + 1))) + 0.28))) / 320 / 100);
  
    return acc;
}

async function attributeCalc(args) {
    let beatmap_id = String(args.beatmap_id);
    let mods = args.mods || [];

    let beatmaps = getBeatmapsLinks();

    if(beatmaps.indexOf(beatmap_id) == -1) {
        console.log('Fetching beatmap file from https://osu.ppy.sh..')
        const res = await fetch('https://osu.ppy.sh/osu/' + beatmap_id, {method: "GET"});

        increaseAPIUsage();

        let beatmap = await res.text();    
    
        await saveBeatmap(beatmap, beatmap_id);
        beatmaps.push(beatmap_id);
        await setBeatmapLinks(beatmaps);
        await delay(1000);
    }

    const decoder = new BeatmapDecoder();
    const decodePath = `./beatmaps/${beatmap_id}.osu`;
    
    // Get beatmap object.
    const parsed = await decoder.decodeFromPath(decodePath);
    
    // Create a new osu!mania ruleset.
    const ruleset = new ManiaRuleset();
    
    // Create mod combination.
    mods = ruleset.createModCombination(mods.join(''));
    
    // Create difficulty calculator for IBeatmap object.
    const difficultyCalculator = ruleset.createDifficultyCalculator(parsed);
    
    // You can pass any IBeatmap object to the difficulty calculator.
    // Difficulty calculator will implicitly create a new beatmap with osu!mania ruleset.
    let difficultyAttributes = difficultyCalculator.calculateWithMods(mods);
    difficultyAttributes.map = difficultyCalculator;

    return difficultyAttributes;
}

module.exports = {
    "performanceCalc": performanceCalc,
    "performanceCalcMax": performanceCalcMax,
    "accuracyCalc": accuracyCalc,
    "attributeCalc": attributeCalc,
}