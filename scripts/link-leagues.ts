import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Ladda in miljövariabler (.env.local)
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Saknar Supabase URL eller Service Role Key i .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 🛠️ HÄR ÄR ALLA DINA LIGOR OCH LAG
// ==========================================
const LEAGUE_MAPPINGS: Record<string, string[]> = {
  // --- FOTBOLL ---
  "Premier League": [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", 
    "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich Town", 
    "Leicester City", "Liverpool", "Manchester City", "Manchester United", 
    "Newcastle United", "Nottingham Forest", "Southampton", "Tottenham Hotspur", 
    "West Ham United", "Wolverhampton Wanderers", "Tottenham", "Newcastle", "West Ham", "Wolves", "Ipswich", "Leicester"
  ],
  "Allsvenskan": [
    "Västerås SK", "AIK", "Djurgården", "Hammarby", "Malmö FF", 
    "IFK Göteborg", "IF Elfsborg", "BK Häcken", "IFK Norrköping", 
    "Sirius", "Halmstads BK", "Kalmar FF", "IFK Värnamo", "GAIS", "Brommapojkarna", "Mjällby AIF"
  ],
  "Superettan": [
    "Östers IF", "Degerfors IF", "Landskrona BoIS", "Helsingborgs IF", 
    "Sandvikens IF", "Utsiktens BK", "Örgryte IS", "IK Brage", 
    "Trelleborgs FF", "Östersunds FK", "Örebro SK", "Gefle IF", 
    "Skövde AIK", "GIF Sundsvall", "Oddevold", "Varbergs BoIS"
  ],
  "La Liga": [
    "Real Madrid", "Barcelona", "Atletico Madrid", "Girona", "Athletic Club", 
    "Real Sociedad", "Real Betis", "Villarreal", "Valencia", "Alaves", 
    "Osasuna", "Getafe", "Celta Vigo", "Sevilla", "Mallorca", 
    "Las Palmas", "Rayo Vallecano", "Leganes", "Valladolid", "Espanyol"
  ],
  "Serie A": [
    "Inter", "AC Milan", "Juventus", "Atalanta", "Bologna", 
    "Roma", "Lazio", "Fiorentina", "Torino", "Napoli", 
    "Genoa", "Monza", "Lecce", "Udinese", "Hellas Verona", 
    "Cagliari", "Empoli", "Como", "Parma", "Venezia"
  ],

  // --- HOCKEY ---
  "SHL": [
    "Färjestad BK", "Växjö Lakers", "Skellefteå AIK", "Frölunda HC", 
    "Leksands IF", "Linköping HC", "Luleå HF", "Timrå IK", "Rögle BK", 
    "MoDo Hockey", "Örebro Hockey", "Malmö Redhawks", "HV71", "Brynäs IF"
  ],
  "HockeyAllsvenskan": [
    "VIK Hockey", "Södertälje SK", "Djurgårdens IF", "Mora IK", 
    "Björklöven", "Bik Karlskoga", "Nybro Vikings", "Almtuna IS", 
    "Kalmar HC", "Tingsryds AIF", "Östersunds IK", "Vimmerby HC", "AIK"
  ],
  "NHL": [
    "Boston Bruins", "Buffalo Sabres", "Detroit Red Wings", "Florida Panthers", 
    "Montreal Canadiens", "Ottawa Senators", "Tampa Bay Lightning", "Toronto Maple Leafs",
    "Carolina Hurricanes", "Columbus Blue Jackets", "New Jersey Devils", "New York Islanders", 
    "New York Rangers", "Philadelphia Flyers", "Pittsburgh Penguins", "Washington Capitals",
    "Chicago Blackhawks", "Colorado Avalanche", "Dallas Stars", "Minnesota Wild", 
    "Nashville Predators", "St. Louis Blues", "Utah Hockey Club", "Winnipeg Jets",
    "Anaheim Ducks", "Calgary Flames", "Edmonton Oilers", "Los Angeles Kings", 
    "San Jose Sharks", "Seattle Kraken", "Vancouver Canucks", "Vegas Golden Knights"
  ]
};

async function main() {
  console.log("🚀 Startar länkning av lag till ligor...\n");

  for (const [leagueName, teams] of Object.entries(LEAGUE_MAPPINGS)) {
    console.log(`🔍 Letar efter ligan: ${leagueName}`);
    
    // 1. Hitta ligans ID i databasen
    const { data: leagueData, error: leagueErr } = await supabase
      .from("entities")
      .select("id")
      .eq("type", "league")
      .ilike("name", leagueName)
      .single();

    if (leagueErr || !leagueData) {
      console.log(`   ⚠️ Hittade inte ligan "${leagueName}" i databasen. (Har du lagt in ligan i systemet?)`);
      continue;
    }

    const leagueId = leagueData.id;
    console.log(`   ✅ Hittade ${leagueName} (ID: ${leagueId})`);

    // 2. Uppdatera alla lag i listan med detta league_id
    // Vi använder 'in' med alla lagnamn för att ta dem i en enda smäll
    const { data: updatedTeams, error: updateErr } = await supabase
      .from("entities")
      .update({ league_id: leagueId })
      .eq("type", "team")
      .in("name", teams)
      .select("name");

    if (updateErr) {
      console.error(`   ❌ Fel vid uppdatering av lag för ${leagueName}:`, updateErr.message);
    } else {
      console.log(`   🔗 Länkade ${updatedTeams?.length || 0} lag till ${leagueName}.`);
      
      // Visa vilka lag som länkades
      if (updatedTeams && updatedTeams.length > 0) {
        const linkedNames = updatedTeams.map(t => t.name).join(", ");
        console.log(`      -> ${linkedNames}`);
      }
    }
    console.log("--------------------------------------------------");
  }

  console.log("✅ Färdigt!");
}

main();