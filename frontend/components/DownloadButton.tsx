import { Download } from 'lucide-react';
import { useState } from 'react';

export function DownloadButton() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const result = sessionStorage.getItem('analysisResult');
    if (!result) {
      alert("No analysis data found to export.");
      setDownloading(false);
      return;
    }

    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(result);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", "store_analysis_report.json");
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setDownloading(false), 500);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {downloading ? 'Exporting...' : 'Download Report'}
    </button>
  );
}
