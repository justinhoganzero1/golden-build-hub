import { useState } from "react";
import { Globe, ArrowLeftRight, Mic, Volume2, Copy } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const languages = ["English", "Spanish", "French", "German", "Chinese", "Japanese", "Arabic", "Hindi"];

const InterpreterPage = () => {
  const [from, setFrom] = useState("English");
  const [to, setTo] = useState("Spanish");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const handleTranslate = () => {
    if (input.trim()) setOutput("Traducción de ejemplo — esta es una demostración del intérprete AI.");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Globe className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Interpreter</h1><p className="text-muted-foreground text-xs">Real-time translation</p></div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <select value={from} onChange={e => setFrom(e.target.value)} className="flex-1 py-2.5 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none">
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => { setFrom(to); setTo(from); }} className="p-2 rounded-lg bg-primary/10"><ArrowLeftRight className="w-4 h-4 text-primary" /></button>
          <select value={to} onChange={e => setTo(e.target.value)} className="flex-1 py-2.5 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none">
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 mb-3">
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type or speak to translate..." rows={4}
            className="w-full bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none resize-none" />
          <div className="flex items-center gap-2 mt-2">
            <button className="p-2 rounded-lg bg-primary/10"><Mic className="w-4 h-4 text-primary" /></button>
            <button onClick={handleTranslate} className="ml-auto px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg">Translate</button>
          </div>
        </div>
        {output && (
          <div className="bg-card border border-primary/30 rounded-xl p-4">
            <p className="text-sm text-foreground mb-3">{output}</p>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg bg-primary/10"><Volume2 className="w-4 h-4 text-primary" /></button>
              <button className="p-2 rounded-lg bg-primary/10"><Copy className="w-4 h-4 text-primary" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterpreterPage;
