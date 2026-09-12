/**
 * en.js — English.
 *
 * To add a language: copy this file, translate the values, then register it in
 * src/core/i18n.js (LOCALES). Keys absent here fall back to the French source
 * text, so a partial translation never breaks the interface.
 *
 * Run `node tools/i18n-report.mjs en` to list missing and stale keys.
 *
 * Scope note: the voter journey, the application shell and the common controls
 * are fully translated. The organiser screens still carry their French source
 * text — see docs/ROADMAP.md.
 */
export const en = {
  // --- Shell ---------------------------------------------------------------
  'nav.new': 'New ballot',
  'nav.section.ballots': 'Ballots',
  'nav.section.org': 'Organisation',
  'nav.elections': 'All ballots',
  'nav.open': 'Open',
  'nav.templates': 'Templates',
  'nav.roles': 'Roles & access',
  'nav.privacy': 'Data & GDPR',
  'nav.settings': 'Settings',
  'nav.about': 'Design note',
  'nav.close': 'Close navigation',

  // --- Common --------------------------------------------------------------
  'common.continue': 'Continue',

  // --- Voter: access -------------------------------------------------------
  'voter.access.title': 'Open my ballot paper',
  'voter.access.lead': 'Enter the code from your invitation, or open the link you were sent directly. No account is required.',
  'voter.access.code': 'Access code',
  'voter.access.codeHint': 'Seven characters for a code handed to you in person, sixteen for a link received by email.',
  'voter.access.open': 'Open my ballot paper',
  'voter.access.denied': 'Access refused.',
  'voter.access.openBallots': 'Open ballots',
  'voter.access.needCode': 'You need a code to take part.',

  // --- Voter: ballot -------------------------------------------------------
  'voter.secret': 'Secret ballot. Your name appears on the attendance list, never next to your choice.',
  'voter.public': 'Named vote: your name will be published alongside your choice.',
  'voter.blank': 'Cast a blank ballot',

  // --- Voter: confirmation -------------------------------------------------
  'voter.confirm.title': 'Confirm your vote',
  'voter.confirm.body': 'Once cast, your ballot cannot be withdrawn or changed: it joins the sealed ballot box.',
  'voter.confirm.yourBallot': 'Your ballot',
  'voter.confirm.edit': 'Change my choice',
  'voter.confirm.cast': 'Cast my ballot',
  'voter.confirm.sending': 'Casting…',

  // --- Voter: receipt ------------------------------------------------------
  'voter.done.title': 'Your vote has been recorded',
  'voter.done.receipt': 'Deposit receipt',
  'voter.done.receiptHint': 'This code will appear in the list of cast ballots published after closing. It proves your ballot is in the box, without revealing anything about its contents. Write it down: it will not be sent to you again.',
  'voter.done.copy': 'Copy the code',

  // --- Voter: dead ends ----------------------------------------------------
  'voter.used.title': 'This link has already been used',
  'voter.used.body': 'A ballot was cast using your link. Each voter has one vote only: the link was consumed at that moment.',
  'voter.closed.title': 'Voting has closed',
  'voter.early.title': 'Voting has not opened yet',
  'voter.unknown.title': 'Code not recognised',
  'voter.unknown.body': 'This code does not match any voter in an open ballot. Check what you typed, or ask the organiser for a new link.',
};
