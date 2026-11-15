/*
 * NGMHL public site.
 *
 * Every page reads one file, /data/benchapp.json — the league's schedule, scores and rosters,
 * copied from BenchApp by scripts/sync-benchapp.mjs on a timer (.github/workflows/benchapp-sync.yml).
 * Standings and records are counted here from the scores, so the table can never disagree with the
 * results printed beside it.
 *
 * Each page's <body data-page="..."> picks what gets drawn into <main id="app">.
 */
;(function () {
  'use strict'

  var DATA_URL = '/data/benchapp.json'
  var TZ = 'America/Toronto'

  var NAV = [
    { href: '/schedule/', label: 'Schedule', page: 'schedule' },
    { href: '/results/', label: 'Results', page: 'results' },
    { href: '/standings/', label: 'Standings', page: 'standings' },
    { href: '/teams/', label: 'Teams', page: 'teams' },
  ]

  /* ── Teams ─────────────────────────────────────────────────────────────── */

  // Colours from the NGMHL app. `ink` is the colour as text on the page: [light theme, dark theme].
  var TEAMS = {
    bruins: { bg: '#F4A623', text: '#1a1a1a', ink: ['#8A5D00', '#F4A623'] },
    canadiens: { bg: '#AF1E2D', text: '#ffffff', ink: ['#AF1E2D', '#E8626F'] },
    flyers: { bg: '#F47420', text: '#1a1a1a', ink: ['#B14A00', '#F47420'] },
    leafs: { bg: '#003E7E', text: '#ffffff', ink: ['#003E7E', '#5DA9E9'] },
    senators: { bg: '#B79257', text: '#1a1a1a', ink: ['#7A5F2A', '#B79257'] },
    whalers: { bg: '#006747', text: '#ffffff', ink: ['#006747', '#3FBF8F'] },
  }
  var ALIASES = { canadians: 'canadiens', habs: 'canadiens', sens: 'senators' }
  var FALLBACK_TEAM = { bg: '#3d3d3d', text: '#ffffff', ink: ['#3d3d3d', '#cbd5e1'] }

  function teamSlug(name) {
    var key = String(name || '').trim().toLowerCase()
    key = ALIASES[key] || key
    return TEAMS[key] ? key : null
  }
  function teamStyle(name) {
    return TEAMS[teamSlug(name)] || FALLBACK_TEAM
  }
  function crest(name, cls) {
    var slug = teamSlug(name)
    if (!slug) return '<span class="' + (cls || 'crest') + '" aria-hidden="true"></span>'
    return '<img class="' + (cls || 'crest') + '" src="/assets/logos/teams/' + slug + '.svg" alt="" width="20" height="20">'
  }
  function inkVars(name) {
    var ink = teamStyle(name).ink
    return '--ink-light:' + ink[0] + ';--ink-dark:' + ink[1]
  }
  function shortName(name) {
    return String(name || '').slice(0, 3).toUpperCase()
  }

  /* ── Icons (Lucide, as the app uses) ───────────────────────────────────── */

  var ICONS = {
    menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    trophy: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    list: '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
    'calendar-days': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
  }
  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'
  }

  /* ── Small helpers ─────────────────────────────────────────────────────── */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
  function $(selector, root) {
    return (root || document).querySelector(selector)
  }

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  function parts(iso) {
    var p = iso.split('-').map(Number)
    return { y: p[0], m: p[1], d: p[2], dow: new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() }
  }
  /** 'Tue, Nov 17' */
  function dayLabel(iso) {
    var p = parts(iso)
    return DOW[p.dow] + ', ' + MONTHS[p.m - 1].slice(0, 3) + ' ' + p.d
  }
  /** 'TUE NOV 17' */
  function railDate(iso) {
    return dayLabel(iso).replace(',', '').toUpperCase()
  }
  /** '9:00 PM' */
  function timeLabel(hm) {
    var h = Number(hm.slice(0, 2))
    var m = hm.slice(3, 5)
    var suffix = h >= 12 ? 'PM' : 'AM'
    var h12 = h % 12 === 0 ? 12 : h % 12
    return h12 + ':' + m + ' ' + suffix
  }
  /** 'November 2026' */
  function monthTitle(ym) {
    return MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4)
  }

  /** The date and time in Ottawa right now, as 'YYYY-MM-DD' and 'HH:MM'. */
  function leagueNow() {
    var out = {}
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .forEach(function (part) {
        out[part.type] = part.value
      })
    return { date: out.year + '-' + out.month + '-' + out.day, time: out.hour + ':' + out.minute }
  }

  function getParam(name) {
    return new URLSearchParams(location.search).get(name)
  }
  function setParam(name, value) {
    var params = new URLSearchParams(location.search)
    if (value) params.set(name, value)
    else params.delete(name)
    var query = params.toString()
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash)
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      return null
    }
  }
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      /* private window: the choice just won't stick */
    }
  }

  /* ── League logic ──────────────────────────────────────────────────────── */

  /**
   * BenchApp has no "final" flag: an unplayed game reads 0-0, the same as a real 0-0. So a game
   * counts as played once its day is over — or tonight, once it has started and a score is in.
   */
  function isFinal(game, now) {
    if (game.cancelled) return false
    if (game.date < now.date) return true
    return game.date === now.date && game.time <= now.time && game.homeScore + game.awayScore > 0
  }

  function byWhen(a, b) {
    return (a.date + a.time).localeCompare(b.date + b.time)
  }

  /** Two points for a win, one for a tie; regular season only. */
  function buildStandings(games, now) {
    var table = {}
    function row(team) {
      if (!table[team]) {
        table[team] = { team: team, played: 0, wins: 0, losses: 0, ties: 0, gf: 0, ga: 0, results: [] }
      }
      return table[team]
    }
    games
      .filter(function (g) {
        return !g.playoff && !g.preseason
      })
      .slice()
      .sort(byWhen)
      .forEach(function (g) {
        var home = row(g.home)
        var away = row(g.away)
        if (!isFinal(g, now)) return
        home.played++
        away.played++
        home.gf += g.homeScore
        home.ga += g.awayScore
        away.gf += g.awayScore
        away.ga += g.homeScore
        if (g.homeScore === g.awayScore) {
          home.ties++
          away.ties++
          home.results.push('T')
          away.results.push('T')
        } else {
          var winner = g.homeScore > g.awayScore ? home : away
          var loser = winner === home ? away : home
          winner.wins++
          loser.losses++
          winner.results.push('W')
          loser.results.push('L')
        }
      })

    return Object.keys(table)
      .map(function (team) {
        var r = table[team]
        r.points = r.wins * 2 + r.ties
        r.pct = r.played ? r.points / (r.played * 2) : 0
        r.diff = r.gf - r.ga
        var last = r.results[r.results.length - 1]
        var run = 0
        for (var i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) run++
        r.streak = last ? last + run : null
        return r
      })
      .sort(function (a, b) {
        // Points, then wins (not goal difference: two teams level on points are split by who won
        // more often, not who ran up a score), then goal difference, goals for, name.
        return b.points - a.points || b.wins - a.wins || b.diff - a.diff || b.gf - a.gf || a.team.localeCompare(b.team)
      })
  }

  function recordOf(row) {
    return row ? row.wins + '-' + row.losses + '-' + row.ties : '0-0-0'
  }
  function recordsByTeam(rows) {
    var out = {}
    rows.forEach(function (r) {
      out[r.team] = r
    })
    return out
  }
  function pct(share) {
    var fixed = share.toFixed(3)
    return fixed.charAt(0) === '0' ? fixed.slice(1) : fixed
  }
  function signed(n) {
    return n > 0 ? '+' + n : String(n)
  }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd']
    var v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  /** The rink most of a season's games are at; a game anywhere else names its rink. */
  function usualLocation(games) {
    var counts = {}
    var best = null
    games.forEach(function (g) {
      if (!g.location) return
      counts[g.location] = (counts[g.location] || 0) + 1
      if (!best || counts[g.location] > counts[best]) best = g.location
    })
    return best
  }

  function teamsIn(games) {
    var names = {}
    games.forEach(function (g) {
      names[g.home] = true
      names[g.away] = true
    })
    return Object.keys(names).sort()
  }

  /* ── Menus ─────────────────────────────────────────────────────────────── */

  var openMenu = null

  function closeMenu(focusTrigger) {
    if (!openMenu) return
    var button = openMenu.querySelector('[aria-haspopup]')
    openMenu.querySelector('.menu-panel').hidden = true
    button.setAttribute('aria-expanded', 'false')
    if (focusTrigger) button.focus()
    openMenu = null
  }

  function bindMenu(root) {
    var button = root.querySelector('[aria-haspopup]')
    var panel = root.querySelector('.menu-panel')
    button.addEventListener('click', function (event) {
      event.stopPropagation()
      if (openMenu === root) return closeMenu(false)
      closeMenu(false)
      panel.hidden = false
      button.setAttribute('aria-expanded', 'true')
      openMenu = root
      var first = panel.querySelector('[aria-checked="true"], .menu-item')
      if (first) first.focus()
    })
    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      var items = Array.prototype.slice.call(panel.querySelectorAll('.menu-item'))
      var index = items.indexOf(document.activeElement)
      var next = event.key === 'ArrowDown' ? index + 1 : index - 1
      items[(next + items.length) % items.length].focus()
    })
  }

  document.addEventListener('click', function (event) {
    if (openMenu && !openMenu.contains(event.target)) closeMenu(false)
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu(true)
  })

  /** A dropdown: `items` are { label, value, href?, crest? }. */
  function menuHtml(opts) {
    var items = opts.items
      .map(function (item) {
        var selected = item.value === opts.value
        var lead = opts.crests ? (item.crest ? crest(item.crest) : '<span class="crest-blank"></span>') : ''
        var inner = lead + '<span>' + esc(item.label) + '</span>' + (selected ? icon('check', 'check') : '')
        var attrs = ' class="menu-item" role="menuitemradio" aria-checked="' + selected + '"'
        return item.href
          ? '<a' + attrs + ' href="' + esc(item.href) + '">' + inner + '</a>'
          : '<button type="button"' + attrs + ' data-value="' + esc(item.value) + '">' + inner + '</button>'
      })
      .join('')
    return (
      '<div class="menu" data-menu="' + esc(opts.name) + '">' +
      '<button type="button" class="' + opts.buttonClass + '" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(opts.ariaLabel) + '"' + (opts.buttonStyle ? ' style="' + opts.buttonStyle + '"' : '') + '>' +
      opts.buttonHtml +
      '</button>' +
      '<div class="menu-panel" role="menu" hidden>' + items + '</div>' +
      '</div>'
    )
  }

  /* ── Chrome: header, footer, theme ─────────────────────────────────────── */

  function isDark() {
    var root = document.documentElement
    if (root.classList.contains('dark')) return true
    if (root.classList.contains('light')) return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function themeButtonHtml() {
    var dark = isDark()
    return icon(dark ? 'sun' : 'moon')
  }

  function renderHeader(page) {
    var header = $('#site-header')
    if (!header) return
    var links = NAV.map(function (link) {
      return { label: link.label, value: link.page, href: link.href }
    })
    var inline = NAV.map(function (link) {
      return '<a class="header-ink" href="' + link.href + '"' + (link.page === page ? ' aria-current="page"' : '') + '>' + link.label + '</a>'
    }).join('')

    header.innerHTML =
      '<div class="header-row">' +
      '<nav class="header-start" aria-label="Main">' +
      menuHtml({ name: 'nav', items: [{ label: 'Home', value: 'home', href: '/' }].concat(links), value: page, buttonClass: 'header-ink', ariaLabel: 'Menu', buttonHtml: icon('menu') }) +
      '<div class="header-links">' + inline + '</div>' +
      '</nav>' +
      '<a class="header-crest" href="/" aria-label="NGMHL home"><img src="/assets/logos/ngmhl-tri-color.svg" alt="NGMHL" width="44" height="44"></a>' +
      '<div class="header-end"><button type="button" class="header-ink" data-theme-toggle aria-label="Switch to ' + (isDark() ? 'light' : 'dark') + ' mode">' + themeButtonHtml() + '</button></div>' +
      '</div>'

    bindMenu($('[data-menu="nav"]', header))
    $('[data-theme-toggle]', header).addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark'
      var root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(next)
      storageSet('theme', next)
      this.innerHTML = themeButtonHtml()
      this.setAttribute('aria-label', 'Switch to ' + (next === 'dark' ? 'light' : 'dark') + ' mode')
    })

    // Over the home page's photograph, the header is clear until the photo scrolls away.
    var hero = $('#hero')
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        function (entries) {
          header.classList.toggle('over-hero', entries[0].isIntersecting)
        },
        { rootMargin: '-64px 0px 0px 0px' }
      ).observe(hero)
    } else {
      header.classList.remove('over-hero')
    }
  }

  var SOCIALS = [
    {
      label: 'Instagram',
      href: 'https://www.instagram.com/ngmhl71',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/></svg>',
    },
    {
      label: 'X',
      href: 'https://x.com/NGMHL',
      svg: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.53 3h2.94l-6.42 7.34L21.6 21h-5.9l-4.63-6.05L5.78 21H2.83l6.87-7.85L2.4 3h6.05l4.19 5.54zm-1.03 16.24h1.63L7.6 4.68H5.85z"/></svg>',
    },
    {
      label: 'Facebook',
      href: 'https://www.facebook.com/groups/1615043607069658',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    },
  ]

  function renderFooter() {
    var footer = $('#site-footer')
    if (!footer) return
    footer.innerHTML =
      '<div class="footer-row">' +
      '<div class="footer-mark"><img src="/assets/logos/ngmhl-white-shiny.svg" alt="" width="40" height="40"><span>NGMHL</span></div>' +
      '<nav class="footer-links" aria-label="Footer">' +
      NAV.map(function (link) {
        return '<a href="' + link.href + '">' + link.label + '</a>'
      }).join('') +
      '</nav>' +
      '<ul class="socials">' +
      SOCIALS.map(function (s) {
        return '<li><a href="' + s.href + '" target="_blank" rel="noreferrer" aria-label="' + s.label + '">' + s.svg + '</a></li>'
      }).join('') +
      '</ul>' +
      '</div>' +
      '<p class="footer-legal">© ' + new Date().getFullYear() + " North Gloucester Men's Hockey League · Playing in Ottawa since 1971</p>"
  }

  /* ── Drag to scroll (the rail and the table are wider than a phone) ───── */

  function dragScroll(el) {
    var startX = 0
    var startScroll = 0
    var down = false
    var moved = false
    el.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      down = true
      moved = false
      startX = event.clientX
      startScroll = el.scrollLeft
    })
    window.addEventListener('pointermove', function (event) {
      if (!down) return
      var dx = event.clientX - startX
      if (!moved && Math.abs(dx) > 5) {
        moved = true
        el.classList.add('is-dragging')
      }
      if (moved) el.scrollLeft = startScroll - dx
    })
    window.addEventListener('pointerup', function () {
      if (!down) return
      down = false
      // Let the click that ends a drag land on nothing.
      setTimeout(function () {
        el.classList.remove('is-dragging')
      }, 0)
    })
  }

  /** The fade at a scroller's right edge, shown only while there is more to the right. */
  function edgeFade(wrap, scroller) {
    function update() {
      wrap.classList.toggle('has-more', scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2)
    }
    scroller.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
  }

  /* ── Scoreboard rail ───────────────────────────────────────────────────── */

  function renderRail(data, now) {
    var rail = $('#rail')
    if (!rail) return
    var season = currentSeason(data)
    var games = season ? season.games.filter(function (g) { return !g.cancelled }) : []
    // The last two game nights' results, however many games each night had.
    var played = games.filter(function (g) { return isFinal(g, now) })
    var nights = played
      .map(function (g) { return g.date })
      .filter(function (date, i, all) { return all.indexOf(date) === i })
      .slice(-2)
    var finals = played.filter(function (g) { return nights.indexOf(g.date) >= 0 })
    var upcoming = games
      .filter(function (g) { return !isFinal(g, now) && g.date >= now.date })
      .slice(0, 8)
    if (finals.length === 0 && upcoming.length === 0) {
      rail.remove()
      return
    }
    var records = recordsByTeam(buildStandings(season.games, now))

    function teamRow(team, value, won, isRecord) {
      return (
        '<div class="rail-team' + (won ? ' won' : '') + '">' +
        '<span class="crest-slot">' + crest(team) + '</span>' +
        '<span class="name">' + esc(team) + '</span>' +
        '<span class="value' + (isRecord ? ' record' : '') + '">' + esc(value) + '</span>' +
        '</div>'
      )
    }

    var cells = ''
    if (finals.length) cells += '<a class="rail-cap" href="/results/">' + icon('chevron-left') + '<span>Results</span></a>'
    finals.forEach(function (g, i) {
      cells +=
        '<div class="rail-cell"' + (i === finals.length - 1 ? ' data-latest' : '') + '>' +
        '<div>' +
        teamRow(g.home, g.homeScore, g.homeScore > g.awayScore) +
        teamRow(g.away, g.awayScore, g.awayScore > g.homeScore) +
        '</div>' +
        '<div class="rail-foot"><span>' + railDate(g.date) + '</span><span class="final">' + (g.playoff ? 'Playoff' : 'Final') + '</span></div>' +
        '</div>'
    })
    upcoming.forEach(function (g, i) {
      cells +=
        '<div class="rail-cell"' + (i === 0 ? ' data-next' : '') + '>' +
        '<div>' +
        teamRow(g.home, recordOf(records[g.home]), false, true) +
        teamRow(g.away, recordOf(records[g.away]), false, true) +
        '</div>' +
        '<div class="rail-foot"><span>' + railDate(g.date) + '</span><span>' + timeLabel(g.time) + '</span></div>' +
        '</div>'
    })
    cells += '<a class="rail-cap" href="/schedule/"><span>Schedule</span>' + icon('chevron-right') + '</a>'

    rail.innerHTML = '<section class="scroller" aria-label="Scores and schedule">' + cells + '</section>'
    var scroller = rail.firstChild
    dragScroll(scroller)

    // When the next game doesn't fit on screen, open with the latest result at the left edge,
    // lined up on a whole game rather than halfway through one.
    var next = $('[data-next]', scroller)
    var latest = $('[data-latest]', scroller)
    if (next && latest && next.offsetLeft + next.offsetWidth > scroller.clientWidth) {
      scroller.scrollLeft = latest.offsetLeft - scroller.offsetLeft
    }
  }

  /* ── Seasons ───────────────────────────────────────────────────────────── */

  function currentSeason(data) {
    return (
      data.seasons.filter(function (s) {
        return s.name === data.currentSeason
      })[0] || data.seasons[0]
    )
  }

  /** The season this URL asks for (?season=2025-26), or the current one. */
  function askedSeason(data) {
    var asked = getParam('season')
    return (
      data.seasons.filter(function (s) {
        return s.name === asked
      })[0] || currentSeason(data)
    )
  }

  function seasonPicker(data, season) {
    if (data.seasons.length < 2) return '<span class="secondary">' + esc(season.name) + '</span>'
    return menuHtml({
      name: 'season',
      items: data.seasons.map(function (s) {
        var params = new URLSearchParams(location.search)
        if (s.name === data.currentSeason) params.delete('season')
        else params.set('season', s.name)
        var query = params.toString()
        return { label: s.name, value: s.name, href: location.pathname + (query ? '?' + query : '') }
      }),
      value: season.name,
      buttonClass: 'control control--season',
      ariaLabel: 'Season, ' + season.name,
      buttonHtml: esc(season.name) + icon('chevron-down', 'chev'),
    })
  }

  /** The team filter, with each team's crest. */
  function teamFilter(teams, value) {
    var label = value ? value : 'All teams'
    var style = value ? teamStyle(value) : null
    return menuHtml({
      name: 'team',
      crests: true,
      items: [{ label: 'All teams', value: '' }].concat(
        teams.map(function (t) {
          return { label: t, value: t, crest: t }
        })
      ),
      value: value || '',
      buttonClass: 'control' + (value ? ' is-team' : ''),
      buttonStyle: style ? 'background:' + style.bg + ';color:' + style.text + ';border-color:' + style.bg : '',
      ariaLabel: 'Team, ' + label,
      buttonHtml: (value ? crest(value) : '') + '<span>' + esc(label) + '</span>' + icon('chevron-down', 'chev'),
    })
  }

  function bindTeamFilter(root, onChange) {
    var menu = $('[data-menu="team"]', root)
    if (!menu) return
    bindMenu(menu)
    menu.querySelectorAll('[data-value]').forEach(function (item) {
      item.addEventListener('click', function () {
        closeMenu(false)
        onChange(item.getAttribute('data-value'))
      })
    })
  }

  /* ── Standings table ───────────────────────────────────────────────────── */

  var COLUMNS = [
    ['played', 'GP', 'Games played'],
    ['wins', 'W', 'Wins'],
    ['losses', 'L', 'Losses'],
    ['ties', 'T', 'Ties'],
    ['points', 'PTS', 'Points'],
    ['pct', 'PTS%', 'Points percentage'],
    ['gf', 'GF', 'Goals for'],
    ['ga', 'GA', 'Goals against'],
    ['diff', 'DIFF', 'Goal difference'],
    ['streak', 'STRK', 'Current streak'],
  ]

  function standingsTable(rows) {
    if (rows.length === 0) {
      return '<p class="empty">No games have been scheduled yet, so there is no table to show.</p>'
    }
    var head =
      '<tr><th><span class="sr-only">Position</span></th><th class="team-col" scope="col">Team</th>' +
      COLUMNS.map(function (c) {
        return '<th scope="col"><abbr title="' + c[2] + '">' + c[1] + '</abbr></th>'
      }).join('') +
      '</tr>'
    var body = rows
      .map(function (r, i) {
        var slug = teamSlug(r.team)
        var name = slug ? '<a href="/teams/#' + slug + '">' + esc(r.team) + '</a>' : '<span>' + esc(r.team) + '</span>'
        return (
          '<tr>' +
          '<td class="pos">' + (i + 1) + '</td>' +
          '<td class="team-col"><span class="team-cell"><span class="team-bar" style="' + inkVars(r.team) + '" aria-hidden="true"></span>' + crest(r.team) + name + '</span></td>' +
          COLUMNS.map(function (c) {
            var key = c[0]
            var value = r[key]
            if (key === 'pct') value = pct(r.pct)
            if (key === 'diff') value = signed(r.diff)
            if (key === 'streak') value = r.streak || '—'
            return '<td' + (key === 'points' ? ' class="pts"' : '') + '>' + esc(value) + '</td>'
          }).join('') +
          '</tr>'
        )
      })
      .join('')
    return (
      '<div class="table-wrap"><div class="scroller" role="region" tabindex="0" aria-label="League standings, scroll sideways for the rest of the columns">' +
      '<table class="standings"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' +
      '</div></div>'
    )
  }

  function bindTable(root) {
    var wrap = $('.table-wrap', root)
    if (!wrap) return
    var scroller = $('.scroller', wrap)
    dragScroll(scroller)
    edgeFade(wrap, scroller)
  }

  /* ── Result cards ──────────────────────────────────────────────────────── */

  function resultBand(team, score, won, lost) {
    var style = teamStyle(team)
    return (
      '<div class="result-band' + (won ? ' won' : '') + (lost ? ' lost' : '') + '" style="background:' + style.bg + ';color:' + style.text + '">' +
      crest(team) +
      '<span class="name">' + esc(team) + '</span>' +
      '<span class="score">' + esc(score) + '</span>' +
      '</div>'
    )
  }

  function resultCard(g) {
    var tie = g.homeScore === g.awayScore
    return (
      '<article class="result-card">' +
      (g.playoff ? '<p class="result-tag">' + icon('trophy') + 'Playoff</p>' : '') +
      resultBand(g.away, g.awayScore, g.awayScore > g.homeScore, !tie && g.awayScore < g.homeScore) +
      resultBand(g.home, g.homeScore, g.homeScore > g.awayScore, !tie && g.homeScore < g.awayScore) +
      '</article>'
    )
  }

  function groupBy(list, keyOf) {
    var groups = []
    var index = {}
    list.forEach(function (item) {
      var key = keyOf(item)
      if (!(key in index)) {
        index[key] = groups.length
        groups.push([key, []])
      }
      groups[index[key]][1].push(item)
    })
    return groups
  }

  /* ── Pages ─────────────────────────────────────────────────────────────── */

  function renderHome(app, data, now) {
    var slot = $('#home-standings')
    if (!slot) return
    var season = currentSeason(data)
    var rows = buildStandings(season.games, now)
    var played = rows.some(function (r) {
      return r.played > 0
    })
    // A table of zeros under a "Standings" heading is a worse first impression than none.
    if (!played) return
    slot.innerHTML =
      '<section class="band"><div class="page--narrow" style="margin:0 auto">' +
      '<div class="section-head"><p class="eyebrow">' + esc(season.name) + '</p><h2>Standings</h2></div>' +
      standingsTable(rows) +
      '<p class="section-links"><a class="link" href="/standings/">Full standings</a><span class="muted"> · </span><a class="link" href="/schedule/">Schedule</a></p>' +
      '</div></section>'
    bindTable(slot)
  }

  function renderStandings(app, data, now) {
    var season = askedSeason(data)
    var rows = buildStandings(season.games, now)
    var played = rows.reduce(function (n, r) {
      return n + r.played
    }, 0)
    app.innerHTML =
      '<h1 class="page-title">League standings</h1>' +
      '<div class="page-intro">' + seasonPicker(data, season) + '<p class="secondary" style="font-size:.875rem">Two points for a win, one for a tie.</p></div>' +
      '<div style="margin-top:1.5rem">' + standingsTable(rows) + '</div>' +
      (rows.length && played === 0 ? '<p class="page-note">No results are in yet. Every team starts the season level.</p>' : '') +
      '<p class="page-note">Playoff games are not counted here. <a class="link" href="/schedule/' + location.search + '">Full schedule</a>.</p>'
    var picker = $('[data-menu="season"]', app)
    if (picker) bindMenu(picker)
    bindTable(app)
  }

  function renderResults(app, data, now) {
    var season = askedSeason(data)
    var finals = season.games
      .filter(function (g) {
        return isFinal(g, now) && !g.preseason
      })
      .sort(function (a, b) {
        return byWhen(b, a)
      })
    var teams = teamsIn(season.games)
    var state = { team: teams.indexOf(getParam('team')) >= 0 ? getParam('team') : '', month: '' }

    function draw() {
      var months = groupBy(finals.slice().reverse(), function (g) {
        return g.date.slice(0, 7)
      }).map(function (group) {
        return group[0]
      })
      var shown = finals.filter(function (g) {
        if (state.month && g.date.slice(0, 7) !== state.month) return false
        return !state.team || g.home === state.team || g.away === state.team
      })

      var controls =
        '<div class="controls">' +
        teamFilter(teams, state.team) +
        (months.length > 1
          ? '<button type="button" class="control" data-month="" aria-pressed="' + !state.month + '">All</button>' +
            months
              .map(function (m) {
                return '<button type="button" class="control" data-month="' + m + '" aria-pressed="' + (state.month === m) + '">' + MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3) + '</button>'
              })
              .join('')
          : '') +
        '</div>'

      var body
      if (finals.length === 0) {
        body = '<p class="secondary">No games have been played yet this season. <a class="link" href="/schedule/">The schedule</a> has what is coming.</p>'
      } else if (shown.length === 0) {
        body = '<p class="secondary">No results for that filter.</p>'
      } else {
        body =
          '<div class="nights">' +
          groupBy(shown, function (g) {
            return g.date
          })
            .map(function (night) {
              return '<div><h2 class="night-date">' + dayLabel(night[0]) + '</h2><div class="night-games">' + night[1].map(resultCard).join('') + '</div></div>'
            })
            .join('') +
          '</div>'
      }

      app.innerHTML =
        '<h1 class="page-title">Results</h1>' +
        '<div class="page-intro" style="margin-bottom:2rem">' + seasonPicker(data, season) + '</div>' +
        (finals.length ? controls : '') +
        body

      var picker = $('[data-menu="season"]', app)
      if (picker) bindMenu(picker)
      bindTeamFilter(app, function (team) {
        state.team = team
        setParam('team', team)
        draw()
      })
      app.querySelectorAll('[data-month]').forEach(function (button) {
        button.addEventListener('click', function () {
          state.month = button.getAttribute('data-month')
          draw()
        })
      })
    }
    draw()
  }

  function renderSchedule(app, data, now) {
    var season = askedSeason(data)
    var games = season.games.slice().sort(byWhen)
    var teams = teamsIn(games)
    var usual = usualLocation(games)
    var records = recordsByTeam(buildStandings(games, now))
    var anyAhead = games.some(function (g) {
      return !isFinal(g, now) && !g.cancelled
    })
    var view = storageGet('schedule-view') === 'calendar' ? 'calendar' : 'list'
    var state = {
      team: teams.indexOf(getParam('team')) >= 0 ? getParam('team') : '',
      // A season that's over has nothing ahead, so it opens on its results rather than on nothing.
      results: !anyAhead,
      records: false,
      view: view,
      month: null,
    }

    function matchesTeam(g) {
      return !state.team || g.home === state.team || g.away === state.team
    }

    function side(team, g, final) {
      var won = final && (team === g.home ? g.homeScore > g.awayScore : g.awayScore > g.homeScore)
      var tail = ''
      if (final) tail = '<span class="score">' + (team === g.home ? g.homeScore : g.awayScore) + '</span>'
      else if (state.records) tail = '<span class="record">' + recordOf(records[team]) + '</span>'
      return '<span class="side' + (won ? ' won' : '') + '">' + crest(team) + '<span class="team-name">' + esc(team) + '</span>' + tail + '</span>'
    }

    function gameLine(g) {
      var final = isFinal(g, now)
      var extras = ''
      if (g.playoff) extras += '<span class="tag-playoff">' + icon('trophy') + 'Playoff</span>'
      if (g.location && g.location !== usual) extras += '<span>' + esc(g.location) + '</span>'
      if (g.cancelled) extras += '<span class="tag-cancelled">Cancelled</span>'
      else if (final) extras += '<span class="tag-final">Final</span>'
      return (
        '<div class="game-line">' +
        '<span class="game-time">' + timeLabel(g.time) + '</span>' +
        '<span class="game-teams">' + side(g.away, g, final) + '<span class="vs" aria-hidden="true">@</span><span class="sr-only">at</span>' + side(g.home, g, final) + '</span>' +
        (extras ? '<span class="game-extra">' + extras + '</span>' : '') +
        '</div>'
      )
    }

    function listView() {
      var shown = games.filter(function (g) {
        if (!state.results && (isFinal(g, now) || g.cancelled)) return false
        return matchesTeam(g)
      })
      if (shown.length === 0) {
        return '<p class="secondary">' + (state.results ? 'No games for that team this season.' : 'Nothing left on the schedule. Turn on Results to see the games already played.') + '</p>'
      }
      return (
        '<div class="months">' +
        groupBy(shown, function (g) {
          return g.date.slice(0, 7)
        })
          .map(function (month) {
            return (
              '<section><h2 class="month-heading">' + monthTitle(month[0]) + '</h2><div>' +
              groupBy(month[1], function (g) {
                return g.date
              })
                .map(function (day) {
                  return '<div class="day"><div class="day-label">' + dayLabel(day[0]) + '</div><div>' + day[1].map(gameLine).join('') + '</div></div>'
                })
                .join('') +
              '</div></section>'
            )
          })
          .join('') +
        '</div>'
      )
    }

    function monthsOfSeason() {
      if (games.length === 0) return []
      var first = games[0].date.slice(0, 7)
      var last = games[games.length - 1].date.slice(0, 7)
      var out = []
      var y = Number(first.slice(0, 4))
      var m = Number(first.slice(5, 7))
      while (true) {
        var key = y + '-' + String(m).padStart(2, '0')
        out.push(key)
        if (key >= last) break
        m++
        if (m > 12) {
          m = 1
          y++
        }
      }
      return out
    }

    function calendarView() {
      var months = monthsOfSeason()
      if (months.length === 0) return '<p class="secondary">No games are scheduled yet.</p>'
      if (!state.month || months.indexOf(state.month) < 0) {
        var thisMonth = now.date.slice(0, 7)
        state.month = months.indexOf(thisMonth) >= 0 ? thisMonth : thisMonth < months[0] ? months[0] : months[months.length - 1]
      }
      var at = months.indexOf(state.month)
      var y = Number(state.month.slice(0, 4))
      var m = Number(state.month.slice(5, 7))
      var firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
      var daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
      var byDate = {}
      games.filter(matchesTeam).forEach(function (g) {
        ;(byDate[g.date] = byDate[g.date] || []).push(g)
      })

      var cells = DOW.map(function (d) {
        return '<div class="cal-dow">' + d + '</div>'
      }).join('')
      var total = Math.ceil((firstDow + daysInMonth) / 7) * 7
      for (var i = 0; i < total; i++) {
        var day = i - firstDow + 1
        if (day < 1 || day > daysInMonth) {
          cells += '<div class="cal-day outside" aria-hidden="true"></div>'
          continue
        }
        var iso = state.month + '-' + String(day).padStart(2, '0')
        var list = (byDate[iso] || [])
          .map(function (g) {
            var final = isFinal(g, now)
            var when = g.cancelled ? 'Off' : final ? 'Final' : timeLabel(g.time).replace(' ', '<span class="ampm"> </span>').replace(/(AM|PM)$/, '<span class="ampm">$1</span>')
            var score = function (team) {
              return final ? ' <b>' + (team === g.home ? g.homeScore : g.awayScore) + '</b>' : ''
            }
            return (
              '<div class="cal-game' + (g.playoff ? ' playoff' : '') + '" title="' + esc(g.away + ' at ' + g.home + (g.playoff ? ' (playoff)' : '')) + '">' +
              '<span class="when">' + when + '</span>' +
              '<span class="pair">' + crest(g.away) + '<span class="short">' + shortName(g.away) + '</span>' + score(g.away) +
              '<span class="muted at">@</span>' + crest(g.home) + '<span class="short">' + shortName(g.home) + '</span>' + score(g.home) + '</span>' +
              '<span class="sr-only">' + esc(g.away + ' at ' + g.home) + '</span>' +
              '</div>'
            )
          })
          .join('')
        cells += '<div class="cal-day' + (iso === now.date ? ' today' : '') + '"><span class="cal-num">' + day + '</span>' + list + '</div>'
      }

      return (
        '<div class="cal-head"><h2>' + monthTitle(state.month) + '</h2><div class="cal-nav">' +
        '<button type="button" data-cal="-1" aria-label="Previous month"' + (at <= 0 ? ' disabled' : '') + '>' + icon('chevron-left') + '</button>' +
        '<button type="button" data-cal="1" aria-label="Next month"' + (at >= months.length - 1 ? ' disabled' : '') + '>' + icon('chevron-right') + '</button>' +
        '</div></div>' +
        '<div class="cal">' + cells + '</div>'
      )
    }

    function draw() {
      var controls =
        '<div class="controls">' +
        teamFilter(teams, state.team) +
        (state.view === 'list'
          ? '<button type="button" class="control" data-toggle="results" aria-pressed="' + state.results + '">Results</button>' +
            '<button type="button" class="control" data-toggle="records" aria-pressed="' + state.records + '">Records</button>'
          : '') +
        '<div class="segmented" role="group" aria-label="View">' +
        '<button type="button" data-view="list" aria-pressed="' + (state.view === 'list') + '">' + icon('list') + 'List</button>' +
        '<button type="button" data-view="calendar" aria-pressed="' + (state.view === 'calendar') + '">' + icon('calendar-days') + 'Calendar</button>' +
        '</div>' +
        '</div>'

      app.innerHTML =
        '<h1 class="page-title">League Schedule</h1>' +
        '<div class="page-intro" style="margin-bottom:2rem">' + seasonPicker(data, season) + '</div>' +
        (games.length === 0
          ? '<p class="secondary">The ' + esc(season.name) + ' schedule is being built. Games appear here as they are booked.</p>'
          : controls + (state.view === 'list' ? listView() : calendarView()))

      var picker = $('[data-menu="season"]', app)
      if (picker) bindMenu(picker)
      bindTeamFilter(app, function (team) {
        state.team = team
        setParam('team', team)
        draw()
      })
      app.querySelectorAll('[data-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
          var key = button.getAttribute('data-toggle')
          state[key] = !state[key]
          draw()
        })
      })
      app.querySelectorAll('[data-view]').forEach(function (button) {
        button.addEventListener('click', function () {
          state.view = button.getAttribute('data-view')
          storageSet('schedule-view', state.view)
          draw()
        })
      })
      app.querySelectorAll('[data-cal]').forEach(function (button) {
        button.addEventListener('click', function () {
          var months = monthsOfSeason()
          state.month = months[months.indexOf(state.month) + Number(button.getAttribute('data-cal'))] || state.month
          draw()
        })
      })
    }
    draw()
  }

  var GROUPS = [
    ['F', 'Forwards'],
    ['D', 'Defence'],
    [null, 'Skaters'],
    ['G', 'Goalie'],
  ]

  function renderTeams(app, data, now) {
    var season = currentSeason(data)
    var teams = season.teams || []
    var rows = buildStandings(season.games, now)
    var started = rows.some(function (r) {
      return r.played > 0
    })

    function badge(player, team) {
      if (!player.leadership) return ''
      var style = teamStyle(team)
      if (player.leadership === 'captain') {
        return '<span class="badge" style="background:' + style.bg + ';color:' + style.text + '" title="Captain">C<span class="sr-only"> (captain)</span></span>'
      }
      return '<span class="badge badge--outline" style="' + inkVars(team) + '" title="Assistant captain">A<span class="sr-only"> (assistant captain)</span></span>'
    }

    function card(team) {
      var style = teamStyle(team.name)
      var slug = teamSlug(team.name) || team.name.toLowerCase()
      var place = -1
      rows.forEach(function (r, i) {
        if (r.team === team.name) place = i
      })
      var record = started && place >= 0 ? recordOf(rows[place]) + ' · ' + ordinal(place + 1) : ''
      var groups = GROUPS.map(function (group) {
        var players = team.players.filter(function (p) {
          return (p.position || null) === group[0]
        })
        if (players.length === 0) return ''
        var label = group[0] === 'G' && players.length > 1 ? 'Goalies' : group[1]
        return (
          '<div class="roster-group"><p class="roster-group-label">' + label + '</p><ul>' +
          players
            .map(function (p) {
              return '<li>' + (p.number ? '<span class="number">#' + esc(p.number) + '</span>' : '') + '<span>' + esc(p.name) + '</span>' + badge(p, team.name) + '</li>'
            })
            .join('') +
          '</ul></div>'
        )
      }).join('')

      return (
        '<section class="roster-card" id="' + esc(slug) + '" aria-labelledby="roster-' + esc(slug) + '">' +
        '<div class="roster-head" style="background:' + style.bg + ';color:' + style.text + '">' +
        crest(team.name) +
        '<div><h2 id="roster-' + esc(slug) + '">' + esc(team.name) + '</h2>' + (record ? '<p class="roster-record">' + record + '</p>' : '') + '</div>' +
        '</div>' +
        groups +
        '</section>'
      )
    }

    app.innerHTML =
      '<h1 class="page-title">Teams</h1>' +
      '<p class="secondary" style="margin-top:.25rem;font-size:.875rem">' + esc(season.name) + '</p>' +
      (teams.length
        ? '<div class="roster-grid" style="margin-top:1.5rem">' + teams.map(card).join('') + '</div>'
        : '<p class="secondary" style="margin-top:1.5rem">Rosters are posted once the draft is done. Check back then.</p>')

    // The page is drawn after load, so a #team link has to be followed by hand.
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1))
      if (target) target.scrollIntoView()
    }
  }

  /* ── Home page photographs ─────────────────────────────────────────────── */

  function rotateHero() {
    var hero = $('#hero')
    if (!hero) return
    var photos = []
    for (var i = 1; i <= 12; i++) photos.push('/assets/hero/ngmhl-' + String(i).padStart(2, '0') + '.jpg')
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    var index = 0
    setInterval(function () {
      var previous = $('.hero-photo.is-current', hero)
      index = (index + 1) % photos.length
      var next = new Image()
      next.alt = ''
      next.className = 'hero-photo is-current ' + (index % 2 === 0 ? 'pan-a' : 'pan-b')
      next.onload = function () {
        hero.insertBefore(next, hero.firstChild)
        if (previous) {
          previous.classList.remove('is-current')
          setTimeout(function () {
            previous.remove()
          }, 1300)
        }
      }
      next.src = photos[index]
    }, 7000)
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  var PAGES = {
    home: renderHome,
    schedule: renderSchedule,
    results: renderResults,
    standings: renderStandings,
    teams: renderTeams,
  }

  function boot() {
    var page = document.body.getAttribute('data-page') || 'home'
    renderHeader(page)
    renderFooter()
    rotateHero()

    var app = $('#app')
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      })
      .then(function (data) {
        var now = leagueNow()
        renderRail(data, now)
        if (app) app.classList.remove('loading')
        PAGES[page](app, data, now)
      })
      .catch(function (error) {
        console.error('NGMHL: could not load league data', error)
        var rail = $('#rail')
        if (rail) rail.remove()
        if (app && page !== 'home') {
          app.classList.remove('loading')
          app.innerHTML = '<p class="empty">The league data couldn’t be loaded just now. Try refreshing in a minute.</p>'
        }
      })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
