import React, { useRef, useState, useEffect } from 'react';
import { 
  PenTool, 
  Eraser, 
  RotateCcw, 
  Trash2, 
  Eye, 
  Grid, 
  Sparkles, 
  Share2, 
  Download,
  Crosshair,
  ArrowUpRight,
  Maximize2
} from 'lucide-react';
import { sound } from '../utils/audio';

interface StylusCanvasProps {
  onSaveSketch: (dataUrl: string) => void;
  onSendToWarRoom: (dataUrl: string, analysisText?: string) => void;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
  type: 'pen' | 'highlighter' | 'eraser';
}

export const StylusCanvas: React.FC<StylusCanvasProps> = ({
  onSaveSketch,
  onSendToWarRoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#00f0ff');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [visionAnalysis, setVisionAnalysis] = useState<string | null>(null);

  const colors = [
    { label: 'Cyan', val: '#00f0ff' },
    { label: 'Amber', val: '#f59e0b' },
    { label: 'Emerald', val: '#10b981' },
    { label: 'Crimson', val: '#ef4444' },
    { label: 'White', val: '#ffffff' },
  ];

  // Initialize and handle responsive canvas resizing
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Only resize if different to avoid clearing on small jiggle
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
        redrawAll();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = containerRef.current.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw Grid if enabled
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(14, 116, 144, 0.15)';
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x < rect.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
      for (let y = 0; y < rect.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render strokes
    const all = currentStroke ? [...strokes, currentStroke] : strokes;
    all.forEach((s) => {
      if (s.points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);

      if (s.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = s.width * 4;
      } else if (s.type === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * 3;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });
  };

  useEffect(() => {
    redrawAll();
  }, [strokes, currentStroke, showGrid]);

  // Pointer Handlers for Stylus
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    setIsDrawing(true);
    setCurrentStroke({
      points: [{ x, y, pressure }],
      color: selectedColor,
      width: strokeWidth * (pressure ? Math.max(0.6, pressure * 1.5) : 1),
      type: activeTool,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    setCurrentStroke((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y, pressure }],
      };
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke && currentStroke.points.length > 0) {
      const updated = [...strokes, currentStroke];
      setStrokes(updated);
      setCurrentStroke(null);

      // Save sketch dataUrl to parent
      if (canvasRef.current) {
        onSaveSketch(canvasRef.current.toDataURL('image/png'));
      }
    }
  };

  const handleUndo = () => {
    sound.click();
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    sound.click();
    setStrokes([]);
    setCurrentStroke(null);
    setVisionAnalysis(null);
  };

  // Trigger Multimodal Hermes Vision Analysis
  const handleAnalyzeSketch = async () => {
    if (!canvasRef.current || strokes.length === 0) return;

    sound.dispatch();
    setIsAnalyzing(true);
    setVisionAnalysis(null);

    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSaveSketch(dataUrl);

    try {
      const res = await fetch('/api/stylus/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          prompt: 'Deconstruct and analyze this tactical sketch or schematic created on a Moto G5 Stylus.',
        }),
      });

      const data = await res.json();
      setVisionAnalysis(data.analysis || 'Analysis generated.');
      sound.toolSuccess();
    } catch (err: any) {
      setVisionAnalysis(`Vision analysis error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] overflow-hidden select-none">
      {/* Canvas Controls Header */}
      <div className="bg-[#0c1018] border-b border-cyan-950/70 p-2 sm:px-4 flex items-center justify-between gap-2 flex-wrap">
        {/* Tool selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              sound.click();
              setActiveTool('pen');
            }}
            className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
              activeTool === 'pen'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Fine Stylus Pen"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">STYLUS</span>
          </button>

          <button
            onClick={() => {
              sound.click();
              setActiveTool('highlighter');
            }}
            className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
              activeTool === 'highlighter'
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Tactical Highlighter"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MARK</span>
          </button>

          <button
            onClick={() => {
              sound.click();
              setActiveTool('eraser');
            }}
            className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
              activeTool === 'eraser'
                ? 'bg-red-950/80 border-red-500 text-red-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ERASE</span>
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5">
          {colors.map((c) => (
            <button
              key={c.val}
              onClick={() => {
                sound.click();
                setSelectedColor(c.val);
              }}
              style={{ backgroundColor: c.val }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                selectedColor === c.val ? 'border-white scale-110 shadow-[0_0_8px_currentColor]' : 'border-transparent opacity-80'
              }`}
              title={c.label}
            />
          ))}
        </div>

        {/* Grid & Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              sound.click();
              setShowGrid(!showGrid);
            }}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              showGrid
                ? 'bg-cyan-950/60 border-cyan-800 text-cyan-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Tactical Coordinate Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors"
            title="Undo Last Stroke"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-red-400 disabled:opacity-40 transition-colors"
            title="Clear Canvas"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Hermes Vision Analysis Button */}
          <button
            onClick={handleAnalyzeSketch}
            disabled={isAnalyzing || strokes.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 disabled:opacity-40 text-black font-mono text-xs font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all active:scale-95"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? 'ANALYZING...' : 'HERMES VISION'}</span>
          </button>
        </div>
      </div>

      {/* Stylus Drawing Area */}
      <div ref={containerRef} className="flex-1 relative w-full h-full bg-[#05070a] overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="stylus-canvas w-full h-full cursor-crosshair"
        />

        {/* Tactical Overlay Crosshairs */}
        <div className="absolute top-2 left-2 pointer-events-none font-mono text-[10px] text-cyan-500/40">
          MOTO G5 STYLUS DIGITIZER ACTIVE [PRESSURE SENSING ENABLED]
        </div>

        {/* Empty Canvas Callout */}
        {strokes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-600 font-mono text-center p-4">
            <Crosshair className="w-10 h-10 text-cyan-900/60 mb-2 animate-pulse" />
            <p className="text-xs text-slate-400 font-semibold">MOTO G5 STYLUS TACTICAL SCRATCHPAD</p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-xs">
              Use your stylus or touch to draw architecture schematics, network topologies, or notes. Tap "Hermes Vision" to analyze.
            </p>
          </div>
        )}
      </div>

      {/* Hermes Vision Output Drawer */}
      {visionAnalysis && (
        <div className="bg-[#0b0f17] border-t border-cyan-800/80 p-3 max-h-56 overflow-y-auto font-mono text-xs text-cyan-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Eye className="w-4 h-4" />
              <span>HERMES MULTIMODAL RECONNAISSANCE</span>
            </div>
            <button
              onClick={() => {
                if (canvasRef.current) {
                  onSendToWarRoom(canvasRef.current.toDataURL('image/png'), visionAnalysis);
                }
              }}
              className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-[10px] flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              DISPATCH TO WAR ROOM
            </button>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-300">
            {visionAnalysis}
          </div>
        </div>
      )}
    </div>
  );
};
