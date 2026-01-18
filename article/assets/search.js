document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  let searchData = null;
  let resultsContainer = null;

  if (!searchInput) return;

  // Create results container
  resultsContainer = document.createElement('div');
  resultsContainer.id = 'search-results';
  resultsContainer.className = 'search-results';
  searchInput.parentNode.appendChild(resultsContainer);

  const fetchSearchData = async () => {
    if (searchData) return searchData;
    try {
      // Determine root path based on current location
      // If we are in /sub/folder/, we need to know where root is.
      // But typically search.json is at root. 
      // Let's try relative to current page if handled by server or absolute.
      // Since this is static host, we might be at /article/ or /
      // Try fetching from /search.json or ./search.json based on known structure.
      // The template sets $root$ usually. But here in pure JS...
      
      // Let's assume search.json is at the site root.
      // We can try to guess root from current script src if needed, but '/search.json' or 'search.json' is simplest.
      // If deployed at mchwang233.github.io/blog/, root is /blog/.
      // We can check document base URI or just try relative logic.
      
      // A safe bet for this project structure (dist output) -> ./search.json for index, ../search.json for articles?
      // Actually, let's look at where this script is included.
      // It's in assets/search.js.
      
      // Better strategy: The HTML template has a variable $root$. 
      // Maybe we can pass the search index URL via data attribute on the script or input.
      // But for now, let's try a robust fetch path.
      
      let path = 'search.json';
        // Check if we are in a subdirectory (naive check)
      if (window.location.pathname.split('/').length > 2 && !window.location.pathname.endsWith('/')) {
         // This logic is flimsy. Let's rely on fetch failing and retrying or just absolute path if we knew domain.
         // Let's assume standard relative paths for typical static generator flat structure or 1-level deep.
         // If we are in "dist/sub/post.html", search.json is "../../search.json".
         // But "dist" is root when deployed.
         // So if we are in "sub/post.html", it is "../search.json".
      }

      // Actually, let's just try fetching from root relative.
      // If we are at root, search.json.
      
      // Let's try to infer from the search input's knowledge? No.
      // Simple fallback: Check if a global CONFIG variable exists, or try multiple paths.
      
      const paths = ['search.json', './search.json', '../search.json', '../../search.json'];
      
      for (const p of paths) {
        try {
            const response = await fetch(p);
            if (response.ok) {
                searchData = await response.json();
                return searchData;
            }
        } catch (e) {
            // ignore
        }
      }
    } catch (error) {
      console.error('Error loading search index:', error);
    }
  };

  const performSearch = (query) => {
    if (!query || !searchData) {
      resultsContainer.style.display = 'none';
      return;
    }
    
    query = query.toLowerCase();
    const results = searchData.filter(post => {
      const title = post.title.toLowerCase();
      const content = (post.content || '').toLowerCase();
      const tags = (post.tags || []).join(' ').toLowerCase();
      
      return title.includes(query) || content.includes(query) || tags.includes(query);
    });
    
    renderResults(results);
  };

  const renderResults = (results) => {
    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-no-results">无搜索结果</div>';
      resultsContainer.style.display = 'block';
      return;
    }
    
    let html = '<ul>';
    results.slice(0, 8).forEach(post => { // Limit to 8 results
      // Fix relative URL if we are in a subfolder
      // This is tricky without knowing current depth.
      // But usually static sites use relative URLs in the JSON that are relative to root.
      // If we are at root, post.url works.
      // If at subfolder, we might need ../post.url.
      
      // Let's assume posts are flat or we navigate to root relative?
      // Actually getting the correct path is important.
      // If post.url is "sub/a.html" and we are at root, it works.
      // If we are at "sub/b.html", clicking "sub/a.html" goes to "sub/sub/a.html" (wrong).
      
      // Solution: make links absolute or handle click.
      // Or simply: The JSON should probably contain root-relative paths like "/sub/a.html"
      // or we accept that simple static sites often run at root.
      
      // Let's try to just use the URL from JSON.
      html += `<li><a href="${post.url}">
        <div class="search-result-title">${post.title}</div>
        <div class="search-result-date">${post.date}</div>
      </a></li>`;
    });
    html += '</ul>';
    
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
  };

  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    
    if (query.length > 0 && !searchData) {
       await fetchSearchData();
    }
    
    performSearch(query);
  });
  
  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target)) {
      resultsContainer.style.display = 'none';
      // Optional: clear input? searchInput.value = '';
    }
  });
  
  // Focus logic
  searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length > 0) {
          resultsContainer.style.display = 'block';
      }
  });

});
