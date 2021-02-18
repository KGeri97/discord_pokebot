const fs = require('fs');
const config = require('./files/config.json');
const Discord = require('discord.js');
const pokedata = require('./files/pokedata.json');
const msg = require('./files/messages.json');
const { Client, MessageEmbed, MessageReaction, MessageAttachment, GuildMember, GuildMemberRoleManager, Guild } = require('discord.js');

// commands ///////////////////////////////////////////////////////////////////////
function catchPokemon(message, inventory, pokemonName, pokemon, candy){
    if (pokemon == null && candy == false) { //There is nothing to catch
    message.reply(msg.replies.nothingToCatch);
    } else if (!pokemonName) { //Pokemon wasnt specified
        message.reply(msg.replies.catchNoArgs);
        return;
    } else if (candy != false && pokemon == null && pokemonName != "candy"){
        let member = message.guild.members.cache.get(message.member.id);
        mute(message, member);
    } else if ((pokemon != null) && pokemonName != "candy" && pokemonName.toLowerCase() != pokemon.displayName) { //Pokemon or candy was misspelled
        let member = message.guild.members.cache.get(message.member.id);
        mute(message, member);
    } else if (candy == false && pokemonName == "candy"){
        message.reply(msg.replies.noCandyToCatch);
    } else if (pokemon != null && pokemonName.toLowerCase() == pokemon.displayName) { //Pokémon caught
        pokemon.displayName = pokemon.name;
        addPokemon(message, inventory, message.member.user.id, level(pokemon));
        message.reply(msg.replies.pokemonCaught + "_" + pokemon.name + "_");
        return 0;
    } else if (pokemonName.toLowerCase() == "candy" && candy){// candy caught
        inventory = addCandy(inventory, message.member.user.id, 1);
        message.reply(msg.replies.candyCaught);
        return 1;
    } else if (pokemonName.toLowerCase() == "lajos") { //If the dumbfuck wants to catch Lajos
        message.reply(msg.replies.catchTheBot);
    }
    return;
}

function clear(message, num){
    if(!num){
        message.channel.bulkDelete(1);
        return message.reply(msg.replies.clearNoArgs);
    } else {
        message.channel.bulkDelete(num);
    }
}

function getGift(message, inventory, pokemonName, fate){
    let userId = message.member.user.id;
    
    if (!pokemonName){ 
        message.reply(msg.replies.noArg1getGift);
    } else if (!fate){
        message.reply(msg.replies.noArg2getGift);
    } else if (!userExist(inventory, userId)){
        message.reply(msg.replies.noGifts);
        return;
    } else if (!inventory[userId].gifts.hasOwnProperty(pokemonName)){
        message.reply(msg.replies.pokemonNameNotFound + "_" + pokemonName + "_");
        return;
    } else if (fate != "accept" && fate != "deny"){
        message.reply(msg.replies.invalidArgs2getGift);
    } else if (fate == "accept") {
        if (isAboveInventoryLimit(inventory, userId)){
            message.reply(msg.replies.fullInventoryGetGift);
        } else {
            let pokemon = JSON.parse(JSON.stringify(inventory[userId].gifts[pokemonName]));
            inventory[userId].pokemons[pokemon.displayName] = pokemon;
            delete inventory[userId].gifts[pokemonName];
            message.reply(msg.replies.giftAccepted);
        }
    } else if (fate == "deny") {
        delete inventory[userId].gifts[pokemonName];
        message.reply(msg.replies.giftDenied);
    }
    writeFile(inventory, config.inventory);
    return;
}

function gift(message, inventory, recipient, pokemonName, amount){
    let userId = message.member.user.id;
    amount = amount || 1;

    if (!recipient){
        message.reply(msg.replies.giftNoRecipient);
        return;
    } else if (!pokemonName){
        message.reply(msg.replies.giftNoPokemon);
        return;
    } else if (recipient[1] != "@"){
        message.reply(msg.replies.giftInvalidUser);
        return;
    } else if (!inventory[userId].pokemons.hasOwnProperty(pokemonName) && pokemonName != "candy"){
        message.reply(msg.replies.pokemonNameNotFound + "_" + pokemonName + "_");
        return;
    } else if (pokemonName == "candy" && (isNaN(parseInt(amount)) || parseInt(amount) < 1)){
        message.reply(msg.replies.giftNotInteger);
        return;
    } else if (pokemonName == "candy" && parseInt(amount) > inventory[userId].candy){
        message.reply(msg.replies.giftNoCandy);
        return;
    } else if (!userExist(inventory, recipient)){
        recipient = recipient.substring(0, recipient.length - 1).substring(3);
        addNewUser(inventory, recipient);
    }

    if (pokemonName == "candy"){
        inventory = addCandy(inventory, userId, -amount);
        inventory = addCandy(inventory, recipient, amount);
        message.reply(msg.replies.giftSent);
    } else {
        let pokemon = JSON.parse(JSON.stringify(inventory[userId].pokemons[pokemonName]));
        pokemon.displayName = checkDisplayName(inventory, recipient, pokemonName);
        delete inventory[userId].pokemons[pokemonName];
        inventory[recipient].gifts[pokemon.displayName] = pokemon;
        message.reply(msg.replies.giftSent);
    }
    writeFile(inventory, config.inventory);
}

function myInventory(message, inventory, place, type){
    let userId = message.member.user.id;

    if (place == undefined){
        place = place || "pokemons";
    } else if (type == undefined && place != undefined){
        if (place == "big" || place == "small" || place == "text"){
            type = place;
            place = "pokemons"
        } else if (place == "candy"){
            message.reply("You have " + inventory[userId].candy + " candy.");
            return;
        } else if (place != "pokemons" && place != "gifts"){
            message.reply(msg.replies.myInvMisspell);
            return;
        }
    }
        
    if (!userExist(inventory, userId)){
        message.reply(msg.replies.noPokemonCaught);
        return;
    } else if (place == "pokemons" && Object.keys(inventory[userId].pokemons).length == 0){
        message.reply(msg.replies.noPokemonCaught);
        return;
    } else if (place == "gifts" && Object.keys(inventory[userId].gifts).length == 0){
        message.reply(msg.replies.noPokemonInGifts);
        return;
    } else {
        var list = inventory[userId][place];
        var listCount = Object.keys(list).length
        
        if (!type && listCount <= 5){
            type = "big";
        } else if (!type && listCount <= 10){
            type = "small";
        } else if (!type && listCount > 10) {
            type = "text";
        }

        if (place == "pokemons"){
            message.reply("your Pokémons:");
        } else if (place == "gifts") {
            message.reply("your gifts:");
        }

        if (type == "big"){
            for (var i in list){
                message.channel.send({ embed: createPokemonEmbed(list[i], "big") });
            }
        } else if (type == "small"){
            for (var i in list){
                message.channel.send({ embed: createPokemonEmbed(list[i], "small") });
            }
        } else if (type == "text"){
            for (var i in list){
                message.channel.send(list[i].displayName);
            }
        }
    }
}

function myPokemon(message, inventory, pokemonName){
    let userId = message.member.user.id;
    
    if (!userExist(inventory, userId)){
        message.reply(msg.replies.noPokemonCaught);
    } else if (!inventory[userId].pokemons.hasOwnProperty(pokemonName)){
        message.reply(msg.replies.pokemonNameNotFound + "_" + pokemonName + "_");
    } else{
        message.reply({ embed: createPokemonEmbed(inventory[userId].pokemons[pokemonName],"big") });
    }
}

function ping(message){
    message.channel.send(msg.replies.ping);
}

function pokedex(message, pokemonName){
    pokemonName = pokemonName.toLowerCase() || undefined;

    if(!pokemonName) {
        message.reply(msg.replies.pokedexNoArgs);
        return;
    } else if (pokedata.gen1.hasOwnProperty(pokemonName)){
        message.reply({ embed: createPokemonEmbed(pokedata.gen1[pokemonName],"big") });
        return;
    } else {
        message.reply(msg.replies.pokemonNameNotFound + "_" + pokemonName + "_.");
        return;
    }
}

function removePokemon(message, inventory, pokemonName){
    let userId = message.member.user.id;
    
    if (!userExist(inventory, userId)){
        message.reply(msg.replies.noPokemonCaught);
        return;
    } else if (!inventory[userId].pokemons.hasOwnProperty(pokemonName)){
        message.reply(msg.replies.pokemonNameNotFound + "_" + pokemonName + "_.");
        return;
    } else {
        delete inventory[userId].pokemons[pokemonName];
        writeFile(inventory, config.inventory);
        message.reply(msg.replies.pokemonRemoved1 + "_" + pokemonName + "_" + msg.replies.pokemonRemoved2);
    }
}

function rename(message, inventory, oldName, newName){
    let userId = message.member.user.id;
    if (!oldName){
        message.reply(msg.replies.renameNoArgs1);
        return;
    } else if (!newName){
        message.reply(msg.replies.renameNoArgs2);
        return;
    } else if (!userExist(inventory, userId)){
        message.reply(msg.noPokemonCaught);
        return;
    }

    if (!userExist(inventory, userId)){
        message.reply(msg.replies.noPokemonCaught);
    } else if (!inventory[userId].pokemons.hasOwnProperty(oldName)){
        message.reply(msg.replies.pokemonNameNotFound + "_" + oldName + "_.");
    } else if (inventory[userId].pokemons.hasOwnProperty(newName)){
        message.reply(msg.replies.alreadyHasPokemon + "_" + newName + "_.");
    } else {
        var pokemon = JSON.parse(JSON.stringify(inventory[userId].pokemons[oldName]));
        pokemon.displayName = newName;
        delete inventory[userId].pokemons[oldName];
        inventory[userId].pokemons[newName] = pokemon;
        message.reply({ embed: createPokemonEmbed(pokemon, "big") });

        writeFile(inventory, config.inventory);
    }
    return;
}

function resetInventory(message, inventory){
    inventory = {};
    writeFile(inventory, config.inventory);
    message.reply(msg.replies.inventoryReset)
    return inventory;
}

function spawn(message, pokemonName, level){
    let spawnNumber = Math.floor(Math.random() * pokedata.gen1.nameArray.length);
    pokemonName = pokemonName || JSON.parse(JSON.stringify(pokedata.gen1.nameArray[spawnNumber]));
    level = level || Math.floor(Math.random() * config.spawnLevelCap + 1);

    if (!pokedata.gen1.hasOwnProperty(pokemonName)){
        message.reply(msg.replies.noPokemonFound);
        return;
    } else if( 0 >= level || level > 100){
        message.reply(msg.replies.notValidLevel);
        return;
    }

    var pokemon = JSON.parse(JSON.stringify(pokedata.gen1[pokemonName]));
    pokemon.level = level;
    pokemon.displayName = pokemonName;
    let embed = createPokemonEmbed(pokemon, "spawn");
    message.channel.send({embed: embed});
    return pokemon;
}

function spawnCandy(message){
    let embed = {
        thumbnail:{
            url: "attachment://candy.png"
        },
        files: [{
            attachment:'assets/candy.png',
            name:'candy.png'
        }]
    };
    message.channel.send({embed: embed});
    return true;
}

function trainPokemon(message, inventory, pokemonName, candy) {
    let userId = message.member.user.id;
    let now = new Date();

    if (!userExist(inventory, userId)){
        message.reply(msg.replies.noPokemonCaught);
        return inventory;
    } else if (!inventory[userId].pokemons.hasOwnProperty(pokemonName)){
        message.reply(msg.replies.pokemonNameNotFound  + "_" + pokemonName + "_.");
        return inventory;
    } else if (inventory[userId].pokemons[pokemonName].level == 100){
        message.reply(msg.replies.pokemonMaxLevel);
        return inventory;
    } else if (!inventory[userId].pokemons[pokemonName].hasOwnProperty("lastTrained")){
        inventory[userId].pokemons[pokemonName].lastTrained = 0;
    } 

    if (compareDates(now, inventory[userId].pokemons[pokemonName].lastTrained) == 0 && candy == undefined){
        inventory[userId].pokemons[pokemonName].level++;
        level(inventory[userId].pokemons[pokemonName]);
        inventory[userId].pokemons[pokemonName].lastTrained = now;
        writeFile(inventory, config.inventory);

        message.reply(msg.replies.pokemonTrained);
        message.channel.send({embed: createPokemonEmbed(inventory[userId].pokemons[pokemonName],"big")});
    } else if (candy == "candy" && inventory[userId].candy > 0){
        inventory = addCandy(inventory, userId, -1);
        inventory[userId].pokemons[pokemonName].level++;
        level(inventory[userId].pokemons[pokemonName]);
        inventory[userId].pokemons[pokemonName].lastTrained = now;
        writeFile(inventory, config.inventory);

        message.reply(msg.replies.pokemonTrained);
        message.channel.send({embed: createPokemonEmbed(inventory[userId].pokemons[pokemonName],"big")});
    } else if (candy == "candy" && inventory[userId].candy <= 0){
        message.reply(msg.replies.noCandy);
    } else {
        message.reply(msg.replies.pokemonTrainedToday);
    }
    return inventory;
}
//////////////////////////////////////////////////////////////////////////////////

function addNewUser(inventory ,userId){
    inventory[userId] = {
        "candy": 0,
        "pokemons": {},
        "gifts": {}
    }
    writeFile(inventory, config.inventory)
    return inventory;
}

function addCandy(inventory, userId, amount){
    if (!userExist(inventory, userId)){
        inventory = addNewUser(inventory, userId);
    }

    inventory[userId].candy += amount;

    writeFile(inventory, config.inventory);
    return inventory;
}

function addPokemon(message, inventory, userId, pokemon){
    if (!userExist(inventory, userId)){
        inventory = addNewUser(inventory, userId);
        inventory[userId].pokemons[pokemon.displayName] = pokemon;
        
        writeFile(inventory, config.inventory);
        return inventory;
    }

    if (isAboveInventoryLimit(inventory, userId)){
        if (inventory[userId].gifts.length != 0){
            pokemon.displayName = checkDisplayName(inventory, userId, pokemon.displayName);
        }
        inventory[userId].gifts[pokemon.displayName] = pokemon;
        message.reply(msg.replies.fullInventory + " _" + pokemon.displayName + "_" + msg.replies.pokemonPutInGiftBox);
    } else {
        if (inventory[userId].pokemons.length != 0){
            pokemon.displayName = checkDisplayName(inventory, userId, pokemon.displayName);
        }
        inventory[userId].pokemons[pokemon.displayName] = pokemon;

        writeFile(inventory, config.inventory);
        return inventory;
    }
}

function checkDisplayName(inventory, userId, pokemonName){
    var i = 2;
    var list1 = inventory[userId].pokemons;
    var list2 = inventory[userId].gifts;

    while (list1.hasOwnProperty(pokemonName) || list2.hasOwnProperty(pokemonName)){
        if (!list1.hasOwnProperty(pokemonName + i) && !list2.hasOwnProperty(pokemonName + i)){
            pokemonName += "(" + i + ")";
        } else {
            i++;
        }
    }
    return pokemonName;
}

function compareDates(date1, date2){
    date1 = new Date(date1);
    date2 = new Date(date2);
    if (date1.getFullYear() > date2.getFullYear()){
        return 0;
    } else if (date1.getFullYear() < date2.getFullYear()){
        return 1;
    } else {
        if (date1.getMonth() > date2.getMonth()){
            return 0;
        } else if (date1.getMonth() < date2.getMonth()){
            return 1;
        } else {
            if (date1.getDate() > date2.getDate()){
                return 0;
            } else if (date1.getDate() < date2.getDate()){
                return 1;
            } else {
                return 2;
            }
        }
    }
}

function createPokemonEmbed(pokemon, type){
    if (type == "spawn"){
        var embed = {
            color: pokemon.color,
            thumbnail: {
                url: pokemon.picture,
            },
            footer: {
                text: "LVL: " + pokemon.level
            }
        }
    } else {
        var embed = {
            color: pokemon.color,
            title: pokemon.displayName || pokemon.name,
            thumbnail: {
                url: pokemon.picture,
            },
            fields: [
                {
                    name: 'Pokemon',
                    value: pokemon.name,
                    inline: false,
                },
                {
                    name: 'Type',
                    value: pokemon.type,
                    inline: true,
                },
                {
                    name: 'Level',
                    value: pokemon.level || 1,
                    inline: true,
                },
            ],
        };

        if (type == "big"){
            embed.fields.push({
                name: '\u200b',
                value: '\u200b',
                inline: true,
            },
            {
                name: 'Stat',
                value: pokemon.stat,
                inline: true,
            },
            {
                name: 'Value',
                value: pokemon.base,
                inline: true,
            });
        }
    }
    return embed;
}

function fileExist(path){
    try {
        if (fs.existsSync(path)) {
            return true;
        } else {
            return false;
        }
    } catch(err) {
    }
}

function isAboveInventoryLimit(inventory, userId){
    var pokeNum = Object.keys(inventory[userId].pokemons).length;

    if (pokeNum >= config.inventoryCapacity){
        return true;
    } else {
        return false;
    }
}

function level(pokemon){
    stats = JSON.parse(JSON.stringify(pokedata["gen" + pokemon.generation][pokemon.name.toLowerCase()].base));
    for (var i in stats){
        stats[i] += Math.round(((stats[i]/100)*pokemon.level));
    }
    pokemon.base = stats;
    return pokemon;
}

function mute(message, member){
    if (member) {
        member.roles.add(config.muteRole)
        message.reply(msg.replies.wrongPokemon + config.muteTime + msg.replies.timeUnit)
        .catch(err => {
            message.channel.send(msg>cannotMute);
            console.error(err);
        });
        setTimeout(function () {
            member.roles.remove(config.muteRole)
        }, config.muteTime * 1000);
    }
}

function userExist(inventory, userId){
    if (inventory.hasOwnProperty(userId)){
        return true;
    } else {
        return false;
    }
}

function writeFile(data, path){
    fs.writeFile(path, JSON.stringify(data, null, 4), err=>{
        if (err) throw err;
    });
    return;
}

module.exports = {addNewUser, addCandy, catchPokemon, addPokemon, checkDisplayName, clear, compareDates, createPokemonEmbed, fileExist, getGift, gift, isAboveInventoryLimit, level, myInventory, myPokemon, mute, ping, pokedex, removePokemon, rename, resetInventory, spawn, spawnCandy, trainPokemon, userExist, writeFile};