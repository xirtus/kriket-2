// All units SI (meters, kg, seconds) unless noted. Cricket dimensions are real-world.

export const GRAVITY = 9.81; // m/s^2

// Ball (regulation men's cricket ball)
export const BALL_MASS = 0.156; // kg (5.5oz)
export const BALL_CIRCUMFERENCE = 0.224; // m (8.8in)
export const BALL_RADIUS = BALL_CIRCUMFERENCE / (2 * Math.PI); // ~0.0357m
export const BALL_MOMENT_OF_INERTIA = (2 / 3) * BALL_MASS * BALL_RADIUS * BALL_RADIUS; // thin shell approx

export const AIR_DENSITY = 1.225; // kg/m^3 at sea level, 15C

// Pitch geometry
export const PITCH_LENGTH = 20.12; // m, popping crease to popping crease (22 yards)
export const STUMPS_DISTANCE = PITCH_LENGTH; // stumps sit just behind popping crease, approximated at same distance
export const PITCH_WIDTH = 3.05; // m (10 ft) between the return creases, playing strip is wider visually
export const POPPING_CREASE_FROM_STUMPS = 1.22; // m (4 ft)
export const RETURN_CREASE_HALF_WIDTH = 1.32; // m from center

// Stumps
export const STUMP_HEIGHT = 0.7112; // m (28in)
export const STUMPS_WIDTH = 0.2286; // m (9in) overall width of the three stumps
export const BAIL_HEIGHT_ABOVE_STUMPS = 0.0127; // m

// Bat
export const BAT_LENGTH = 0.965; // m max
export const BAT_WIDTH = 0.108; // m max
export const BAT_SWEET_SPOT_OFFSET = 0.45; // m from handle, approx sweet spot location

// Boundary (typical international ground, varies)
export const BOUNDARY_RADIUS = 68; // m, used for outfield sizing

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

// Convert common cricket speed unit (km/h) <-> m/s
export const KMH_TO_MS = 1 / 3.6;
export const MS_TO_KMH = 3.6;
