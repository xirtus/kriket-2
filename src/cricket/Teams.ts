import type { PlayerSpec, Ratings, Role, BowlStyle, TeamSpec } from './Types';
import { mulberry32, pick, range, type Rng } from '../core/Rng';

/** Fictional-but-flavoured international squads, generated deterministically so both
 *  sides always field the same named XIs. Ratings follow role templates so every
 *  team has openers, a middle order, all-rounders and a bowling attack. */

const NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  albion: {
    first: ['James', 'Oliver', 'Harry', 'George', 'Ben', 'Tom', 'Sam', 'Joe', 'Will', 'Ed', 'Charlie', 'Dan'],
    last: ['Aldis', 'Bramble', 'Cartwright', 'Dunmore', 'Ellery', 'Farnham', 'Grove', 'Hallows', 'Ingram', 'Judd', 'Kettering', 'Loxley', 'Merriman', 'Norcross', 'Osric', 'Pemberton', 'Quill', 'Renshaw', 'Stokesley', 'Thwaite'],
  },
  bharat: {
    first: ['Arjun', 'Rohan', 'Vikram', 'Aditya', 'Karan', 'Dev', 'Ishaan', 'Nikhil', 'Rahul', 'Sahil', 'Varun', 'Yash'],
    last: ['Vora', 'Chandra', 'Mehta', 'Rathore', 'Iyer', 'Kadam', 'Bhosle', 'Naidu', 'Pillai', 'Saxena', 'Trivedi', 'Anand', 'Deshpande', 'Gill', 'Hegde', 'Joshi', 'Kulkarni', 'Menon', 'Pawar', 'Reddy'],
  },
  southern: {
    first: ['Jack', 'Lachlan', 'Cooper', 'Riley', 'Blake', 'Mitchell', 'Jake', 'Liam', 'Noah', 'Ethan', 'Max', 'Flynn'],
    last: ['Ackerman', 'Bracken', 'Callaghan', 'Draper', 'Eastwood', 'Fenwick', 'Granger', 'Holloway', 'Irons', 'Jennings', 'Keogh', 'Lazenby', 'Marsden', 'Nash', 'Ogilvie', 'Pryce', 'Quade', 'Rutherford', 'Slater', 'Tate'],
  },
  aotearoa: {
    first: ['Finn', 'Ollie', 'Theo', 'Henry', 'Leo', 'Archie', 'Caleb', 'Hunter', 'Louis', 'Marcus', 'Reuben', 'Zach'],
    last: ['Abernethy', 'Barlow', 'Clifford', 'Drummond', 'Evers', 'Fairweather', 'Gallagher', 'Hobbs', 'Inverness', 'Kirk', 'Laidlaw', 'MacAllister', 'Nairn', 'Ormond', 'Prebble', 'Quinlan', 'Rook', 'Sinclair', 'Tremain', 'Upton'],
  },
  calypso: {
    first: ['Andre', 'Dwayne', 'Kieron', 'Marlon', 'Shai', 'Jason', 'Kyle', 'Nicholas', 'Rovman', 'Shimron', 'Akeal', 'Gudakesh'],
    last: ['Ambris', 'Bravo', 'Chase', 'Dowrich', 'Emrit', 'Gabriel', 'Holder', 'Joseph', 'King', 'Lewis', 'Mayers', 'Motie', 'Paul', 'Powell', 'Reifer', 'Seales', 'Thomas', 'Walsh', 'Williams', 'Yannic'],
  },
  savanna: {
    first: ['Aiden', 'Quinton', 'Temba', 'Rassie', 'David', 'Kagiso', 'Anrich', 'Lungi', 'Marco', 'Tabraiz', 'Heinrich', 'Reeza'],
    last: ['Bavuma', 'Coetzee', 'de Kock', 'Elgar', 'Fortuin', 'Hamza', 'Jansen', 'Klaasen', 'Linde', 'Markram', 'Miller', 'Ngidi', 'Nortje', 'Phehlukwayo', 'Rabada', 'Rickelton', 'Shamsi', 'Stubbs', 'Verreynne', 'Zorzi'],
  },
  serendib: {
    first: ['Pathum', 'Kusal', 'Charith', 'Dhananjaya', 'Wanindu', 'Maheesh', 'Dunith', 'Matheesha', 'Avishka', 'Sadeera', 'Kamindu', 'Prabath'],
    last: ['Asalanka', 'Chameera', 'de Silva', 'Dickwella', 'Fernando', 'Gunathilaka', 'Hasaranga', 'Jayasuriya', 'Karunaratne', 'Lakmal', 'Mendis', 'Nissanka', 'Pathirana', 'Rajapaksa', 'Samarawickrama', 'Theekshana', 'Thirimanne', 'Vandersay', 'Wellalage', 'Wickramasinghe'],
  },
  indus: {
    first: ['Babar', 'Mohammad', 'Shaheen', 'Naseem', 'Fakhar', 'Imam', 'Shadab', 'Haris', 'Iftikhar', 'Abrar', 'Saim', 'Usman'],
    last: ['Afridi', 'Ahmed', 'Ali', 'Ayub', 'Azam', 'Fahim', 'Haris', 'Hasan', 'Iftikhar', 'Imad', 'Jamal', 'Khushdil', 'Mirza', 'Nawaz', 'Rauf', 'Rizwan', 'Shah', 'Shinwari', 'Wasim', 'Zaman'],
  },
};

interface RoleTemplate {
  role: Role;
  bowlStyle: BowlStyle;
  bat: [number, number];
  bowl: [number, number];
  field: [number, number];
}

/** Batting order: 2 openers, 3 middle order, keeper, all-rounder, 4 bowlers. */
const ORDER: RoleTemplate[] = [
  { role: 'bat', bowlStyle: 'none', bat: [80, 92], bowl: [30, 45], field: [55, 80] },
  { role: 'bat', bowlStyle: 'none', bat: [78, 90], bowl: [30, 45], field: [55, 80] },
  { role: 'bat', bowlStyle: 'none', bat: [82, 94], bowl: [35, 50], field: [60, 85] },
  { role: 'bat', bowlStyle: 'none', bat: [78, 90], bowl: [35, 50], field: [55, 80] },
  { role: 'bat', bowlStyle: 'none', bat: [75, 88], bowl: [35, 50], field: [55, 80] },
  { role: 'keeper', bowlStyle: 'none', bat: [70, 84], bowl: [20, 30], field: [80, 93] },
  { role: 'allrounder', bowlStyle: 'medium', bat: [68, 82], bowl: [70, 82], field: [65, 88] },
  { role: 'allrounder', bowlStyle: 'offspin', bat: [60, 75], bowl: [72, 84], field: [60, 82] },
  { role: 'bowl', bowlStyle: 'legspin', bat: [35, 55], bowl: [76, 90], field: [50, 75] },
  { role: 'bowl', bowlStyle: 'fast', bat: [30, 50], bowl: [78, 92], field: [50, 78] },
  { role: 'bowl', bowlStyle: 'fast', bat: [28, 48], bowl: [76, 90], field: [50, 78] },
];

function makePlayer(rng: Rng, pool: { first: string[]; last: string[] }, t: RoleTemplate, idx: number, teamId: string): PlayerSpec {
  const first = pick(rng, pool.first);
  const last = pick(rng, pool.last);
  const ratings: Ratings = {
    batting: Math.round(range(rng, t.bat[0], t.bat[1])),
    bowling: Math.round(range(rng, t.bowl[0], t.bowl[1])),
    fielding: Math.round(range(rng, t.field[0], t.field[1])),
  };
  // Spice: some medium-pacers are genuinely quick, some spinners are genuine leggies etc.
  let style = t.bowlStyle;
  if (style === 'medium' && rng() < 0.35) style = 'fast';
  if (style === 'legspin' && rng() < 0.3) style = 'offspin';
  return {
    id: `${teamId}-p${idx}`,
    name: `${first} ${last}`,
    shortName: `${first[0]}. ${last}`,
    role: t.role,
    bowlStyle: style,
    ratings,
  };
}

function makeTeam(id: string, name: string, shortName: string, color: number, secondary: number, seed: number): TeamSpec {
  const rng: Rng = mulberry32(seed);
  const pool = NAME_POOLS[id];
  const used = new Set<string>();
  const players = ORDER.map((t, i) => {
    let p = makePlayer(rng, pool, t, i, id);
    while (used.has(p.name)) p = makePlayer(rng, pool, t, i, id);
    used.add(p.name);
    return p;
  });
  return { id, name, shortName, color, secondary, players };
}

export const TEAMS: TeamSpec[] = [
  makeTeam('bharat', 'Bharat', 'BHA', 0x1c4f9c, 0xff8c1a, 101),
  makeTeam('albion', 'Albion', 'ALB', 0x9c1c2e, 0x0f2a52, 202),
  makeTeam('southern', 'Southern Stars', 'STH', 0xd8a412, 0x14522b, 303),
  makeTeam('aotearoa', 'Aotearoa', 'AOT', 0x1a1a1a, 0xb8c4cc, 404),
  makeTeam('calypso', 'Calypso Kings', 'CAL', 0x6e1e3c, 0xd8a412, 505),
  makeTeam('savanna', 'Savanna', 'SAV', 0x0f5a38, 0xd8c112, 606),
  makeTeam('serendib', 'Serendib Lions', 'SER', 0x123a6e, 0xd8a412, 707),
  makeTeam('indus', 'Indus Shaheens', 'IND', 0x0b6e4f, 0xffffff, 808),
];
