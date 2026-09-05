'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Check, ChevronRight, CircleHelp, Crosshair, LockKeyhole, Maximize, Minimize, MousePointer2, RotateCcw, Sun, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { TrashketballEngine, GameSnapshot } from '@/lib/game/engine';
const initial: GameSnapshot = { level: 1, score: 0, shots: 0, baskets: 0, streak: 0, power: 69, angle: 42, ready: false, result: '', phase: 'playing', distance: 7.4 };
export default function Home() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TrashketballEngine | null>(null);
  const [game, setGame] = useState(initial);
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let alive = true;
    import('@/lib/game/engine').then(({ TrashketballEngine }) => {
      if (!alive || !canvasRef.current) return;
      try { engineRef.current = new TrashketballEngine(canvasRef.current, setGame); }
      catch { setError('Your browser couldn’t start the 3D scene. Enable hardware acceleration or try a browser with WebGL 2 support.'); }
    }).catch(() => setError('The game couldn’t load. Please refresh to try again.'));
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => { alive = false; engineRef.current?.dispose(); document.removeEventListener('fullscreenchange', onFullscreen); };
  }, []);
  useEffect(() => { engineRef.current?.setPaused(help); }, [help]);
  const beach = game.level === 2;
  return <main className={`game-shell ${beach ? 'beach-theme' : ''}`}>
    <div ref={canvasRef} className="game-canvas" aria-label="3D trashketball play area. Move to aim, click to throw. Arrow keys aim; plus and minus change power; Space throws." tabIndex={0} />
    <div className="scene-vignette" />
    <header className="game-header">
      <a className="wordmark" href="/" aria-label="Trashketball home"><span className="brand-icon"><Trash2 size={21} strokeWidth={1.8} /></span>trashketball<span className="wordmark-dot">.</span></a>
      <div className="chapter-nav" aria-label="Level progress"><span className={`chapter ${!beach ? 'active' : 'complete'}`}><span className="chapter-number">{beach ? <Check size={13} /> : '01'}</span><span>The office</span></span><span className="chapter-line" /><span className={`chapter ${beach ? 'active' : ''}`}><span className="chapter-number">{beach ? '02' : <LockKeyhole size={12} />}</span><span>Out of office</span></span></div>
      <div className="header-actions"><button className="icon-button" onClick={() => { engineRef.current?.setMuted(!muted); setMuted(!muted); }} aria-label={muted ? 'Turn sound on' : 'Mute sound'} title={muted ? 'Turn sound on' : 'Mute sound'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><button className="icon-button" onClick={() => setHelp(true)} aria-label="How to play" title="How to play"><CircleHelp size={18} /></button><button className="icon-button fullscreen-button" onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setHelp(true); } }} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen">{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button></div>
    </header>
    <section className="room-heading" aria-label="Current level"><div className="eyebrow"><span className="live-dot" />LEVEL {beach ? '02' : '01'} <span className="eyebrow-rule" /> {beach ? 'OFF THE CLOCK' : 'SEVERED FLOOR'}</div><h1>{beach ? <>Out of<br /><em>office.</em></> : <>Refine your<br /><em>aim.</em></>}</h1><p>{beach ? 'Ocean views. Nothing on the agenda.' : 'Your work is mysterious. Your goal isn’t.'}</p><div className="room-meta"><span>{beach ? 'THE COASTAL RETREAT' : 'MACRODATA REFINEMENT'}</span><span>/</span><span>{beach ? '16:42' : '09:00'}</span></div></section>
    <aside className="score-card" aria-label="Score and level progress"><div className="score-top"><span className="eyebrow">{beach ? 'TOTAL SCORE' : 'YOUR SCORE'}</span><span className="score-unit">PTS</span></div><div className="score-value" key={game.score}>{String(game.score).padStart(3, '0')}<span>/{beach ? '200' : '100'}</span></div><Progress value={Math.min(100, beach ? game.score - 100 : game.score)} aria-label="Progress to level goal" className="score-progress" /><div className="score-goal"><span>{beach ? '100 more to clock out' : '100 points to escape the office'}</span>{beach ? <Sun size={14} /> : <LockKeyhole size={13} />}</div><div className="score-stats"><div><strong>{game.baskets}</strong><span>BASKETS</span></div><div><strong>{game.shots ? Math.round(game.baskets / game.shots * 100) : 0}<small>%</small></strong><span>ACCURACY</span></div><div><strong>{game.streak}<small>×</small></strong><span>STREAK</span></div></div></aside>
    <div className="target-caption"><span className="target-label">+ &nbsp; THE OBJECTIVE</span><span>Every basket. <b>+10 points.</b></span></div>
    <div className={`shot-feedback ${game.result ? 'visible' : ''} ${game.result.includes('+10') ? 'success' : ''}`} role="status" aria-live="polite">{game.result}</div>
    {!game.ready && game.shots === 0 && !error && <div className="loading-scene"><span className="loading-ring" />Preparing your workspace…</div>}
    {error && <div className="error-card"><h2>A small interruption.</h2><p>{error}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again <RotateCcw size={16} /></button></div>}
    <footer className="game-footer"><div className="environment-caption"><span className="environment-dot" /><span>{beach ? 'SEA BREEZE. ZERO DEADLINES.' : 'PLEASE ENJOY EACH THROW EQUALLY.'}</span></div><div className="throw-console"><div className="console-instruction"><span className="console-icon"><MousePointer2 size={19} /></span><div><strong>Make it count.</strong><span className="desktop-hint">Move to aim · Click to throw</span><span className="touch-hint">Drag to aim · Release to throw</span></div></div><div className="power-control"><div className="control-label"><span>THROW POWER</span><strong>{Math.round(game.power)}<span>%</span></strong></div><Slider value={[game.power]} min={20} max={100} step={1} onValueChange={v => engineRef.current?.setPower(Array.isArray(v) ? v[0] : v)} aria-label="Throw power" className="power-slider" /><div className="power-endpoints"><span>SOFT</span><span>STRONG</span></div></div><button className="throw-button" disabled={!game.ready || game.phase !== 'playing' || help} onClick={() => engineRef.current?.shoot()}><span>{game.ready ? 'Throw paper' : 'In the air…'}</span>{game.ready ? <ArrowUpRight size={20} /> : <span className="button-spinner" />}<kbd>SPACE</kbd></button></div><div className="bottom-meta"><span><Crosshair size={13} /> TRAJECTORY ON<span className="bottom-divider" />{game.distance.toFixed(1)} M TO BIN</span><button onClick={() => engineRef.current?.reset()}><RotateCcw size={13} />Restart</button></div></footer>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="game-dialog"><div className="modal-symbol"><Trash2 size={28} /></div><span className="eyebrow">A VERY IMPORTANT WASTE OF TIME</span><DialogTitle>Paperwork, perfected.</DialogTitle><DialogDescription>Aim a crumpled paper ball into the bin. Each basket earns 10 points. Reach 100 to trade the severed floor for a beachside Airbnb.</DialogDescription><div className="help-steps"><p><MousePointer2 size={19} /><span><b>Find your line</b>Move your pointer to aim. On touch screens, drag to aim and release to throw.</span></p><p><AudioLines size={19} /><span><b>Feel the distance</b>Adjust throw power with the slider or scroll wheel. Follow the dotted flight path into the opening.</span></p><p><ArrowUpRight size={19} /><span><b>Let it fly</b>Click the room, press Space, or use the throw button. Arrow keys aim; + / − adjust power.</span></p></div><button className="primary-button" onClick={() => setHelp(false)}>Back to work <ChevronRight size={17} /></button></DialogContent></Dialog>
    <Dialog open={game.phase === 'level-complete' || game.phase === 'complete'}><DialogContent className="game-dialog victory-dialog" showCloseButton={false}><div className="modal-symbol"><Sun size={32} /></div><span className="eyebrow">{beach ? 'WORK–LIFE BALANCE: ACHIEVED' : 'YOUR OUTIE WOULD BE PROUD'}</span><DialogTitle>{beach ? 'Consider yourself\nclocked out.' : 'You’ve earned\na change of scenery.'}</DialogTitle><DialogDescription>{beach ? '200 points. Two rooms. A very productive unproductive day.' : '100 points. Your work here is done. There’s a sunlit beach house with your name on it.'}</DialogDescription><div className="victory-score">{game.score}<span>POINTS</span></div><button className="primary-button" onClick={beach ? () => engineRef.current?.reset() : () => engineRef.current?.nextLevel()}>{beach ? 'Play again' : 'Take me to the beach'}<ArrowUpRight size={20} /></button>{beach && <button className="text-button" onClick={() => engineRef.current?.keepPlaying()}>Stay a little longer</button>}</DialogContent></Dialog>
  </main>;
}
