/**
 * Copies the league's public BenchApp data into data/benchapp.json, which every page of the
 * site reads. No dependencies, no keys: Node 18+ and the internet.
 *
 *   node scripts/sync-benchapp.mjs
 *
 * Why a copy rather than reading BenchApp from the browser: BenchApp's API only answers
 * cross-site requests from *.benchapp.site (and localhost, which makes a local test lie), so a
 * page on www.ngmhl.ca can't call it. A GitHub Action runs this script on a timer instead
 * (.github/workflows/benchapp-sync.yml) and commits the file when something changed.
 *
 * The endpoints are the undocumented ones behind https://ngmhl.benchapp.site — the league's own
 * public data, but nothing promises the shape will hold. So every field read here is checked, and
 * a response that doesn't look right stops the script before it writes anything: the site keeps
 * showing the last good copy rather than nonsense.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const API = 'https://api.benchapp.site/api'
const SLUG = 'ngmhl'
const OUT = new URL('../data/benchapp.json', import.meta.url)

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${path} answered ${response.status}`)
  return response.json()
}

function refuse(message) {
  throw new Error(`${message} — BenchApp's response has probably changed. Nothing was written.`)
}

/** "2026-27 Regular Season" → "2026-27", the way the league names a season. */
function seasonLabel(name) {
  const match = String(name ?? '').match(/\d{4}-\d{2}/)
  return match ? match[0] : String(name ?? '').trim()
}

const POSITIONS = { FORWARD: 'F', DEFENCE: 'D', DEFENSE: 'D', GOALIE: 'G' }

/**
 * One game, trimmed to what the pages print.
 *
 * `s_datetime` is the league's local time (the Tue/Thu/Sun 9-11pm slots read as such);
 * `s_datetime_server` is BenchApp's own clock and is ignored. There is no "final" flag — every
 * game is ACTIVE and an unplayed one reads 0-0 — so the pages decide what has been played from the
 * date, the way BenchApp's own site does.
 */
function toGame(raw) {
  const when = String(raw.s_datetime ?? '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  const home = String(raw.s_home_team_name ?? '').trim()
  const away = String(raw.s_away_team_name ?? '').trim()
  if (!when || !home || !away) refuse(`Game ${raw.id} has no readable date or teams`)

  const game = {
    id: raw.id,
    date: when[1],
    time: when[2],
    away,
    home,
    awayScore: Number(raw.s_away_team_score ?? 0),
    homeScore: Number(raw.s_home_team_score ?? 0),
  }
  if (raw.s_sub_type === 'PLAYOFF') game.playoff = true
  if (raw.s_sub_type === 'PRE-SEASON' || raw.s_sub_type === 'PRESEASON') game.preseason = true
  if (raw.s_status && raw.s_status !== 'ACTIVE') game.cancelled = true
  if (raw.s_location) game.location = String(raw.s_location).trim()
  return game
}

async function readRosters(leagueId, season) {
  const [teams, players] = await Promise.all([
    getJson(`/leagues/${leagueId}/teams?seasonId=${season.id}`),
    getJson(`/leagues/${leagueId}/stats?seasonId=${season.id}`),
  ])
  if (!Array.isArray(teams) || !Array.isArray(players)) refuse('Teams or players was not a list')

  // Captains are the team's BenchApp managers: MANAGER is the C, ASSISTANT the A.
  const details = await Promise.all(
    teams.map((team) => getJson(`/leagues/${leagueId}/teams/${team.id}?seasonId=${season.id}`))
  )

  return teams
    .map((team, index) => {
      const name = String(team.t_name ?? '').trim()
      if (!name) refuse(`Team ${team.id} has no name`)

      const roster = players
        // Spares are listed on every team they cover; the roster card is the team itself.
        .filter((p) => p.team_id === team.id && p.player_class !== 'SPARE')
        .map((p) => {
          const playerName = String(p.player_name ?? '').trim()
          if (!playerName) refuse(`A ${name} player has no name`)
          const player = { name: playerName, position: POSITIONS[p.position] ?? null }
          if (p.player_number_display) player.number = String(p.player_number_display)
          return player
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      // A team's BenchApp managers are its captains: the first MANAGER wears the C, and the
      // ASSISTANT the A. Some teams list two MANAGERs and no ASSISTANT; the second one is
      // taken as the A, since BenchApp has no other way to say it.
      const managers = (details[index]?.managers ?? [])
        .map((m) => ({ name: String(m.p_name ?? '').trim(), level: m.t_access_level }))
        .filter((m, i, all) => m.name && all.findIndex((o) => o.name === m.name) === i)
      const bosses = managers.filter((m) => m.level === 'MANAGER')
      const captain = bosses[0]
      const assistant = managers.find((m) => m.level === 'ASSISTANT') ?? bosses[1]
      for (const [leader, role] of [[captain, 'captain'], [assistant, 'assistant']]) {
        const player = leader && findOnRoster(roster, leader.name)
        if (player) player.leadership = role
        else if (leader) console.warn(`  ${name}: ${role} "${leader.name}" is not on the roster`)
      }

      return { name, players: roster }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * A manager's BenchApp profile name is not always the roster's spelling of the same person
 * ("Stephan Thibert" manages, "Steph Thibert" plays; "Lew"/"Llew"). Exact first, then the only
 * player with that surname, then that surname with a first name either one starts.
 */
function findOnRoster(roster, fullName) {
  const exact = roster.find((p) => p.name.toLowerCase() === fullName.toLowerCase())
  if (exact) return exact
  const split = (n) => {
    const parts = n.toLowerCase().split(/\s+/)
    return { first: parts[0], last: parts.slice(1).join(' ') }
  }
  const wanted = split(fullName)
  const sameLast = roster.filter((p) => split(p.name).last === wanted.last)
  if (sameLast.length === 1) return sameLast[0]
  return sameLast.find((p) => {
    const first = split(p.name).first
    return first.startsWith(wanted.first) || wanted.first.startsWith(first)
  })
}

/**
 * Pretty-printed, but anything short (a game, a player) stays on one line, so a commit that
 * records three new scores shows three changed lines.
 */
function serialize(value, indent = '') {
  const flat = JSON.stringify(value)
  if (value === null || typeof value !== 'object' || flat.length <= 140) return flat
  const inner = indent + '  '
  if (Array.isArray(value)) {
    return `[\n${value.map((item) => inner + serialize(item, inner)).join(',\n')}\n${indent}]`
  }
  const entries = Object.entries(value).map(
    ([key, item]) => `${inner}${JSON.stringify(key)}: ${serialize(item, inner)}`
  )
  return `{\n${entries.join(',\n')}\n${indent}}`
}

async function main() {
  const league = await getJson(`/leagues/by-slug/${SLUG}`)
  if (!league?.id || !Array.isArray(league.seasons) || league.seasons.length === 0) {
    refuse(`No league or seasons for "${SLUG}"`)
  }
  const current = league.seasons.find((s) => String(s.id) === String(league.currentSeasonId))
  if (!current) refuse('BenchApp named no current season')

  // Newest first, by start date.
  const seasons = [...league.seasons].sort((a, b) =>
    String(b.s_start_date).localeCompare(String(a.s_start_date))
  )

  const out = {
    league: { name: league.name, timezone: league.timezone || 'America/Toronto' },
    currentSeason: seasonLabel(current.s_name),
    seasons: [],
  }

  for (const season of seasons) {
    const schedule = await getJson(`/leagues/${league.id}/schedule?seasonId=${season.id}`)
    if (!Array.isArray(schedule)) refuse(`The ${season.s_name} schedule was not a list`)
    const games = schedule
      .map(toGame)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.id - b.id)

    const entry = { name: seasonLabel(season.s_name), games }
    // Rosters for the current season only: that is the one the Teams page shows.
    if (season === current) entry.teams = await readRosters(league.id, season)
    out.seasons.push(entry)
    console.log(`${entry.name}: ${games.length} games${entry.teams ? `, ${entry.teams.length} teams` : ''}`)
  }

  // Only rewrite the file when the data moved, so the Action commits only real changes.
  let previous = null
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'))
  } catch {
    // First run, or an unreadable file: write a fresh one.
  }
  if (previous) {
    const { updated, ...previousData } = previous
    if (JSON.stringify(previousData) === JSON.stringify(out)) {
      console.log('No change since the last sync.')
      return
    }
  }

  await mkdir(new URL('.', OUT), { recursive: true })
  await writeFile(OUT, serialize({ updated: new Date().toISOString(), ...out }) + '\n')
  console.log(`Wrote ${OUT.pathname}`)
}

main().catch((error) => {
  console.error(`sync-benchapp failed: ${error.message ?? error}`)
  process.exit(1)
})
