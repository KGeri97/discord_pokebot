const fs = require('fs');
const Discord = require('discord.js');
const config = require('./files/config.json');
const func = require('./functions.js');
const msg = require('./files/messages.json');
const pokedata = require('./files/pokedata.json');
const { Client, MessageEmbed, MessageReaction, MessageAttachment, GuildMember, GuildMemberRoleManager, Guild } = require('discord.js');

const bot = new Discord.Client();
const prefix = config.prefix;

var inventory = {};
var appearedPokemon = null;
var candy = false;
var spawning = false;

bot.commands = new Discord.Collection();

bot.on('ready', () => {
    console.log(msg.replies.botStatusOn);
    bot.user.setActivity(config.activity);

    try {
        if (!fs.existsSync(config.inventory)) {
            let temp = {}
            func.writeFile(temp, config.inventory);
            console.log(msg.replies.noDatabase);
        } else {
            fs.readFile(config.inventory, 'utf8', function(err, data) {
                if (err) {
                    return console.log(err);
                }
                inventory = JSON.parse(data);
            });
        }
      } catch(err) {
        console.error(err)
      }
});

bot.on('message', message => {

    let args = message.content.substring(prefix.length).split(" ");

    if (message.channel.id == config.channel && message.member.user.id != config.botId){
        if (config.commands.hasOwnProperty(args[0])){// is it an existing command
            if ((message.member.roles.cache.has(config[config.commands[args[0]].role]) || config.commands[args[0]].role == "" ) ){//if he has a sufficient role to use the command
                switch (args[0]) {
                    case "catch":
                        var result = func.catchPokemon(message, inventory, args[1], appearedPokemon, candy);
                        if (result == 0){
                            appearedPokemon = null;
                        } else if (result == 1){
                            candy = false;
                        }
                    break;

                    case "clear":
                        func.clear(message, args[1]);
                    break;
                    
                    case "get_gift":
                        func.getGift(message, inventory, args[1], args[2]);
                    break;

                    case "gift":
                        func.gift(message, inventory, args[1], args[2], args[3]);
                    break;
                    
                    case "help":
                        var str = "\n";
                        if (!args[1]){
                            for (var i in config.commands){
                                str += i + "\n";
                            }
                            message.reply(str);
                        } else if (config.commands.hasOwnProperty(args[1])){
                            message.reply(config.commands[args[1]].help);
                        } else {
                            message.reply(msg.replies.noCommand);
                        }
                    break;

                    case "my_inventory": 
                        func.myInventory(message, inventory, args[1], args[2]);
                    break;

                    case "my_pokemon": 
                        func.myPokemon(message, inventory, args[1]);
                    break;

                    case "ping":
                        func.ping(message);
                    break;

                    case "pokedex":
                        func.pokedex(message, args[1]);
                    break;

                    case "remove":
                        func.removePokemon(message, inventory, args[1]);
                    break;
                    
                    case "rename":
                        func.rename(message, inventory, args[1], args[2]);
                    break;

                    case "reset_inventory":
                        inventory = func.resetInventory(message, inventory);
                    break;

                    case "spawn":
                        if (spawning){
                            message.reply(msg.replies.alreadySpawning);
                        } else if (!args[1]){
                            spawning = true;
                            let timerPoke = (Math.floor(Math.random() * (config.pokeSpawnTimeMax - config.pokeSpawnTimeMin) + config.pokeSpawnTimeMin) * 1000);
                            setTimeout(function randomInterval(){
                                let timerPoke =  (Math.floor(Math.random() * (config.pokeSpawnTimeMax - config.pokeSpawnTimeMin) + config.pokeSpawnTimeMin) * 1000);
                                appearedPokemon = func.spawn(message);
                                setTimeout(randomInterval, timerPoke);
                            }, timerPoke);

                            let timerCandy = (Math.floor(Math.random() * (config.candySpawnTimeMax - config.candySpawnTimeMin) + config.candySpawnTimeMin) * 1000);
                            setTimeout(function randomInterval(){
                                let timerCandy =  (Math.floor(Math.random() * (config.candySpawnTimeMax - config.candySpawnTimeMin) + config.candySpawnTimeMin) * 1000);
                                candy = func.spawnCandy(message);
                                setTimeout(randomInterval, timerCandy);
                            }, timerCandy);
                            message.reply(msg.replies.spawnStarted);
                        } else if (args[1] == "candy"){
                            candy = func.spawnCandy(message);
                        } else if (args[1] && !args[2]){
                            appearedPokemon = func.spawn(message, args[1]);
                        } else if (args[1] && args[2]){
                            appearedPokemon = func.spawn(message, args[1], args[2]);
                        }
                    break;

                    case "train":
                        inventory = func.trainPokemon(message, inventory, args[1], args[2]);
                    break;
                }
            } else {
                message.reply(msg.replies.noPermission);
            }
        }
    }

    switch (args[0]) {

        case "info" : //debug
            console.log(appearedPokemon);
        break;
        

        case "logFile" : //debug
            func.logFile(config.inventory);
        break;

        case "test":// debug
        break;
    }
});

bot.login(config.token);