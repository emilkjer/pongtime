/**
 * leagues
 */

module.exports = function(sequelize, datatypes){
    'use strict';

    var League = sequelize.define('League', {
        name: {
            type: datatypes.STRING,
            allowNull: false
        },
        'public': {
            type: datatypes.BOOLEAN,
            allowNull: false,
            default: true
        }
    });

    return League;
};
