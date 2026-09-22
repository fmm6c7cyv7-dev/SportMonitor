import { describe, expect, it } from "vitest";
import { rawFootballPlayers } from "@/data/footballPlayers";
import { rawFootballTeams } from "@/data/footballTeams";
import { rawHockeyPlayers } from "@/data/hockeyPlayers";
import { rawHockeyTeams } from "@/data/hockeyTeams";
import {
  footballPlayers,
  hockeyPlayers,
  getBrowseEntities,
  getLeagueForTeam,
  getTeamForPlayer,
  searchBrowseSuggestions,
  foldDiacritics,
} from "@/lib/entityBrowse";

function normalize(value: string): string {
  return foldDiacritics(value).replace(/\s+/g, " ").trim();
}

describe("entityBrowse catalog invariants", () => {
  it("keeps football aliases from becoming duplicate canonical team entries", () => {
    const teams = getBrowseEntities("football", "team");
    const canonicalByNormalizedName = new Map(
      teams.map((team) => [normalize(team.name), team.id]),
    );

    const conflicts: Array<{
      team: string;
      alias: string;
      canonicalTeam: string;
    }> = [];

    for (const team of teams) {
      for (const alias of team.aliases) {
        const canonicalId = canonicalByNormalizedName.get(normalize(alias));
        if (!canonicalId || canonicalId === team.id) continue;

        const canonicalTeam = teams.find((entry) => entry.id === canonicalId);
        if (!canonicalTeam) continue;

        conflicts.push({
          team: team.name,
          alias,
          canonicalTeam: canonicalTeam.name,
        });
      }
    }

    expect(conflicts).toEqual([]);
  });

  it("maps every football team entity to one league entity", () => {
    const teams = getBrowseEntities("football", "team");
    const teamsWithoutLeague = teams
      .map((team) => ({
        id: team.id,
        name: team.name,
        league: getLeagueForTeam("football", team.id),
      }))
      .filter((entry) => !entry.league)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
      }));

    expect(teamsWithoutLeague).toEqual([]);
  });

  it("returns only canonical team entities for alias lookups", () => {
    const manUtdResults = searchBrowseSuggestions("football", "team", "man utd");
    const barcaResults = searchBrowseSuggestions("football", "team", "barca");
    const jarnkaminernaResults = searchBrowseSuggestions(
      "hockey",
      "team",
      "järnkaminerna",
    );

    expect(
      manUtdResults.filter((team) => team.id === "football-team-manchester-united"),
    ).toHaveLength(1);
    expect(
      barcaResults.filter((team) => team.id === "football-team-fc-barcelona"),
    ).toHaveLength(1);
    expect(
      jarnkaminernaResults.filter(
        (team) => team.id === "hockey-team-djurgardens-if",
      ),
    ).toHaveLength(1);
  });

  it("preserves Swedish football player coverage for players outside team catalog", () => {
    const hrgota = footballPlayers.find(
      (player) => player.id === "football-player-branimir-hrgota",
    );

    expect(hrgota?.name).toBe("Branimir Hrgota");
    expect(getTeamForPlayer("football", "football-player-branimir-hrgota")).toBeNull();

    const playerSearch = searchBrowseSuggestions("football", "player", "hrgota");
    expect(
      playerSearch.some((player) => player.id === "football-player-branimir-hrgota"),
    ).toBe(true);
  });
  it("keeps exact current club counts for every focus league", () => {
    const expectedFootballCounts: Record<string, number> = {
      "Serie A": 20,
      "Serie B": 20,
      "La Liga": 20,
      Bundesliga: 18,
      Eredivisie: 18,
      Ekstraklasa: 18,
      "Ligue 1": 18,
      "Premier League": 20,
      Championship: 24,
      "Primeira Liga": 18,
      Allsvenskan: 16,
      Superettan: 16,
    };

    for (const [league, expectedCount] of Object.entries(expectedFootballCounts)) {
      expect(rawFootballTeams.filter((team) => team.league === league)).toHaveLength(
        expectedCount,
      );
    }

    const expectedHockeyCounts: Record<string, number> = {
      SHL: 14,
      HockeyAllsvenskan: 14,
      NHL: 32,
    };

    for (const [league, expectedCount] of Object.entries(expectedHockeyCounts)) {
      expect(rawHockeyTeams.filter((team) => team.league === league)).toHaveLength(
        expectedCount,
      );
    }
  });

  it("has no duplicate canonical team names or slugs within a sport", () => {
    for (const teams of [rawFootballTeams, rawHockeyTeams]) {
      const normalizedNames = teams.map((team) => normalize(team.name));
      const normalizedSlugs = teams.map((team) => normalize(team.slug));

      expect(new Set(normalizedNames).size).toBe(normalizedNames.length);
      expect(new Set(normalizedSlugs).size).toBe(normalizedSlugs.length);
    }
  });

  it("has unique canonical player ids and preserves legitimate same-name players", () => {
    const footballIds = footballPlayers.map((player) => player.id);
    const hockeyIds = hockeyPlayers.map((player) => player.id);

    expect(new Set(footballIds).size).toBe(footballIds.length);
    expect(new Set(hockeyIds).size).toBe(hockeyIds.length);
    expect(footballPlayers).toHaveLength(rawFootballPlayers.length);
    expect(hockeyPlayers).toHaveLength(rawHockeyPlayers.length);

    const vancouverEliasPetterssons = hockeyPlayers.filter(
      (player) =>
        player.name === "Elias Pettersson" &&
        getTeamForPlayer("hockey", player.id)?.name === "Vancouver Canucks",
    );

    expect(vancouverEliasPetterssons).toHaveLength(2);
  });

  it("keeps player league values aligned when the player club is in the focus-team catalog", () => {
    for (const [players, teams] of [
      [rawFootballPlayers, rawFootballTeams],
      [rawHockeyPlayers, rawHockeyTeams],
    ] as const) {
      const teamLeagueByName = new Map(
        teams.map((team) => [normalize(team.name), team.league]),
      );

      const mismatches = players
        .map((player) => ({
          player: `${player.firstName} ${player.lastName}`,
          playerLeague: player.league,
          club: player.club,
          catalogLeague: teamLeagueByName.get(normalize(player.club)),
        }))
        .filter(
          (entry) =>
            entry.catalogLeague !== undefined &&
            entry.catalogLeague !== entry.playerLeague,
        );

      expect(mismatches).toEqual([]);
    }
  });

  it("resolves every hockey player to a current hockey team and league", () => {
    const hockeyTeams = getBrowseEntities("hockey", "team");
    const unresolvedPlayers = hockeyPlayers
      .map((player) => ({
        player: player.name,
        team: getTeamForPlayer("hockey", player.id),
      }))
      .filter((entry) => !entry.team);

    const unresolvedTeams = hockeyTeams
      .map((team) => ({
        team: team.name,
        league: getLeagueForTeam("hockey", team.id),
      }))
      .filter((entry) => !entry.league);

    expect(unresolvedPlayers).toEqual([]);
    expect(unresolvedTeams).toEqual([]);
  });

  it("keeps Emil Holm at Bologna after the Juventus loan ended", () => {
    const emilHolm = footballPlayers.find(
      (player) => player.id === "football-player-emil-holm",
    );

    expect(emilHolm?.name).toBe("Emil Holm");
    expect(
      getTeamForPlayer("football", "football-player-emil-holm")?.name,
    ).toBe("Bologna");
  });

  it("keeps verified English league moves on the correct side of the boundary", () => {
    const teamLeague = new Map(
      rawFootballTeams.map((team) => [team.name, team.league]),
    );

    for (const club of [
      "Coventry City",
      "Hull City",
      "Leeds United",
      "Sunderland",
    ]) {
      expect(teamLeague.get(club)).toBe("Premier League");
    }

    for (const club of [
      "Southampton",
      "West Ham United",
      "Wolverhampton Wanderers",
    ]) {
      expect(teamLeague.get(club)).toBe("Championship");
    }
  });

});
