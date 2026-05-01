import NodeCache from 'node-cache';
import { CACHE_TTL } from '../constants.ts';

const timelineCache = new NodeCache({ stdTTL: CACHE_TTL.timeline });

export interface TimelineStage {
  stage: string;
  date: string;
  detail: string;
  law: string;
}

/** 
 * Returns the election timeline data.
 * @returns {TimelineStage[]} Array of timeline stages
 */
export const getTimeline = (): TimelineStage[] => {
  const cached = timelineCache.get<TimelineStage[]>('timeline');
  if (cached) return cached;

  const timeline: TimelineStage[] = [
    { stage: "Announcement", date: "T-45 Days", detail: "ECI announces election schedule via press conference.", law: "Article 324" },
    { stage: "MCC in Force", date: "Immediately", detail: "Model Code of Conduct comes into force, restricting parties and government.", law: "ECI Guidelines" },
    { stage: "Nominations", date: "T-30 Days", detail: "Candidates file nomination papers with the Returning Officer.", law: "Sec 33, RPA 1951" },
    { stage: "Scrutiny", date: "T-28 Days", detail: "Returning Officer examines nomination papers for validity.", law: "Sec 36, RPA 1951" },
    { stage: "Withdrawal", date: "T-25 Days", detail: "Last date for candidates to withdraw their candidature.", law: "Sec 37, RPA 1951" },
    { stage: "Campaigning", date: "T-25 to T-2", detail: "Candidates and parties actively campaign across constituencies.", law: "Sec 126, RPA 1951" },
    { stage: "Campaign Silence", date: "T-48 Hours", detail: "All campaigning must stop 48 hours before polling begins.", law: "Sec 126, RPA 1951" },
    { stage: "Polling Day", date: "Election Day", detail: "Registered voters cast their votes at designated polling booths.", law: "Sec 56, RPA 1951" },
    { stage: "Vote Counting", date: "T+3 Days", detail: "Votes are counted at counting centres under ECI supervision.", law: "Rule 56, Conduct of Election Rules 1961" },
    { stage: "Results & Oath", date: "Counting Day", detail: "Winners declared and new government formation begins.", law: "Sec 66, RPA 1951 & Article 75" },
  ];

  timelineCache.set('timeline', timeline);
  return timeline;
};
