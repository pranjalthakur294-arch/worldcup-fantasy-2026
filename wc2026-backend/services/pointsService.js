const db = require('../config/db');

const calculateTeamPoints = async (team) => {

    const playerIds =
    typeof team.player_ids === 'string'
        ? JSON.parse(team.player_ids)
        : team.player_ids;

    const placeholders =
        playerIds.map(() => '?').join(',');

    const [players] = await db.query(
        `
        SELECT
            id,
            total_pts,
            md_pts
        FROM players
        WHERE id IN (${placeholders})
        `,
        playerIds
    );

    let totalPoints = 0;
    let gwPoints = 0;

    players.forEach(player => {

        let playerTotal =
            player.total_pts || 0;

        let playerGW =
            player.md_pts || 0;

        if (player.id === team.captain_id) {
            playerTotal *= 2;
            playerGW *= 2;
        }

        totalPoints += playerTotal;
        gwPoints += playerGW;
    });

    return {
        totalPoints,
        gwPoints
    };
};

module.exports = {
    calculateTeamPoints
};