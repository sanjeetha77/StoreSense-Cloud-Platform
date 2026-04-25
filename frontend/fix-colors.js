const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let c = fs.readFileSync(fullPath, 'utf8');
      
      // Backgrounds
      c = c.replace(/bg-\[\#13131A\]/g, 'bg-slate-50');
      c = c.replace(/bg-\[\#1C1C24\]/g, 'bg-white');
      c = c.replace(/bg-\[\#070b14\]/g, 'bg-slate-50');
      c = c.replace(/bg-\[\#0f1117\](\/80)?/g, 'bg-white$1');
      c = c.replace(/bg-\[\#151821\]/g, 'bg-white');
      c = c.replace(/bg-\[\#1e2230\]/g, 'bg-slate-100');
      
      // Borders
      c = c.replace(/border-\[\#292932\](\/50)?/g, 'border-slate-200');
      c = c.replace(/border-\[\#262a36\]/g, 'border-slate-200');
      
      // Hover/Muted
      c = c.replace(/bg-\[\#292932\]/g, 'bg-slate-100');
      c = c.replace(/hover:bg-\[\#1e2230\]/g, 'hover:bg-slate-100');
      c = c.replace(/hover:bg-\[\#1C1C24\]/g, 'hover:bg-slate-50');
      
      // Texts
      c = c.replace(/text-white/g, 'text-gray-900');
      c = c.replace(/text-slate-200/g, 'text-gray-800');
      c = c.replace(/text-slate-300/g, 'text-gray-700');
      c = c.replace(/text-slate-400/g, 'text-gray-500');
      c = c.replace(/text-slate-500/g, 'text-gray-400');
      c = c.replace(/text-slate-600/g, 'text-gray-400');
      
      // Accents
      c = c.replace(/blue-600/g, 'indigo-600');
      c = c.replace(/blue-500/g, 'indigo-600');
      c = c.replace(/blue-700/g, 'indigo-700');
      c = c.replace(/indigo-500/g, 'indigo-600');
      c = c.replace(/indigo-400/g, 'indigo-600');
      
      // Fix text colors on primary buttons
      c = c.replace(/bg-indigo-600([^"']*)text-gray-900/g, 'bg-indigo-600$1text-white');
      c = c.replace(/text-gray-900([^"']*)bg-indigo-600/g, 'text-white$1bg-indigo-600');
      
      fs.writeFileSync(fullPath, c);
    }
  }
}

processDir('./pages');
processDir('./components');
console.log('Conversion complete');
