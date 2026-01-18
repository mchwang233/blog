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

  // Handle Enter key for full search page
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      const query = searchInput.value.trim();
      if (query) {
        // Redirect to search.html
        // We need to resolve the path relative to root.
        // Similar to fetch logic, let's try robust redirection.
        // Assuming search.html is at root (dist/search.html).
        
        let target = 'search.html';
        const depth = window.location.pathname.split('/').length;
        if (depth > 2 && !window.location.pathname.endsWith('/')) {
             // If we are in 'dist/sub/post.html', we need '../search.html' ?
             // Or better, use absolute path if we knew base.
             // Let's use relative path finding.
             // Or rely on <base> tag if it existed.
             
             // Simplest: Check if we are at root level.
             // But simpler: just use relative path logic shared with fetch.
             // If fetch worked with 'search.json', 'search.html' is likely sibling.
             // If fetch worked with '../search.json', '../search.html'.
        }
        
        // Let's try to just go to /search.html relative to current page base
        // But since we generate search.html at root, we need to go up.
        
        // Hack: Use the same relative path logic as the logo
        // The logo href is '/', or specific.
        // In article template: $root$/index.html.
        
        // We can check if window.location contains 'search.html'
        if (window.location.pathname.endsWith('search.html')) {
             // Update query param without reload
             const url = new URL(window.location);
             url.searchParams.set('q', query);
             window.history.pushState({}, '', url);
             handleSearchPage(); // Manually trigger search
             resultsContainer.style.display = 'none';
        } else {
             // Navigate
             // Try to construct path relative to current
             // or just absolute path if on server.
             // Let's assume we can navigate to 'search.html' relative to 'index.html'.
             
             // If we are in '/a/b.html', we want '/search.html'.
             
             // Let's just set window.location.href to a relative path that we HOPE resolves to root search.html
             // This is hard without explicit root config.
             // But we can try: 
             // If document.querySelector('a.logo') href exists?
             const logo = document.querySelector('a.logo');
             if (logo) {
                 const rootUrl = logo.getAttribute('href');
                 // rootUrl might be '/' or '../index.html' or similar.
                 // We want search.html at the same level as index.html
                 let searchUrl = rootUrl.replace('index.html', 'search.html');
                 if (searchUrl.endsWith('/')) searchUrl += 'search.html';
                 // Clean up double slashes
                 
                 // If rootUrl is just '/', then '/search.html'
                 if (rootUrl === '/') searchUrl = '/search.html';
                 else if (rootUrl === '.') searchUrl = 'search.html';
                 
                 window.location.href = searchUrl + '?q=' + encodeURIComponent(query);
                 return;
             }
             
             window.location.href = 'search.html?q=' + encodeURIComponent(query);
        }
      }
    }
  });

  // --- Full Search Page Logic ---
  const handleSearchPage = async () => {
    const fullResultsContainer = document.getElementById('full-search-results');
    const queryDisplay = document.getElementById('search-query-display');
    
    if (!fullResultsContainer) return;
    
    // Parse query param
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q') || '';
    
    if (queryDisplay) queryDisplay.textContent = query;
    if (searchInput) searchInput.value = query; // Sync input
    
    if (!query) {
       fullResultsContainer.innerHTML = '<p>请输入搜索关键词。</p>';
       return;
    }
    
    await fetchSearchData();
    
    if (!searchData) {
        fullResultsContainer.innerHTML = '<p>无法加载搜索索引。</p>';
        return;
    }
    
    const q = query.toLowerCase();
    const results = searchData.filter(post => {
      const title = post.title.toLowerCase();
      const content = (post.content || '').toLowerCase();
      const tags = (post.tags || []).join(' ').toLowerCase();
      return title.includes(q) || content.includes(q) || tags.includes(q);
    });
    
    if (results.length === 0) {
        fullResultsContainer.innerHTML = '<p>没有找到相关文章。</p>';
        return;
    }
    
    // Render full results
    let html = '';
    results.forEach(post => {
        // Highlight snippet
        let snippet = post.content.substring(0, 300);
        // Maybe find where the query is and show context?
        const idx = post.content.toLowerCase().indexOf(q);
        if (idx > -1) {
            const start = Math.max(0, idx - 100);
            const end = Math.min(post.content.length, idx + 200);
            snippet = (start > 0 ? '...' : '') + post.content.substring(start, end) + (end < post.content.length ? '...' : '');
        }
        
        // Highlight logic could be added here
        
        html += `
        <div class="post-preview">
          <h2 class="post-preview-title"><a href="${post.url}">${post.title}</a></h2>
          <div class="post-preview-meta">${post.date}</div>
          <div class="post-preview-desc">${snippet}</div>
        </div>`;
    });
    
    fullResultsContainer.innerHTML = html;
  };

  // Check if we are on search page
  if (document.getElementById('full-search-results')) {
      handleSearchPage();
  }

});
