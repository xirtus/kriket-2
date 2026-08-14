export type Role = 'bat' | 'bowl' | 'allrounder' | 'keeper';
export type BowlStyle = 'fast' | 'medium' | 'offspin' | 'legspin' | 'none';

export interface Ratings {
  batting: number; // 40..95
  bowling: number; // 40..95
  fielding: number; // 40..95
}

export interface PlayerSpec {
  id: string;
  name: string;
  shortName: string; // scoreboard style: "A. Verma"
  role: Role;
  bowlStyle: BowlStyle;
  ratings: Ratings;
}

export interface TeamSpec {
  id: string;
  name: string;
  shortName: string; // 3-letter
  color: number; // primary kit
  secondary: number; // trim
  players: PlayerSpec[]; // 11, in batting order
}

export type Format = 'T20' | 'ODI' | 'TEST';
export type PitchId = 'green_seamer' | 'dry_turner' | 'flat_batting' | 'damp_english';
export type WeatherId = 'clear' | 'overcast' | 'humid';
export type TimeOfDay = 'day' | 'twilight' | 'night';

export interface VenueSpec {
  name: string;
  pitch: PitchId;
  weather: WeatherId;
  time: TimeOfDay;
  boundary: number; // metres to rope
}

export interface MatchSetup {
  format: Format;
  home: TeamSpec;
  away: TeamSpec;
  venue: VenueSpec;
  playerTeam: 'home' | 'away';
  seed: number;
}

export type DismissalKind = 'bowled' | 'caught' | 'lbw' | 'runout' | 'stumped' | 'hitwicket';

export interface Dismissal {
  kind: DismissalKind;
  batsmanId: string;
  bowlerId?: string; // credited (not for runout)
  fielderId?: string; // catcher / run-out assist
}

export interface BallResolution {
  runsOffBat: number;
  extras: { wides: number; noBalls: number; byes: number; legByes: number };
  dismissal: Dismissal | null;
  boundary: 4 | 6 | null;
  legal: boolean; // counts toward over
  label: string; // commentary line
  speedKmh: number;
  contactQuality: number; // 0..1, 0 = no contact
  contactKind: string;
  shotX?: number; // where the ball ended up (for wagon wheel)
  shotZ?: number;
}
