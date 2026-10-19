#!/usr/bin/env python3
"""Swiss Ephemeris horoscope engine for Natalie's Tarot (run with /workspace/.tools-venv/bin/python).
stdin JSON: {"birth":{"y","m","d","hour"|null,"minute","tz","lat","lon"}, "date":"YYYY-MM-DD", "tz_now":"America/Los_Angeles", "name":...}
stdout JSON: natal points, today's transits/aspects, moon sign/phase, plain text, dos/donts. Real positions only;
text comes from the fixed tables below (no generated prose)."""
import json, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import swisseph as swe

swe.set_ephe_path(None)
FL = swe.FLG_MOSEPH | swe.FLG_SPEED
SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
ELEM = ['Fire','Earth','Air','Water'] * 3
P = {'Sun':swe.SUN,'Moon':swe.MOON,'Mercury':swe.MERCURY,'Venus':swe.VENUS,'Mars':swe.MARS,'Jupiter':swe.JUPITER,
     'Saturn':swe.SATURN,'Uranus':swe.URANUS,'Neptune':swe.NEPTUNE,'Pluto':swe.PLUTO}
PLANET = {'Sun':'identity and vitality','Moon':'feelings and needs','Mercury':'thinking, messages and talks',
          'Venus':'love, values and money','Mars':'drive, action and anger','Jupiter':'growth, luck and opportunity',
          'Saturn':'structure, limits and commitment','Uranus':'sudden change and freedom','Neptune':'dreams, intuition and blur',
          'Pluto':'deep change and power','ASC':'outward image','MC':'career and public direction'}
ASPECT = {0:('conjunct','merges with','so this theme is loud today'),60:('sextile','opens an easy door for',''),
          90:('square','rubs against','friction that asks for action'),120:('trine','flows easily with','support you can lean on'),
          180:('opposite','pulls against','asking for balance')}
def ordn(n): return f"{n}{'th' if 10 <= n % 100 <= 20 else {1:'st',2:'nd',3:'rd'}.get(n % 10, 'th')}"
HOUSE = {1:'self and body',2:'money and self-worth',3:'messages, siblings and short trips',4:'home and family',5:'creativity, fun and romance',
         6:'work routines and health',7:'partners and one-to-one relationships',8:'shared money, intimacy and change',
         9:'learning, travel and beliefs',10:'career and reputation',11:'friends, networks and hopes',12:'rest, retreat and the unseen'}
MOON_SIGN = {'Aries':'quick, brave moods','Taurus':'a wish for comfort and steadiness','Gemini':'a curious, chatty mood',
  'Cancer':'tender feelings and a pull toward home','Leo':'a wish to be seen and to play','Virgo':'a tidy, practical mood',
  'Libra':'a wish for harmony and company','Scorpio':'intense, private feelings','Sagittarius':'restless, hopeful moods',
  'Capricorn':'a serious, get-it-done mood','Aquarius':'a detached, independent mood','Pisces':'a dreamy, sensitive mood'}
DO = {('Jupiter','soft'):'Say yes to an opportunity or ask for something you want.',('Venus','soft'):'Reach out warmly; enjoy something beautiful.',
  ('Mars','soft'):'Put energy into one concrete task.',('Mercury','soft'):'Send the message or have the talk.',
  ('Saturn','soft'):'Do steady, disciplined work; it will hold.',('Sun','soft'):'Let yourself be visible.',
  ('Uranus','soft'):'Try one new approach.',('Neptune','soft'):'Make time for intuition, art or rest.',('Pluto','soft'):'Take back one bit of power quietly.'}
DONT = {('Jupiter','hard'):'Don’t over-promise or overspend.',('Venus','hard'):'Don’t buy or commit just to soothe a feeling.',
  ('Mars','hard'):'Don’t pick fights or rush.',('Mercury','hard'):'Don’t send things in a hurry; re-read first.',
  ('Saturn','hard'):'Don’t read delays as failure.',('Sun','hard'):'Don’t push your will on others.',
  ('Uranus','hard'):'Don’t blow up a plan on a sudden urge.',('Neptune','hard'):'Don’t sign or decide when things feel foggy.',
  ('Pluto','hard'):'Don’t force control over people.'}
PHASES = [(0,'New Moon','plant an intention'),(45,'Waxing Crescent','take a first step'),(90,'First Quarter','push through a block'),
          (135,'Waxing Gibbous','refine and adjust'),(180,'Full Moon','see results and release'),(225,'Waning Gibbous','share and give thanks'),
          (270,'Last Quarter','let go of what isn’t working'),(315,'Waning Crescent','rest and reflect')]

NICE = {'ASC': 'Ascendant', 'MC': 'Midheaven'}
def fmt(l): s = int(l // 30); d = l % 30; return f"{int(d)}°{int((d - int(d)) * 60):02d}′ {SIGNS[s]}"
def diff(a, b): return (a - b + 180) % 360 - 180
def house(l, c):
    for i in range(12):
        a, b = c[i], c[(i + 1) % 12]
        if (l - a) % 360 < (b - a) % 360: return i + 1

def main():
    q = json.load(sys.stdin)
    b = q['birth']
    has_time = b.get('hour') is not None
    hh, mm = (int(b['hour']), int(b.get('minute') or 0)) if has_time else (12, 0)
    local = datetime(int(b['y']), int(b['m']), int(b['d']), hh, mm, tzinfo=ZoneInfo(b['tz']))
    u = local.astimezone(timezone.utc)
    jdn = swe.julday(u.year, u.month, u.day, u.hour + u.minute / 60)
    natal = {n: swe.calc_ut(jdn, p, FL)[0][0] for n, p in P.items()}
    cusps = None
    if has_time:
        cusps, ascmc = swe.houses(jdn, float(b['lat']), float(b['lon']), b'P')
        natal['ASC'], natal['MC'] = ascmc[0], ascmc[1]
    tzn = ZoneInfo(q.get('tz_now') or 'America/Los_Angeles')
    y, m, d = map(int, q['date'].split('-'))
    nowl = datetime(y, m, d, 8, 0, tzinfo=tzn).astimezone(timezone.utc)   # 8 AM local
    jd = swe.julday(nowl.year, nowl.month, nowl.day, nowl.hour + nowl.minute / 60)
    tr = {n: swe.calc_ut(jd, p, FL)[0] for n, p in P.items()}
    aspects = []
    for tn, x in tr.items():
        if tn == 'Moon': continue
        orb = 2.0 if tn in ('Sun', 'Mercury', 'Venus', 'Mars') else 1.5
        for nn, nl in natal.items():
            if nn == 'Moon' and not has_time: continue   # natal Moon moves ~13°/day; unreliable without a time
            for a, (an, _v, _t) in ASPECT.items():
                o = abs(abs(diff(x[0], nl)) - a)
                if o <= orb:
                    x2 = swe.calc_ut(jd + 0.1, P[tn], FL)[0][0]
                    aspects.append({'transit': tn, 'aspect': an, 'angle': a, 'natal': nn, 'orb': round(o, 2),
                                    'applying': abs(abs(diff(x2, nl)) - a) < o, 'retro': x[3] < 0})
    aspects.sort(key=lambda r: r['orb'])
    sun, moon = tr['Sun'][0], tr['Moon'][0]; el = (moon - sun) % 360
    ph = [p for p in PHASES if el >= p[0] - 22.5][-1] if el < 337.5 else PHASES[0]
    msign = SIGNS[int(moon // 30)]
    lines, dos, donts = [], [], []
    lines.append(f"The Moon is in {msign} ({ELEM[int(moon//30)]}), bringing {MOON_SIGN[msign]}. It is a {ph[1]} ({round(el)}° from the Sun): a time to {ph[2]}.")
    if cusps: lines.append(f"Today's Moon moves through your {ordn(house(moon, cusps))} house, the area of {HOUSE[house(moon, cusps)]}.")
    for r in aspects[:7]:
        verb, tail = ASPECT[r['angle']][1], ASPECT[r['angle']][2]
        h = f" Transiting {r['transit']} is in your {ordn(house(tr[r['transit']][0], cusps))} house ({HOUSE[house(tr[r['transit']][0], cusps)]})." if cusps else ""
        lines.append(f"{r['transit']}{' (retrograde)' if r['retro'] else ''} at {fmt(tr[r['transit']][0])} is {r['aspect']} your natal {NICE.get(r['natal'], r['natal'])} ({fmt(natal[r['natal']])}, orb {r['orb']}°, {'applying' if r['applying'] else 'separating'}): {r['transit']}'s {PLANET[r['transit']]} {verb} your {PLANET[r['natal']]}{(', ' + tail) if tail else ''}.{h}")
        kind = 'soft' if r['angle'] in (60, 120) else 'hard' if r['angle'] in (90, 180) else ('soft' if r['transit'] in ('Jupiter','Venus','Sun') else 'hard')
        (dos if kind == 'soft' else donts).append((DO if kind == 'soft' else DONT).get((r['transit'], kind)))
    if not aspects: lines.append("No tight transits to your chart today; a quiet day to keep things simple.")
    dedupe = lambda xs: [x for i, x in enumerate(xs) if x and x not in xs[:i]][:5]
    out = {
        'date': q['date'], 'has_time': has_time,
        'natal': {n: {'lon': round(l, 3), 'pos': fmt(l), 'sign': SIGNS[int(l // 30)], **({'house': house(l, cusps)} if cusps and n not in ('ASC','MC') else {})} for n, l in natal.items()},
        'big_three': {'Sun': SIGNS[int(natal['Sun'] // 30)], 'Moon': SIGNS[int(natal['Moon'] // 30)] + ('' if has_time else ' (approx., no birth time)'),
                      'Ascendant': SIGNS[int(natal['ASC'] // 30)] if has_time else None},
        'transits': {n: {'pos': fmt(x[0]), 'retro': x[3] < 0, **({'house': house(x[0], cusps)} if cusps else {})} for n, x in tr.items()},
        'aspects': aspects, 'moon': {'sign': msign, 'phase': ph[1], 'elongation': round(el, 1)},
        'text': lines, 'dos': dedupe(dos), 'donts': dedupe(donts),
        'note': None if has_time else 'Birth time unknown: houses and the Ascendant are skipped, and the natal Moon is approximate (noon chart).',
    }
    json.dump(out, sys.stdout)

if __name__ == '__main__':
    main()
