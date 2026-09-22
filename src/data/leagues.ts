export type RawLeague = {
  name: string;
  country: string;
};

export const rawFootballLeagues: RawLeague[] = [
  { name: "Allsvenskan", country: "Sverige" },
  { name: "Superettan", country: "Sverige" },
  { name: "Serie A", country: "Italien" },
  { name: "Serie B", country: "Italien" },
  { name: "La Liga", country: "Spanien" },
  { name: "Bundesliga", country: "Tyskland" },
  { name: "Eredivisie", country: "Nederländerna" },
  { name: "Ekstraklasa", country: "Polen" },
  { name: "Ligue 1", country: "Frankrike" },
  { name: "Premier League", country: "England" },
  { name: "Championship", country: "England/Wales" },
  { name: "Primeira Liga", country: "Portugal" },
];

export const rawHockeyLeagues: RawLeague[] = [
  { name: "SHL", country: "Sverige" },
  { name: "HockeyAllsvenskan", country: "Sverige" },
  { name: "NHL", country: "USA/Kanada" },
];