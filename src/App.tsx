import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Printer, 
  Download, 
  FileText, 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Info, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Constants
const DPI = 300;
const MM_TO_INCH = 1 / 25.4;
const PAPER_SIZES = {
  a4: { w: 210, h: 297, unit: 'mm', name: 'A4 (210 × 297 mm)' },
  letter: { w: 8.5, h: 11, unit: 'in', name: 'Letter (8.5 × 11 inches)' },
  long: { w: 8.5, h: 13, unit: 'in', name: 'Long / Legal (8.5 × 13 inches)' }
};
const MARGIN_MM = 5;

const PHOTO_SIZES = [
  { id: 'passport', name: 'Passport Size (2×2 inches)', w: 2, h: 2, unit: 'in' },
  { id: '1x1', name: '1×1 inch (Small ID)', w: 1, h: 1, unit: 'in' },
  { id: '2x2', name: '2×2 inches', w: 2, h: 2, unit: 'in' },
  { id: '1.5x1.5', name: '1.5×1.5 inches', w: 1.5, h: 1.5, unit: 'in' },
  { id: '2x3', name: '2×3 inches (US Visa)', w: 2, h: 3, unit: 'in' },
  { id: 'ph-passport', name: '3.5×4.5 cm (PH Passport)', w: 3.5, h: 4.5, unit: 'cm' },
  { id: '4.5x3.5', name: '4.5×3.5 cm (ID format)', w: 4.5, h: 3.5, unit: 'cm' },
  { id: 'custom', name: 'Custom Size...', w: 2, h: 2, unit: 'in' }
];

export default function App() {
  // State
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [currentDisplayImage, setCurrentDisplayImage] = useState<HTMLImageElement | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState('a4');
  const [photoSize, setPhotoSize] = useState('passport');
  const [copies, setCopies] = useState(8);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [customW, setCustomW] = useState(2);
  const [customH, setCustomH] = useState(2);
  const [customWUnit, setCustomWUnit] = useState('in');
  const [customHUnit, setCustomHUnit] = useState('in');
  const [attire, setAttire] = useState('none');
  const [bgColor, setBgColor] = useState('white');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({ message: 'No image uploaded', type: 'info' });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas and render
  useEffect(() => {
    render();
  }, [currentDisplayImage, paperSize, photoSize, copies, orientation, customW, customH, customWUnit, customHUnit]);

  const updateCanvasSize = (canvas: HTMLCanvasElement) => {
    const paper = PAPER_SIZES[paperSize as keyof typeof PAPER_SIZES];
    let wPx, hPx;
    
    if (paper.unit === 'mm') {
      wPx = Math.round(paper.w * MM_TO_INCH * DPI);
      hPx = Math.round(paper.h * MM_TO_INCH * DPI);
    } else {
      wPx = Math.round(paper.w * DPI);
      hPx = Math.round(paper.h * DPI);
    }

    if (orientation === 'portrait') {
      canvas.width = wPx;
      canvas.height = hPx;
    } else {
      canvas.width = hPx;
      canvas.height = wPx;
    }
  };

  const getTargetDimensions = () => {
    const size = PHOTO_SIZES.find(s => s.id === photoSize) || PHOTO_SIZES[0];
    let wInch, hInch;

    if (photoSize === 'custom') {
      wInch = customW;
      hInch = customH;
      if (customWUnit === 'cm') wInch /= 2.54;
      if (customHUnit === 'cm') hInch /= 2.54;
    } else {
      wInch = size.w;
      hInch = size.h;
      if (size.unit === 'cm') {
        wInch /= 2.54;
        hInch /= 2.54;
      }
    }

    return {
      widthPx: Math.round(wInch * DPI),
      heightPx: Math.round(hInch * DPI),
      wInch,
      hInch
    };
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentDisplayImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    updateCanvasSize(canvas);

    const target = getTargetDimensions();
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate grid
    const marginPx = Math.round(MARGIN_MM * MM_TO_INCH * DPI);
    const availableWidth = canvas.width - (marginPx * 2);
    const availableHeight = canvas.height - (marginPx * 2);

    // Spacing between photos
    const spacingPx = Math.round(1 * MM_TO_INCH * DPI);

    // Find best grid
    let bestCols = 1;
    let bestRows = 1;
    let found = false;

    const maxColsPossible = Math.floor((availableWidth + spacingPx) / (target.widthPx + spacingPx));
    const maxRowsPossible = Math.floor((availableHeight + spacingPx) / (target.heightPx + spacingPx));

    if (maxColsPossible === 0 || maxRowsPossible === 0) {
      setStatus({ message: "Error: Photo size too large for page!", type: 'error' });
      return;
    }

    for (let c = 1; c <= maxColsPossible; c++) {
      let r = Math.ceil(copies / c);
      if (r <= maxRowsPossible) {
        bestCols = c;
        bestRows = r;
        found = true;
      }
    }

    if (!found) {
      bestCols = maxColsPossible;
      bestRows = maxRowsPossible;
      setStatus({ message: `Warning: Only ${bestCols * bestRows} copies fit.`, type: 'warning' });
    } else {
      setStatus({ message: `Arranged ${copies} copies.`, type: 'success' });
    }

    const totalGridWidth = (bestCols * target.widthPx) + ((bestCols - 1) * spacingPx);
    const totalGridHeight = (bestRows * target.heightPx) + ((bestRows - 1) * spacingPx);

    const startX = marginPx + (availableWidth - totalGridWidth) / 2;
    const startY = marginPx + (availableHeight - totalGridHeight) / 2;

    let drawnCount = 0;
    for (let r = 0; r < bestRows; r++) {
      for (let c = 0; c < bestCols; c++) {
        if (drawnCount >= copies) break;

        const x = startX + c * (target.widthPx + spacingPx);
        const y = startY + r * (target.heightPx + spacingPx);

        drawCroppedImage(ctx, currentDisplayImage, x, y, target.widthPx, target.heightPx);
        drawnCount++;
      }
      if (drawnCount >= copies) break;
    }
  };

  const drawCroppedImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, targetW: number, targetH: number) => {
    const imgAspect = img.width / img.height;
    const targetAspect = targetW / targetH;

    let sx, sy, sWidth, sHeight;

    if (imgAspect > targetAspect) {
      sHeight = img.height;
      sWidth = img.height * targetAspect;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.width;
      sHeight = img.width / targetAspect;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, targetW, targetH);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, targetW, targetH);
  };

  useEffect(() => {
    if (!process.env.GEMINI_API_KEY) {
      setStatus({ 
        message: "Warning: GEMINI_API_KEY is not set. AI features will not work.", 
        type: 'error' 
      });
    }
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setCurrentDisplayImage(img);
        setThumbnailUrl(event.target?.result as string);
        setStatus({ message: `Ready: ${file.name}`, type: 'success' });
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const applyAIChanges = async () => {
    if (!originalImage) return;

    if (attire === 'none' && bgColor === 'white') {
      setCurrentDisplayImage(originalImage);
      return;
    }

    setIsProcessing(true);
    setStatus({ message: "AI is processing your photo...", type: 'info' });

    const maxRetries = 2;
    let retryCount = 0;

    const executeAI = async (): Promise<void> => {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("Gemini API Key is missing. Please check your environment variables.");
        }
        const ai = new GoogleGenAI({ apiKey });

        // Convert original image to base64 with resizing
        const maxDim = 1024;
        let width = originalImage.width;
        let height = originalImage.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error("Could not create canvas context");
        
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.drawImage(originalImage, 0, 0, width, height);
        const base64Data = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        const prompt = `Edit this photo for a professional ID. 
        1. Change the person's attire to ${attire}. 
        2. Change the background to a solid ${bgColor} color. 
        3. Keep the person's face and features exactly as they are. 
        4. Ensure the lighting is professional and the result looks like a high-quality studio photo.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
              { text: prompt }
            ]
          }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        let modifiedBase64 = null;

        if (parts) {
          for (const part of parts) {
            if (part.inlineData) {
              modifiedBase64 = part.inlineData.data;
              break;
            }
          }
        }

        if (modifiedBase64) {
          const img = new Image();
          img.onload = () => {
            setCurrentDisplayImage(img);
            setThumbnailUrl(`data:image/jpeg;base64,${modifiedBase64}`);
            setIsProcessing(false);
            setStatus({ message: "AI enhancement applied successfully!", type: 'success' });
          };
          img.src = `data:image/jpeg;base64,${modifiedBase64}`;
        } else {
          throw new Error("AI did not return an image. Please try again.");
        }

      } catch (err: any) {
        const errorMsg = err?.message || '';
        const isQuotaError = errorMsg.toLowerCase().includes('quota') || 
                             errorMsg.toLowerCase().includes('rate limit') || 
                             errorMsg.includes('429');

        if (isQuotaError && retryCount < maxRetries) {
          retryCount++;
          const delay = retryCount * 2000; // 2s, 4s
          setStatus({ 
            message: `Quota reached. Retrying in ${delay/1000}s... (Attempt ${retryCount}/${maxRetries})`, 
            type: 'info' 
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeAI();
        }

        console.error("AI Error:", err);
        let finalMessage = err?.message || 'AI processing failed.';
        
        if (isQuotaError) {
          finalMessage = "Gemini API Quota Exceeded. The free tier has limits (e.g., 15 requests per minute). Please wait a minute or upgrade your plan at ai.google.dev.";
        }
        
        setStatus({ 
          message: finalMessage, 
          type: 'error' 
        });
        setIsProcessing(false);
      }
    };

    await executeAI();
  };

  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentDisplayImage) return;
    const link = document.createElement('a');
    link.download = `PrintReady_${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const downloadDOC = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentDisplayImage) return;

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    const paper = PAPER_SIZES[paperSize as keyof typeof PAPER_SIZES];
    
    let pageWidth, pageHeight;
    if (paper.unit === 'mm') {
      pageWidth = orientation === 'portrait' ? `${paper.w}mm` : `${paper.h}mm`;
      pageHeight = orientation === 'portrait' ? `${paper.h}mm` : `${paper.w}mm`;
    } else {
      pageWidth = orientation === 'portrait' ? `${paper.w}in` : `${paper.h}in`;
      pageHeight = orientation === 'portrait' ? `${paper.h}in` : `${paper.w}in`;
    }

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          @page { size: ${pageWidth} ${pageHeight}; margin: 0; }
          body { margin: 0; padding: 0; text-align: center; }
          img { width: 100%; height: auto; }
        </style>
      </head>
      <body><img src="${imageData}" /></body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PrintReady_${new Date().getTime()}.doc`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Printer className="text-blue-600 w-8 h-8" />
              PrintReady Photo Arranger
            </h1>
            <p className="text-slate-500 mt-1">Best for passport, visa, school ID, and company ID printing on A4 paper.</p>
          </motion.div>
          
          <div className="flex gap-3">
            <button 
              onClick={downloadPNG}
              disabled={!currentDisplayImage}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
            <button 
              onClick={downloadDOC}
              disabled={!currentDisplayImage}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Download .DOC
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Controls */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Upload Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Upload Photo
              </h2>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer block"
              >
                <div className="border-2 border-dashed border-slate-300 group-hover:border-blue-400 rounded-xl p-8 transition-all text-center bg-slate-50 group-hover:bg-blue-50/30">
                  {!thumbnailUrl ? (
                    <div className="space-y-2">
                      <Upload className="mx-auto text-slate-400 group-hover:text-blue-500 transition-colors w-10 h-10" />
                      <p className="text-sm font-medium text-slate-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-400">JPG, PNG or WEBP (Max 10MB)</p>
                    </div>
                  ) : (
                    <div>
                      <img src={thumbnailUrl} className="max-h-32 mx-auto rounded-lg shadow-sm border border-slate-200" alt="Thumbnail" />
                      <p className="text-xs text-blue-600 mt-2 font-medium">Click to change photo</p>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden" 
                  accept="image/*" 
                />
              </div>
            </section>

            {/* Settings Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                Arrangement Settings
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Paper Size</label>
                <select 
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {Object.entries(PAPER_SIZES).map(([key, val]) => (
                    <option key={key} value={key}>{val.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Photo Size</label>
                <select 
                  value={photoSize}
                  onChange={(e) => setPhotoSize(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {PHOTO_SIZES.map(size => (
                    <option key={size.id} value={size.id}>{size.name}</option>
                  ))}
                </select>
              </div>

              <AnimatePresence>
                {photoSize === 'custom' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="grid grid-cols-2 gap-4 overflow-hidden"
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Width</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={customW}
                          onChange={(e) => setCustomW(parseFloat(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-12 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                        <select 
                          value={customWUnit}
                          onChange={(e) => setCustomWUnit(e.target.value)}
                          className="absolute right-1 top-1 bottom-1 bg-white border-none text-xs rounded px-1"
                        >
                          <option value="in">in</option>
                          <option value="cm">cm</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Height</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={customH}
                          onChange={(e) => setCustomH(parseFloat(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-12 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                        <select 
                          value={customHUnit}
                          onChange={(e) => setCustomHUnit(e.target.value)}
                          className="absolute right-1 top-1 bottom-1 bg-white border-none text-xs rounded px-1"
                        >
                          <option value="in">in</option>
                          <option value="cm">cm</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Number of Copies</label>
                <select 
                  value={copies}
                  onChange={(e) => setCopies(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {[2, 4, 6, 8, 10, 12, 15, 20, 30, 40].map(n => (
                    <option key={n} value={n}>{n} copies</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Page Orientation</label>
                <div className="flex gap-4">
                  {['portrait', 'landscape'].map(opt => (
                    <label key={opt} className="flex-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="orientation" 
                        value={opt} 
                        checked={orientation === opt}
                        onChange={() => setOrientation(opt as any)}
                        className="hidden peer" 
                      />
                      <div className="text-center p-3 rounded-lg border border-slate-200 bg-slate-50 peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-600 transition-all capitalize">
                        <span className="text-sm font-medium">{opt}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* AI Enhancements Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                AI Formal Attire & BG
              </h2>
              
              <p className="text-xs text-slate-500 italic flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-500" />
                Uses AI to change clothes and background.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Background Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'white', class: 'bg-white' },
                    { id: 'blue', class: 'bg-blue-600' },
                    { id: 'red', class: 'bg-red-600' },
                    { id: 'light gray', class: 'bg-slate-200' }
                  ].map(color => (
                    <label key={color.id} className="cursor-pointer">
                      <input 
                        type="radio" 
                        name="bgColor" 
                        value={color.id} 
                        checked={bgColor === color.id}
                        onChange={() => setBgColor(color.id)}
                        className="hidden peer" 
                      />
                      <div className={`h-8 rounded border border-slate-200 ${color.class} peer-checked:ring-2 peer-checked:ring-purple-500 transition-all`}></div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Formal Attire</label>
                <select 
                  value={attire}
                  onChange={(e) => setAttire(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                >
                  <option value="none">Original Clothes</option>
                  <option value="suit and tie">Professional Suit & Tie</option>
                  <option value="blazer and blouse">Professional Blazer</option>
                  <option value="barong tagalog">Barong Tagalog (Filipino)</option>
                  <option value="white corporate shirt">Corporate White Shirt</option>
                </select>
              </div>

              <button 
                onClick={applyAIChanges}
                disabled={!originalImage || isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Apply AI Changes
              </button>
            </section>

            {/* Tips */}
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
              <h3 className="text-blue-800 font-semibold text-sm flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" />
                Printing Tip
              </h3>
              <p className="text-blue-700 text-xs leading-relaxed">
                For best results, use <strong>glossy photo paper</strong> and set your printer quality to <strong>High</strong>. Ensure "Fit to Page" is unchecked in printer settings.
              </p>
            </div>
          </aside>

          {/* Main Preview Area */}
          <main className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[700px]">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-700">Page Preview (300 DPI)</h2>
                <div className={`text-xs font-medium flex items-center gap-1 ${
                  status.type === 'error' ? 'text-red-600' : 
                  status.type === 'warning' ? 'text-orange-600' : 
                  status.type === 'success' ? 'text-blue-600' : 'text-slate-400'
                }`}>
                  {status.type === 'success' && <CheckCircle2 className="w-3 h-3" />}
                  {status.type === 'error' && <AlertCircle className="w-3 h-3" />}
                  {status.message}
                </div>
              </div>
              <div className="flex-1 p-8 flex justify-center items-start overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]">
                <div className="relative">
                  <canvas 
                    ref={canvasRef}
                    className="shadow-2xl bg-white max-w-full h-auto"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                        <p className="text-sm font-medium text-slate-600">Processing image...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
