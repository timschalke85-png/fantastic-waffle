// Dutch display names for all 48 qualified teams, keyed by FIFA code (the
// provider's "tla"). The English source name from football-data.org is in the
// comment for traceability. This is a localization mapping (CLAUDE.md asks us to
// create it), not tournament data — team identities/groups still come from the API.
//
// The seed matches each API team by its fifaCode; if any qualified team is
// missing here the seed THROWS rather than silently mislabelling, so this map
// must cover exactly the 48 codes the API returns.

export const NAME_NL: Record<string, string> = {
  // Group A
  CZE: "Tsjechië", // Czechia
  MEX: "Mexico", // Mexico
  RSA: "Zuid-Afrika", // South Africa
  KOR: "Zuid-Korea", // South Korea
  // Group B
  BIH: "Bosnië en Herzegovina", // Bosnia-Herzegovina
  CAN: "Canada", // Canada
  QAT: "Qatar", // Qatar
  SUI: "Zwitserland", // Switzerland
  // Group C
  BRA: "Brazilië", // Brazil
  HAI: "Haïti", // Haiti
  MAR: "Marokko", // Morocco
  SCO: "Schotland", // Scotland
  // Group D
  AUS: "Australië", // Australia
  PAR: "Paraguay", // Paraguay
  TUR: "Turkije", // Turkey
  USA: "Verenigde Staten", // United States
  // Group E
  CUW: "Curaçao", // Curaçao
  ECU: "Ecuador", // Ecuador
  GER: "Duitsland", // Germany
  CIV: "Ivoorkust", // Ivory Coast
  // Group F
  JPN: "Japan", // Japan
  NED: "Nederland", // Netherlands
  SWE: "Zweden", // Sweden
  TUN: "Tunesië", // Tunisia
  // Group G
  BEL: "België", // Belgium
  EGY: "Egypte", // Egypt
  IRN: "Iran", // Iran
  NZL: "Nieuw-Zeeland", // New Zealand
  // Group H
  CPV: "Kaapverdië", // Cape Verde Islands
  KSA: "Saoedi-Arabië", // Saudi Arabia
  ESP: "Spanje", // Spain
  URY: "Uruguay", // Uruguay
  // Group I
  FRA: "Frankrijk", // France
  IRQ: "Irak", // Iraq
  NOR: "Noorwegen", // Norway
  SEN: "Senegal", // Senegal
  // Group J
  ALG: "Algerije", // Algeria
  ARG: "Argentinië", // Argentina
  AUT: "Oostenrijk", // Austria
  JOR: "Jordanië", // Jordan
  // Group K
  COL: "Colombia", // Colombia
  COD: "DR Congo", // Congo DR
  POR: "Portugal", // Portugal
  UZB: "Oezbekistan", // Uzbekistan
  // Group L
  CRO: "Kroatië", // Croatia
  ENG: "Engeland", // England
  GHA: "Ghana", // Ghana
  PAN: "Panama", // Panama
};
