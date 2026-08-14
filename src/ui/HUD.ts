export interface BatterLine {
  name: string;
  runs: number;
  balls: number;
  onStrike: boolean;
}

const CSS = `
.khud { position: fixed; inset: 0; pointer-events: none; font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #fff; }
.khud .bug { position: absolute; left: 18px; bottom: 16px; display: flex; align-items: stretch; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.5); }
.khud .bug .team { padding: 8px 14px; font-weight: 800; font-size: 20px; letter-spacing: 1px; }
.khud .bug .score { background: rgba(8,14,22,0.88); padding: 8px 14px; font-size: 20px; font-weight: 700; }
.khud .bug .meta { background: rgba(8,14,22,0.72); padding: 4px 14px; font-size: 12px; display: flex; flex-direction: column; justify-content: center; }
.khud .strip { position: absolute; left: 18px; bottom: 76px; background: rgba(8,14,22,0.78); border-radius: 6px; padding: 7px 12px; font-size: 13.5px; line-height: 1.5; box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
.khud .strip b { color: #ffd24b; }
.khud .topright { position: absolute; right: 18px; top: 16px; text-align: right; background: rgba(8,14,22,0.78); border-radius: 6px; padding: 8px 14px; font-size: 14px; line-height: 1.55; }
.khud .flash { position: absolute; bottom: 27%; left: 50%; transform: translateX(-50%); font-size: 42px; font-weight: 900; letter-spacing: 2px; text-shadow: 0 2px 14px rgba(0,0,0,0.75); transition: opacity .35s, transform .35s; }
.khud .timing { position: absolute; bottom: 37%; left: 50%; transform: translateX(-50%); font-size: 17px; font-weight: 800; letter-spacing: 3px; text-shadow: 0 1px 8px rgba(0,0,0,0.8); transition: opacity .25s; }
.khud .balls { position: absolute; left: 18px; bottom: 128px; display: flex; gap: 5px; }
.khud .balls span { width: 24px; height: 24px; border-radius: 50%; background: rgba(8,14,22,0.78); display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; }
.khud .tag { position: absolute; top: 16px; left: 18px; background: #c21807; padding: 5px 12px; font-weight: 800; font-size: 14px; letter-spacing: 2px; border-radius: 4px; }
.khud .hint { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); background: rgba(8,14,22,0.72); border-radius: 6px; padding: 6px 14px; font-size: 12.5px; text-align: center; }
.khud .bowl-panel { position: absolute; right: 18px; bottom: 16px; background: rgba(8,14,22,0.82); border-radius: 6px; padding: 10px 16px; font-size: 14px; line-height: 1.7; min-width: 220px; }
.khud .meter { height: 10px; border-radius: 5px; background: rgba(255,255,255,0.15); position: relative; overflow: hidden; margin-top: 6px; }
.khud .meter .fill { position: absolute; inset: 0; width: 0%; background: linear-gradient(90deg,#36d17c,#ffd24b,#ff4b4b); }
`;

export class HUD {
  private readonly root: HTMLDivElement;
  private readonly bugTeam: HTMLDivElement;
  private readonly bugScore: HTMLDivElement;
  private readonly bugMeta: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  private readonly topRight: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly timingEl: HTMLDivElement;
  private readonly ballsEl: HTMLDivElement;
  private readonly tagEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private readonly bowlPanel: HTMLDivElement;
  private flashTimer = 0;
  private timingTimer = 0;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'khud';

    const bug = document.createElement('div');
    bug.className = 'bug';
    this.bugTeam = document.createElement('div');
    this.bugTeam.className = 'team';
    this.bugScore = document.createElement('div');
    this.bugScore.className = 'score';
    this.bugMeta = document.createElement('div');
    this.bugMeta.className = 'meta';
    bug.append(this.bugTeam, this.bugScore, this.bugMeta);

    this.strip = document.createElement('div');
    this.strip.className = 'strip';

    this.topRight = document.createElement('div');
    this.topRight.className = 'topright';

    this.flashEl = document.createElement('div');
    this.flashEl.className = 'flash';
    this.flashEl.style.opacity = '0';

    this.timingEl = document.createElement('div');
    this.timingEl.className = 'timing';
    this.timingEl.style.opacity = '0';

    this.ballsEl = document.createElement('div');
    this.ballsEl.className = 'balls';

    this.tagEl = document.createElement('div');
    this.tagEl.className = 'tag';
    this.tagEl.style.display = 'none';

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hint';

    this.bowlPanel = document.createElement('div');
    this.bowlPanel.className = 'bowl-panel';
    this.bowlPanel.style.display = 'none';

    this.root.append(bug, this.strip, this.topRight, this.flashEl, this.timingEl, this.ballsEl, this.tagEl, this.hintEl, this.bowlPanel);
    document.body.appendChild(this.root);
  }

  setScore(teamColor: string, teamShort: string, runs: number, wickets: number, overs: string, metaLine1: string, metaLine2: string): void {
    this.bugTeam.textContent = teamShort;
    this.bugTeam.style.background = teamColor;
    this.bugTeam.style.color = '#fff';
    this.bugScore.textContent = `${runs}/${wickets}  (${overs})`;
    this.bugMeta.innerHTML = `${metaLine1}<br/>${metaLine2}`;
  }

  setStrip(html: string): void {
    this.strip.innerHTML = html;
  }

  setBallInfo(html: string): void {
    this.topRight.innerHTML = html;
  }

  setHint(text: string): void {
    this.hintEl.innerHTML = text;
    this.hintEl.style.display = text ? 'block' : 'none';
  }

  flash(text: string, color = '#ffffff', small = false): void {
    this.flashEl.textContent = text;
    this.flashEl.style.color = color;
    this.flashEl.style.fontSize = small ? '26px' : '42px';
    this.flashEl.style.opacity = '1';
    this.flashEl.style.transform = 'translateX(-50%) scale(1.04)';
    this.flashTimer = 2.1;
  }

  timing(text: string, color: string): void {
    this.timingEl.textContent = text;
    this.timingEl.style.color = color;
    this.timingEl.style.opacity = '1';
    this.timingTimer = 1.1;
  }

  setRecentBalls(symbols: string[]): void {
    this.ballsEl.innerHTML = '';
    for (const s of symbols) {
      const el = document.createElement('span');
      el.textContent = s;
      if (s === 'W') el.style.color = '#ff6a6a';
      else if (s === '4') el.style.color = '#4bafff';
      else if (s === '6') el.style.color = '#ffd24b';
      else if (s === '•') el.style.color = '#9aa';
      this.ballsEl.appendChild(el);
    }
  }

  setTag(text: string | null, color = '#c21807'): void {
    if (text) {
      this.tagEl.textContent = text;
      this.tagEl.style.background = color;
      this.tagEl.style.display = 'block';
    } else {
      this.tagEl.style.display = 'none';
    }
  }

  showBowlPanel(html: string, meterFrac: number | null): void {
    this.bowlPanel.style.display = 'block';
    this.bowlPanel.innerHTML = html + (meterFrac !== null ? `<div class="meter"><div class="fill" style="width:${(meterFrac * 100).toFixed(1)}%"></div></div>` : '');
  }

  hideBowlPanel(): void {
    this.bowlPanel.style.display = 'none';
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flashEl.style.opacity = '0';
    }
    if (this.timingTimer > 0) {
      this.timingTimer -= dt;
      if (this.timingTimer <= 0) this.timingEl.style.opacity = '0';
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
