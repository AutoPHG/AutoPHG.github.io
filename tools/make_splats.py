"""Generate the paint-splatter / slash shapes used as CSS masks (flat-poster look)."""
import math, random, sys, os
out = sys.argv[1]

def slash(seed, w=1600, h=900):
    r = random.Random(seed)
    ax, ay, bx, by = 40, h * .86, w - 60, h * .14           # stroke runs bottom-left -> top-right
    dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    top, bot, n = [], [], 46
    for i in range(n + 1):
        t = i / n
        wd = (math.sin(math.pi * min(1, t * 1.25)) ** .55) * 74 * (1 - t * .55) + 3
        j = r.uniform(.72, 1.25)
        px, py = ax + dx * t, ay + dy * t
        top.append((px + nx * wd * j, py + ny * wd * j)); bot.append((px - nx * wd * r.uniform(.6, 1.1), py - ny * wd * r.uniform(.6, 1.1)))
    paths = ["M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in top + bot[::-1]) + "Z"]
    for _ in range(26):                                      # spikes thrown forward off the stroke
        t = r.uniform(.2, .98); px, py = ax + dx * t, ay + dy * t
        side = r.choice((-1, 1)); ln = r.uniform(90, 420) * (.5 + t); wd = r.uniform(5, 22)
        ang = r.uniform(.08, .5) * side
        vx, vy = ux * math.cos(ang) - uy * math.sin(ang), ux * math.sin(ang) + uy * math.cos(ang)
        ox, oy = nx * side * r.uniform(10, 50), ny * side * r.uniform(10, 50)
        p0 = (px + ox - vy * wd, py + oy + vx * wd); p1 = (px + ox + vy * wd, py + oy - vx * wd); p2 = (px + ox + vx * ln, py + oy + vy * ln)
        paths.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in (p0, p1, p2)) + "Z")
    circ = []
    for _ in range(70):                                      # droplets
        t = r.uniform(.25, 1.08); px, py = ax + dx * t, ay + dy * t
        d = r.gauss(0, 1) * (40 + 160 * t); rad = max(1.5, r.expovariate(1 / 6))
        circ.append(f'<circle cx="{px + nx * d:.1f}" cy="{py + ny * d:.1f}" r="{min(rad, 20):.1f}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="none"><path d="{" ".join(paths)}"/>{"".join(circ)}</svg>'

def burst(seed, s=1000):
    r = random.Random(seed); c = s / 2
    pts, n = [], 64
    for i in range(n):
        a = i / n * math.tau
        rad = (150 + r.uniform(-30, 40)) if i % 2 else (170 + r.expovariate(1 / 120))
        pts.append((c + math.cos(a) * min(rad, 480), c + math.sin(a) * min(rad, 480)))
    circ = [f'<circle cx="{c + math.cos(a) * d:.1f}" cy="{c + math.sin(a) * d:.1f}" r="{max(2, min(26, r.expovariate(1 / 7))):.1f}"/>'
            for a, d in ((r.uniform(0, math.tau), r.uniform(190, 480)) for _ in range(60))]
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}"><path d="M{" L".join(f"{x:.1f},{y:.1f}" for x, y in pts)}Z"/>{"".join(circ)}</svg>'

for name, svg in (("slash.svg", slash(11)), ("slash2.svg", slash(29)), ("burst.svg", burst(5))):
    open(os.path.join(out, name), "w", encoding="utf-8").write(svg); print(name, len(svg) // 1024, "KB")
