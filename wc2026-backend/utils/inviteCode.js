// utils/inviteCode.js

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, no I/1 (ambiguous chars removed)
const CODE_LENGTH = 6;

/**
 * Generates a cryptographically-safe random 6-character invite code.
 * Uses only uppercase letters + digits with ambiguous characters removed
 * so codes are easy to read and share.
 *
 * Example output: "T4MK9R"
 */
const generateInviteCode = () => {
  const { randomInt } = require('crypto');
  let code = '';

  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[randomInt(0, CHARSET.length)];
  }

  return code;
};

module.exports = { generateInviteCode };
