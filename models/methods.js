var _ = require('underscore');

module.exports = function(sequelize, models){
    'use strict';

    var methods = {
        players: {},
        teams: {},
        stats: {},
        games: {},
        users: {},
        generic: {}
    };

    /**
     * Update a model with a set of attributes
     * @param  {Sequelize.Model} model
     * @param  {Object} attributes
     * @return {Sequelize.Model}
     */
    methods.generic.updateModel = function(model, attributes){
        return model.updateAttributes(attributes).then(function(model){
            return model;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Destroy a model
     * @param  {Sequelize.Model} model
     * @return {Boolean}    success
     */
    methods.generic.destroyModel = function(model){
        return model.destroy().then(function(){
            return true;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Update stat values with a win for a team and its players
     * @param {Object} gameData     game model values
     */
    methods.teams.recordWin = function(gameData){
        // 1. get the team and their stats.
        // 2. get all the players and record an update.

        return models.Team.find({
            where: {
                id: gameData.winningTeamId
            },
            include: models.Stat
        }).then(function(team){
            if(!team.stat) throw new Error('Unable to find stat model for team ' + team.values.id);

            var updatedStats = addWinToStats(team.stat.values, gameData);

            return team.stat.updateAttributes(updatedStats).then(function(stat){
                return stat.values;
            });
        });
    };

    /**
     * Record a loss for a team
     * @param {Object} gameData
     */
    methods.teams.recordLoss = function(gameData){
        return models.Team.find({
            where: {
                id: gameData.losingTeamId
            },
            include: models.Stat
        }).then(function(team){
            if(!team.stat) throw new Error('Unable to find stat model for team ' + team.values.id);

            var updatedStats = addLossToStats(team.stat.values, gameData);
            return team.stat.updateAttributes(updatedStats).then(function(stat){
                return stat.values;
            });
        });
    };

    methods.stats.findByTeam = function(teamId, notValues){
        return models.Stat.find({
            where: {
                TeamId: teamId
            }
        }).then(function(stat){
            if(notValues) return stat;
            return stat.values;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Find all players
     * @return {Object}     model.values
     */
    methods.players.findAll = function(where){
        return models.Player.findAll({
            where: where || {},
            attributes: ['name', 'id'],
            include: [{
                model: models.Team
            }, {
                model: models.Stat
            }],
            order: 'id'
        }).then(function(players){
            return _.pluck(players, 'values');
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Find a single player,
     * @param  {Object} where   filter data
     * @param  {Boolean} notValues  set true to pass the model, not the values
     * @return {Object}         model.values
     */
    methods.players.findOne = function(where, notValues){
        return models.Player.find({
            where: where || {},
            include: {
                model: models.Team,
                attributes: ['name', 'id']
            },
            attributes : ['name']
        }).then(function(player){
            // if notValues is true, we want to return the model
            if(notValues) return player || null;
            return player && player.values || null;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Create a player and associate a new stat model
     * @param  {Object} data
     * @return {Object}      model.values
     */
    methods.players.create = function(data){
        console.log('createdata:');
        console.log(data);
        // todo - validation here
        return models.Player.create(data).then(function(player){
            return models.Stat.create({}).then(function(stat){
                return player.setStat(stat);
            }).then(function(){
                return player.values;
            });
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Generate the stats for a player
     * By tallying the stats for all the teams they're in
     */
    methods.players.getStats = function(playerModel){
        var teamIds = _.pluck(playerModel.values.teams, 'id');

        // now fetch those teams
        return methods.teams.findAll({
            id: teamIds
        }).then(function(teams){
            var stats = _.pluck(teams, 'stat');
            var values = _.pluck(stats, 'values');

            var summed = values.pop();

            _.each(values, function(stat){
                for(var key in stat){
                    summed[key] += stat[key];
                }
            });

            return summed;


        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Record a win for a player
     * @param {Number} playerId
     * @param {Object} gameData
     */
    methods.players.recordWin = function(playerId, gameData){
        return models.Stat.find({
            where: {
                PlayerId: playerId
            }
        }).then(function(stat){
            if(!stat) throw new Error('Unable to find Stat model for Player ' + playerId);

            // recalculate the stats, given this win
            var updatedStats = addWinToStats(stat.values, gameData);

            // save the model and return values
            return stat.updateAttributes(updatedStats).then(function(stat){
                return stat.values;
            });
        });
    };

    /**
     * Record a loss for a player
     * @param {Number} playerId
     * @param {Object} gameData
     */
    methods.players.recordLoss = function(playerId, gameData){
        return models.Stat.find({
            where: {
                PlayerId: playerId
            }
        }).then(function(stat){
            if(!stat) throw new Error('Unable to find Stat model for Player ' + playerId);

            // recalculate the stats given this loss
            var updatedStats = addLossToStats(stat.values, gameData);

            // save the model
            return stat.updateAttributes(updatedStats).then(function(stat){
                return stat.values;
            });
        });

    };

    /**
     * Find all teams
     * @param  {Object} where   filter params
     * @return {Object}         model.values
     */
    methods.teams.findAll = function(where){
        return models.Team.findAll({
            where: where || {},
            attributes: ['name', 'id'],
            include: [{
                model: models.Player,
                attributes: ['name', 'id']
            }, {
                model: models.Stat
            }]
        }).then(function(teams){
            return _.pluck(teams, 'values');
        }).catch(function(err){
            throw err;
        });
    };

    methods.teams.findOne = function(where, notValues){
        return models.Team.find({
            where: where || {},
            include: [{
                model: models.Player,
                attributes: ['name', 'id']
            }, {
                model: models.Stat
            }]
        }).then(function(team){
            if(notValues) return team || null;
            return team && team.values || null;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Fetch a team ID by searching for its players
     * @param  {Array} playerIDs
     * @return {Number}
     */
    methods.teams.getTeamIdByPlayers = function(playerIDs){
        var playersString = playerIDs.join(',');
        return sequelize.query('SELECT "TeamId" FROM "PlayersTeams" GROUP BY "TeamId" HAVING COUNT(*) = SUM(CASE WHEN "PlayerId" IN(' + playersString + ') THEN 1 ELSE 0 END) AND COUNT (*) = ' + playerIDs.length + ';').then(function(data){
            if(data && data.length) return data[0].TeamId;
            return null;
        });
    };

    /**
     * Fetch a team by searching for its players
     * @param  {Array} playerIDs
     * @return {Object}     team
     */
    methods.teams.getTeamByPlayers = function(playerIDs){
        return methods.teams.getTeamIdByPlayers(playerIDs).then(function(teamId){
            if(!teamId) return null;
            return models.Team.find({
                where: {
                    id: teamId
                },
                include: [models.Player, models.Stat]
            }).then(function(team){
                return team.values;
            });
        });
    };

    /**
     * Regenerate the stats table for a given team
     * @param  {Number} teamID
     * @return {Object}        updated stats model
     */
    methods.teams.refreshStats = function(teamID){
        teamID = Number(teamID);

        // fetch all the games that this team has played in, from earliest to latest.
        return methods.games.getTeamGames(teamID).then(function(games){

            // start with a fresh stats object
            // create an empty model and take default values,
            // removing the ones we don't want to overwrite.
            var cleanStats = models.Stat.build({}).values;
            delete cleanStats.id;

            // now let's iterate and count everything up
            _.each(games, function(game){
                if(game.winningTeamId === teamID){
                    cleanStats = addWinToStats(cleanStats, game);
                    return;
                }
                if(game.losingTeamId === teamID){
                    cleanStats = addLossToStats(cleanStats, game);
                    return;
                }
                // no result, ignore this game for now.
            });

            // now find the stats model for this team
            return methods.stats.findByTeam(teamID, true).then(function(stat){
                return stat.updateAttributes(cleanStats);
            }).then(function(stat){
                return stat.values;
            }).catch(function(err){
                throw err;
            });
        });

    };

    /**
     * Calculate a win on a stats object
     * @param {Object} _stats   pre-game stats
     * @param {Object} game     game data
     * @return {Object}         post-game stats
     */
    function addWinToStats(_stats, _game){
        var stats = _.extend({}, _stats);

        // increment games and wins
        stats.games++;
        stats.wins++;

        // update streak
        if(stats.streak >= 0){
            // on a hot streak, increment it
            stats.streak++;

            // is this the hottest streak we've had?
            if(stats.streak > stats.hottest){
                stats.hottest = stats.streak;
                stats.hottestEnd = null;
            }
        }
        else{
            // snapping a cold streak, aw yee

            // if this is the coldest streak, set the end date
            if(stats.streak === stats.coldest) stats.coldestEnd = _game.date;
            stats.streak = 1;
        }

        // if redemption was won, it means the winners gave it away.
        if(_game.redemption) stats.redemptionsGiven++;

        return stats;
    }

    /**
     * Calculate a loss on a stats object
     * @param {Object} _stats   pre-game stats
     * @param {Object} _game    game data
     * @return {Object}         post-game stats
     */
    function addLossToStats(_stats, _game){
        var stats = _.extend({}, _stats);

        // increment games and losses
        stats.games++;
        stats.losses++;

        // update streak
        if(stats.streak <= 0){
            // on a cold streak, decrement it
            stats.streak--;

            // is this the coldest streak we've had?
            if(stats.streak < stats.coldest){
                stats.coldest = stats.streak;
                stats.coldestEnd = null;
            }
        }
        else{
            // breaking a hot streak, aw shit.

            // if it was the hottest, set the end date.
            if(stats.streak === stats.hottest) stats.hottestEnd = _game.date;
            stats.streak = -1;
        }

        // did they at least win redemption?
        if(_game.redemption) stats.redemptionsHad++;

        return stats;
    }


    /**
     * Create a new team, given a name and player IDs
     * @param  {String} name
     * @param {Array} playerIDs
     * @return {Object}
     */
    methods.teams.create = function(name, playerIDs){
        if(!name || !playerIDs) throw {status:409, message: 'teams.create() requires 2 arguments'};
        // First we need to ensure a team doesn't exist with these players
        return methods.teams.getTeamIdByPlayers(playerIDs).then(function(teamId){
            if(teamId) throw {status:409, message: 'Team exists: ' + teamId};

            // now get the players
            return methods.players.findAll({
                id: playerIDs
            });
        }).then(function(players){
            if(!players || !players.length || players.length !== playerIDs.length) throw {status:400, message: 'Invalid player IDs'};

            // add the team to the DB
            return models.Team.create({
                name: name
            }).then(function(team){

                // ok it gets a bit crazy here because we need to
                // refer to team, players and stat, all via closure

                // now associate the players
                return team.setPlayers(players).then(function(players){
                    return models.Stat.create({});
                }).then(function(stat){
                    return team.setStat(stat).then(function(stat){
                        return team.values;
                    });
                });
            });
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Delete a team and its associated entities
     * @param  {Sequelize.model} model
     * @return {Boolean}
     */
    methods.teams.delete = function(model){
        var teamId = Number(model.values.id);

        // todo - this can probably be handled by the ORM
        // but for now it's done manually.
        // When a team is removed, we need to remove its
        // associated playersteams records and its stats model
        return model.destroy().then(function(){
            // todo - this can be a single query
            // intead of finding and then deleting
            return models.Stat.find({
                where: {
                    TeamId: teamId
                }
            });
        }).then(function(stat){
            if(!stat) return;
            return stat.destroy();
        }).then(function(){
            // remove the playersteams models
            return sequelize.query('DELETE FROM "PlayersTeams" WHERE "PlayersTeams"."TeamId" = ' + teamId + ';');
        }).then(function(){
            return true;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Find all games, optionally filtered
     * @param  {Object} where
     * @return {Array}
     */
    methods.games.findAll = function(where){
        return models.Game.findAll({
            where: where || {},
            include: [{
                model: models.Team,
                attributes: ['name']
            }]
        }).then(function(games){
            return _.pluck(games, 'values');
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Find a single game, optionally filtered
     * @param  {Object} where     filters
     * @param  {Boolean} notValues return the model instead of model.values
     * @return {Object}
     */
    methods.games.findOne = function(where, notValues){
        return models.Game.find({
            where: where || {},
            include: [{
                model: models.Team,
                attributes: ['name']
            }]
        }).then(function(game){
            if(!game) throw {status:404, message: 'Game not found'};
            return game;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Return an array of games matching the provided team IDs
     * Not the same as .getTeamGames - this will return only
     * games that all given teams played in
     * @param  {Array} teamIds
     * @return {Array}
     */
    methods.games.findByTeams = function(teamIds){
        if(!teamIds instanceof Array) throw new Error('teamIds must be an array');
        var teamsString = teamIds.join(',');
        return sequelize.query('SELECT "Games".* FROM "Games" LEFT OUTER JOIN "GamesTeams" AS "Teams.GamesTeam" ON "Games"."id" = "Teams.GamesTeam"."GameId" LEFT OUTER JOIN "Teams" AS "Teams" ON "Teams"."id" = "Teams.GamesTeam"."TeamId" WHERE "Teams".id IN (' + teamsString + ') GROUP BY "Games".id  HAVING COUNT(*) = 2 ORDER BY "Games".id;').then(function(games){
            return games;
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Return games that a team has played in, ordered by date.
     * Not the same as .findByTeams - this will find all the games
     * that one team has played in.
     * todo - this query is wrong, it should return both teams
     */
    methods.games.getTeamGames = function(team, notValues){
        return models.Game.findAll({
            include: {
                model: models.Team,
                attributes: ['id'],
            }, where: {
                'Teams.id': team
            }, order: 'date'
        }).then(function(games){
            if(notValues) return games;
            return _.pluck(games, 'values');
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Create a game
     * @param  {Array} teamIds  array of team IDs
     * @return {Object}         game
     */
    methods.games.create = function(teamIds){
        return methods.teams.findAll({id: teamIds}).then(function(teams){
            if(!teams || teams.length !== 2) throw new Error('Invalid team IDs');

            return models.Game.create({}).then(function(game){
                return game.setTeams(teams).then(function(teams){
                    // return the game with the teams attached.
                    return _.extend({}, game.values, {
                      teams: teams
                    });
                });
            });
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Update a game
     * @param  {Sequelize Model} gameModel
     * @param {Object} udpatedData
     */
    methods.games.update = function(gameModel, updatedData){
        // to update a game, we need winningTeamId, losingTeamId, redemption.
        var requiredFields = ['winningTeamId', 'losingTeamId', 'redemption'];
        var missingFields = _.difference(requiredFields, Object.keys(updatedData));
        if(missingFields.length) throw new Error ('games.update() missing arguments: ' + missingFields.join(', '));

        // are the teams we've been given actually valid for this game?
        var teams = _.map(gameModel.values.teams, function(team){
            return team.dataValues.id;
        });
        if(!~teams.indexOf(updatedData.winningTeamId) || !~teams.indexOf(updatedData.losingTeamId) || updatedData.winningTeamId === updatedData.losingTeamId) throw new Error('invalid winningTeamId and losingTeamId team IDs');

        // was there previously a result set for this game?
        var hadResult = gameModel.values.winningTeamId || gameModel.values.losingTeamId;

        // ok, arguments are all valid, let's update the game.
        return gameModel.updateAttributes({
            winningTeamId: updatedData.winningTeamId,
            losingTeamId: updatedData.losingTeamId,
            redemption: updatedData.redemption
        }).then(function(game){

            // if there was previously a result set for this game
            // and we're editing it, we need to refresh the stats
            // for the teams and players involved.
            if(hadResult){
                // todo - trigger a stats refresh for the players and teams involved here.
                return;
            }

            // otherwise, we're adding a result for the first time, so
            // we can just call the .addWin and .addLoss stats helpers.
            return methods.teams.recordWin(game.values).then(function(){
                return methods.teams.recordLoss(game.values).then(function(){
                    return game;
                });
            });

        }).catch(function(err){
            throw err;
        });

    };

    /**
     * Find all users, optionally filtered by where object
     * @param  {Object} where
     * @return {Array}
     */
    methods.users.findAll = function(where){
        return models.User.findAll({
            where: where,
            attributes: ['name', 'id']
        }).then(function(users){
            return _.pluck(users, 'values');
        }).catch(function(err){
            throw err;
        });
    };

    /**
     * Find a single user
     * @param  {Object} where     where clause filter
     * @param  {Boolean} notValues return model, not model.values
     * @return {Object}
     */
    methods.users.findOne = function(where, notValues){
        return models.User.find({
            where: where,
            attributes: ['name', 'id'],
            include: {
                model: models.Player,
                attributes: ['name', 'id']
            }
        }).then(function(user){
            if(!user) throw {status:404};
            return user;
        }).catch(function(err){
            throw err;
        });
    };


    return methods;

};
