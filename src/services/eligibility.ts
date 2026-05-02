import type { EligibilityResult } from '../types/index.ts';

/**
 * Checks voter eligibility based on age and citizenship.
 * @param {string} state - The voter's state
 * @param {number} age - The voter's age
 * @param {string} citizenship - The voter's citizenship status ('indian' or 'non-indian')
 * @returns {EligibilityResult} The eligibility check result
 */
export const checkEligibility = (state: string, age: number, citizenship: 'indian' | 'non-indian'): EligibilityResult => {
  const isIndian = citizenship === 'indian';
  const isOfAge = age >= 18;

  if (isIndian && isOfAge) {
    return {
      eligible: true,
      reason: "You meet the age and citizenship requirements under Article 326.",
      requirements: [
        "Be a citizen of India",
        "Be 18 years of age or older",
        "Be ordinarily resident in your constituency",
        "Not be disqualified for voting"
      ],
      deadline: "Voter registration is continuous but closes shortly after election announcement.",
      voterIdLink: "https://voters.eci.gov.in/"
    };
  }

  return {
    eligible: false,
    reason: !isIndian ? "Only Indian citizens can vote in Indian elections." : "You must be at least 18 years old to vote.",
    requirements: ["Citizenship of India", "Minimum age of 18"],
    deadline: "N/A",
    voterIdLink: "https://voters.eci.gov.in/"
  };
};
