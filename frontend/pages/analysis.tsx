import Head from 'next/head';
import { useState, useEffect } from 'react';
import { Search, ChevronRight, Package, AlertTriangle, CheckCircle2, Filter, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

export default function Analysis() {
  const [products, setProducts] = useState<any[]>([]);
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [storeUrl, setStoreUrl] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('analysis_result');
    const url = localStorage.getItem('storeUrl') || '';
    setStoreUrl(url);

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const rawProducts = parsed.products || [];
      const rawIssues   = parsed.issues   || [];

      // Store raw issues for detail panel lookups
      setAllIssues(rawIssues);

      if (rawProducts.length > 0) {
        // Map backend products to the UI structure.
        // Per-product issue count: count how many grouped issues have this product
        // in their affected_items list.
        const mappedProducts = rawProducts.map((p: any) => {
          const productIssueCount = rawIssues.filter((issue: any) =>
            Array.isArray(issue.affected_items) &&
            issue.affected_items.some((ai: any) => ai.product_id === p.id)
          ).length;

          // Derive a per-product score heuristic: start at 100, -12 per issue type affected
          const rawScore = Math.max(0, 100 - productIssueCount * 12);

          return {
            id: p.id,
            name: p.title || 'Unknown Product',
            score: rawScore,
            issueCount: productIssueCount,
            status: productIssueCount === 0 ? 'good' : productIssueCount >= 3 ? 'critical' : 'warning',
          };
        });
        setProducts(mappedProducts);
      }
    } catch (e) {}
  }, []);

  // Issues that affect the selected product
  const selectedProductIssues = selectedProduct
    ? allIssues.filter((issue: any) =>
        Array.isArray(issue.affected_items) &&
        issue.affected_items.some((ai: any) => ai.product_id === selectedProduct.id)
      )
    : [];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = showOnlyIssues ? p.issueCount > 0 : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <Head>
        <title>Analysis | AI Store Optimizer</title>
      </Head>

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Analysis</h1>
          <p className="text-gray-500 text-sm">Deep dive into individual product performance and AI perception.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64 shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowOnlyIssues(!showOnlyIssues)}
            className={clsx(
              "flex items-center gap-2 border px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm",
              showOnlyIssues 
                ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                : "bg-white border-slate-200 text-gray-600 hover:bg-slate-50"
            )}
          >
            <Filter className="w-4 h-4" />
            {showOnlyIssues ? 'Showing Issues' : 'Filter Issues Only'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-200px)]">
        {/* Table View */}
        <div className={clsx("bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col overflow-hidden transition-all duration-300", selectedProduct ? "lg:w-2/3" : "w-full")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">AI Score</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Issues</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-400">
                      No products found. Run an analysis from the home page first.
                    </td>
                  </tr>
                ) : filteredProducts.length > 0 ? filteredProducts.map(product => (
                  <tr 
                    key={product.id} 
                    onClick={() => setSelectedProduct(product)}
                    className={clsx(
                      "group cursor-pointer transition-colors",
                      selectedProduct?.id === product.id ? "bg-indigo-50/50" : "hover:bg-slate-50"
                    )}
                  >
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{product.name}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className={clsx(
                          "font-mono font-bold w-6",
                          product.score >= 80 ? "text-emerald-600" : product.score >= 55 ? "text-amber-600" : "text-rose-600"
                        )}>{product.score}</span>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={clsx(
                            "h-full rounded-full",
                            product.score >= 80 ? "bg-emerald-500" : product.score >= 55 ? "bg-amber-400" : "bg-rose-400"
                          )} style={{ width: `${product.score}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {product.issueCount === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" /> None
                        </span>
                      ) : (
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border",
                          product.issueCount >= 3 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-amber-700 bg-amber-50 border-amber-200"
                        )}>
                          <AlertTriangle className="w-3.5 h-3.5" /> {product.issueCount} Issues
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <ChevronRight className={clsx("w-5 h-5 transition-colors", selectedProduct?.id === product.id ? "text-indigo-500" : "text-gray-400 group-hover:text-indigo-500")} />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-500">
                      No products found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel — real issues from backend */}
        {selectedProduct && (
          <div className="lg:w-1/3 bg-white shadow-sm border border-slate-200 rounded-2xl p-6 flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-gray-900 font-bold leading-tight">{selectedProduct.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">ID: {selectedProduct.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-900 bg-slate-50 hover:bg-slate-100 rounded-md p-1 transition-colors">
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">AI Score</p>
                <p className={clsx(
                  "text-2xl font-black font-mono",
                  selectedProduct.score >= 80 ? "text-emerald-600" : selectedProduct.score >= 55 ? "text-amber-600" : "text-rose-600"
                )}>{selectedProduct.score}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Issues</p>
                <p className={clsx(
                  "text-2xl font-black font-mono",
                  selectedProduct.issueCount === 0 ? "text-emerald-600" : selectedProduct.issueCount >= 3 ? "text-rose-600" : "text-amber-600"
                )}>{selectedProduct.issueCount}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Detected Issues</h4>
              
              {selectedProductIssues.length > 0 ? (
                <div className="space-y-3">
                  {selectedProductIssues.map((issue: any) => (
                    <div key={issue.id} className={clsx(
                      "bg-white border shadow-sm rounded-lg p-4",
                      issue.impact === 'high' ? "border-rose-200" : issue.impact === 'medium' ? "border-amber-200" : "border-yellow-200"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className={clsx(
                          "w-4 h-4 flex-shrink-0",
                          issue.impact === 'high' ? "text-rose-500" : "text-amber-500"
                        )} />
                        <span className="text-sm font-bold text-gray-900">{issue.title}</span>
                      </div>
                      {issue.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">{issue.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center mt-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm text-emerald-700 font-medium">This product meets all AI representation standards.</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => {
                const url = storeUrl || 'myshopify.com';
                window.open(`https://${url}/admin/products/${selectedProduct.id}`, "_blank");
              }}
              className="mt-6 w-full bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-700 py-2.5 rounded-lg text-sm font-bold transition-colors border border-slate-200 shadow-sm flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> View in Shopify Admin
            </button>
          </div>
        )}
      </div>
    </>
  );
}
