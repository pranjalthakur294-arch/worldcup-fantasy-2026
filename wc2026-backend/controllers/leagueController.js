// controllers/leagueController.js
const leagueModel = require('../models/leagueModel');
const { generateInviteCode } = require('../utils/inviteCode');
const getLeaderboard = async (req, res, next) => {

  try {

    const leagueId = req.params.id;

    const leaderboard =
      await leagueModel.getLeaderboard(leagueId);

    return res.json({
      success: true,
      data: leaderboard
    });

  } catch (err) {
    next(err);
  }
};

// ─── POST /api/leagues/create ─────────────────────────────────────────────────
/**
 * Creates a new league and makes the authenticated user the commissioner.
 *
 * Body  : { name, max_teams? }
 * Auth  : Bearer JWT  →  req.user.id  (set by authMiddleware)
 */
const createLeague = async (req, res) => {
  try {
    const { name, max_teams = 10 } = req.body;
    const commissionerId = req.user.id;

    // ── Validate input ────────────────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'League name is required.',
      });
    }

    if (max_teams < 2 || max_teams > 20) {
      return res.status(400).json({
        success: false,
        message: 'max_teams must be between 2 and 20.',
      });
    }

    // ── Generate a guaranteed-unique 6-char invite code ───────────────────────
    let inviteCode;
    let attempts = 0;

    do {
      inviteCode = generateInviteCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('Could not generate a unique invite code. Try again.');
      }
    } while (await leagueModel.inviteCodeExists(inviteCode));

    // ── Persist ───────────────────────────────────────────────────────────────
    const leagueId = await leagueModel.createLeague(
      name.trim(),
      inviteCode,
      commissionerId,
      max_teams
    );

    const league = await leagueModel.findLeagueById(leagueId);

    return res.status(201).json({
      success: true,
      message: 'League created successfully.',
      data: {
        league: {
          ...league,
          is_commissioner: true,
          member_count: 1,
        },
      },
    });
  } catch (error) {
    console.error('[createLeague]', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating league.',
    });
  }
};

// ─── POST /api/leagues/join ───────────────────────────────────────────────────
/**
 * Joins an existing league using its 6-character invite code.
 *
 * Body  : { invite_code }
 * Auth  : Bearer JWT  →  req.user.id
 */
const joinLeague = async (req, res) => {
  try {
    const { invite_code } = req.body;
    const userId = req.user.id;

    // ── Validate input ────────────────────────────────────────────────────────
    if (!invite_code || typeof invite_code !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'invite_code is required.',
      });
    }

    const normalizedCode = invite_code.trim().toUpperCase();

    if (normalizedCode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'invite_code must be exactly 6 characters.',
      });
    }

    // ── Look up the league ────────────────────────────────────────────────────
    const league = await leagueModel.findLeagueByInviteCode(normalizedCode);

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found. Check the invite code and try again.',
      });
    }

    // ── Prevent duplicate membership ──────────────────────────────────────────
    const existingMembership = await leagueModel.findMembership(league.id, userId);

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: 'You are already a member of this league.',
      });
    }

    // ── Check capacity ────────────────────────────────────────────────────────
    const memberCount = await leagueModel.getMemberCount(league.id);

    if (memberCount >= league.max_teams) {
      return res.status(400).json({
        success: false,
        message: `This league is full (${league.max_teams}/${league.max_teams} teams).`,
      });
    }

    // ── Add member ────────────────────────────────────────────────────────────
    await leagueModel.addMember(league.id, userId);

    return res.status(200).json({
      success: true,
      message: `Successfully joined "${league.name}".`,
      data: {
        league: {
          id: league.id,
          name: league.name,
          invite_code: league.invite_code,
          max_teams: league.max_teams,
          member_count: memberCount + 1,
          is_commissioner: false,
        },
      },
    });
  } catch (error) {
    console.error('[joinLeague]', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while joining league.',
    });
  }
};

// ─── GET /api/leagues/my ──────────────────────────────────────────────────────
/**
 * Returns all leagues the authenticated user is a member of.
 *
 * Auth  : Bearer JWT  →  req.user.id
 */
const getMyLeagues = async (req, res) => {
  try {
    const userId = req.user.id;

    const leagues = await leagueModel.getLeaguesByUser(userId);

    return res.status(200).json({
      success: true,
      message: 'Leagues retrieved successfully.',
      data: {
        leagues,
        total: leagues.length,
      },
    });
  } catch (error) {
    console.error('[getMyLeagues]', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving leagues.',
    });
  }
};

module.exports = {
  createLeague,
  joinLeague,
  getMyLeagues,
  getLeaderboard
};