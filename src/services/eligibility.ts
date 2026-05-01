import type { EligibilityResult } from '../types/index.ts';

/**
 * Checks voter eligibility based on age and citizenship.
 * Fully rule-based — no AI call needed for deterministic logic.
 * @param {string} state - The user's state.
 * @param {number} age - The user's age.
 * @param {string} citizenship - The user's citizenship.
 * @returns {EligibilityResult} The evaluation result.
 */
export const checkEligibility = (state: string, age: number, citizenship: string): EligibilityResult => {
  const requirements: string[] = [];
  const reasons: string[] = [];

  if (age < 18) reasons.push(`You must be at least 18 years old (you are ${age}). [Section 14, RPA 1950]`);
  if (citizenship !== 'Indian') reasons.push('You must be a citizen of India to vote. [Article 326, Constitution]');

  if (reasons.length === 0) {
    return {
      eligible: true,
      reason: `You meet all eligibility criteria under Article 326 of the Constitution and Section 14 of RPA 1950.`,
      requirements: ['Valid Voter ID (EPIC)', 'Name enrolled in Electoral Roll for ' + state, 'Must vote at your designated polling booth'],
      deadline: 'Register before the electoral roll cutoff date for the next election',
      voterIdLink: 'https://voters.eci.gov.in',
    };
  }

  return {
    eligible: false,
    reason: reasons.join(' '),
    requirements: age >= 18 ? ['Indian citizenship required'] : ['Must be 18+ years old', 'Indian citizenship required'],
    deadline: age < 18 ? `Eligible in ${18 - age} year(s)` : 'N/A',
    voterIdLink: 'https://voters.eci.gov.in',
  };
};
