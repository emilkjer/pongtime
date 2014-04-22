(function(){
    'use strict';

    angular.module('pong').factory('players', ['$http', function($http){

        var PlayersService = function(){};

        PlayersService.prototype.getPlayers = function(){
            return $http.get('/api/v1/players');
        };

        return new PlayersService();

    }]);

})();