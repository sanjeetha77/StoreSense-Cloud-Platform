"""
Deep Product Analysis Utility.

Identifies products that require deeper inspection based on missing
or generic information. Evaluates severity based on the type of issues.
"""

from typing import List, Dict

def get_products_for_deep_analysis(products: List[Dict]) -> List[Dict]:
    """
    Selects products needing deeper inspection and assigns a severity score.

    Criteria:
      - missing description
      - missing images
      - missing tags
      - generic title ("sample", "draft", "test", "example", or extremely short)

    Severity is determined by the combination and importance of issues.
    """
    deep_analysis = []

    for p in products:
        issues = []
        
        # Check description
        body_html = p.get("body_html", "") or ""
        if len(body_html.strip()) < 10:
            issues.append("missing_description")
            
        # Check images
        images = p.get("images", [])
        if not images:
            issues.append("missing_images")
            
        # Check tags (normalize list or string)
        tags = p.get("tags", [])
        tags_str = ""
        if isinstance(tags, list):
            tags_str = " ".join(tags).strip()
        elif isinstance(tags, str):
            tags_str = tags.strip()
        if not tags_str:
            issues.append("missing_tags")
            
        # Check generic title
        title = (p.get("title", "") or "").lower().strip()
        is_generic = any(word in title for word in ["sample", "test", "draft", "example"])
        if is_generic or len(title) < 5:
            issues.append("generic_title")
            
        if issues:
            # Calculate severity score
            if "missing_description" in issues and "missing_images" in issues:
                severity = "high"
            elif "missing_description" in issues or "missing_images" in issues:
                severity = "medium"
            else:
                severity = "low"
                
            deep_analysis.append({
                "product_id": str(p.get("id", "")),
                "title": p.get("title", "Unknown Title"),
                "issues": issues,
                "severity_score": severity,
            })
            
    # Sort by severity (high -> medium -> low)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    deep_analysis.sort(key=lambda x: severity_order.get(x["severity_score"], 3))
    
    return deep_analysis
