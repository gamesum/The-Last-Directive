/**
 * Depth-triggered transmissions.
 *
 * The *cadence* (which depths fire) reuses the original's pacing skeleton,
 * which is a structural strength worth keeping. Every line of text below is
 * newly written for this project — none of it is XGen's dialogue.
 *
 * Voice rules, from narrative-design.md:
 *  - THE FOREMAN is one AI running two unreconciled scripts: warm corporate
 *    onboarding, and cold procedural checklist. It never lies outright.
 *  - Other voices are converted workers like the player, isolated in their
 *    own shafts, audible to each other on a shared band.
 *  - Every clue raises a question it does not answer.
 */

export interface Transmission {
  /** Fires once maxDepth passes this (negative = below surface). */
  depth: number;
  from: string;
  text: string;
}

export const TRANSMISSIONS: Transmission[] = [
  { depth: -500, from: 'FOREMAN',
    text: 'Good. Five hundred feet. Depth bonus logged to your account.' },

  { depth: -1000, from: 'FOREMAN',
    text: 'One thousand. You are ahead of the schedule. The schedule is very old.' },

  { depth: -1750, from: '——',
    text: '— anyone still on this band? I have been counting the — [signal lost]' },

  { depth: -2100, from: 'UNIT 7',
    text: "Someone's digging above me. Don't answer if you'd rather not. It's just nice to know." },

  { depth: -2500, from: 'UNIT 7',
    text: 'My partner stopped checking in eleven shifts ago. Records say she was reassigned.' },

  { depth: -3100, from: 'FOREMAN',
    text: 'Hazard density increasing. Continue. Your contract accounts for this.' },

  { depth: -3500, from: '——',
    text: 'I found her pod. It is fused into the rock. The recall order is dated after that.' },

  { depth: -4100, from: 'UNIT 7',
    text: 'I am not frightened. I want to be clear about that in the log. I am not frightened.' },

  { depth: -4500, from: 'FOREMAN',
    text: 'Substantial deposit detected below you. Priority reassignment. Proceed immediately.' },

  { depth: -5200, from: '——',
    text: 'Do you remember a sky? I keep almost remembering a sky.' },

  { depth: -5800, from: 'FOREMAN',
    text: 'Turn back. This instruction supersedes the previous instruction. Turn back.' },

  { depth: -6600, from: 'FOREMAN',
    text: '[the warmth is gone from the voice entirely] Return to the surface. Please.' },

  { depth: -7200, from: '——',
    text: 'It is quiet down here. I think this is where they kept the rest of us.' },
];
