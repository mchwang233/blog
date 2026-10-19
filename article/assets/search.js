document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  const searchForm = document.getElementById('search-form') || searchInput.closest('form');
  const searchScope = searchForm || searchInput.parentElement;
  const fullResultsContainer = document.getElementById('full-search-results');
  const queryDisplay = document.getElementById('search-query-display');
  const logo = document.querySelector('a.logo');
  const rootURL = searchInput.dataset.root
    ? new URL(searchInput.dataset.root, document.baseURI)
    : new URL('.', logo ? logo.href : document.baseURI);
  const searchPageURL = new URL('search.html', rootURL);
  const iconSpriteURL = searchInput.dataset.iconsUrl
    ? new URL(searchInput.dataset.iconsUrl, document.baseURI)
    : new URL('assets/icons.svg', rootURL);
  const suggestionLimit = 8;
  const fullResultLimit = 50;
  let searchDataPromise;
  let suggestionVersion = 0;
  let fullSearchVersion = 0;

  const resultsContainer = document.createElement('div');
  resultsContainer.id = 'search-results';
  resultsContainer.className = 'search-results';
  resultsContainer.hidden = true;
  resultsContainer.setAttribute('role', 'dialog');
  resultsContainer.setAttribute('aria-label', '搜索建议');
  searchScope.appendChild(resultsContainer);
  searchInput.setAttribute('role', 'combobox');
  searchInput.setAttribute('aria-haspopup', 'dialog');
  searchInput.setAttribute('aria-autocomplete', 'list');
  searchInput.setAttribute('aria-controls', resultsContainer.id);
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.setAttribute('autocomplete', 'off');

  if (searchForm) {
    searchForm.setAttribute('role', 'search');
    searchForm.action = searchPageURL.href;
    searchForm.method = 'get';
  }

  let resultCount = document.getElementById('search-result-count');
  if (fullResultsContainer && !resultCount) {
    resultCount = document.createElement('p');
    resultCount.id = 'search-result-count';
    resultCount.className = 'search-status';
    fullResultsContainer.before(resultCount);
  }
  if (resultCount) {
    resultCount.setAttribute('role', 'status');
    resultCount.setAttribute('aria-live', 'polite');
  }

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const decodeEntities = (text) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
      if (name[0] !== '#') return named[name.toLowerCase()];
      const hex = name[1].toLowerCase() === 'x';
      const value = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
        ? String.fromCodePoint(value)
        : entity;
    });
  };

  const cleanProse = (text) => decodeEntities(text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(\*\*|__|~~)(?=\S)(.*?\S)\1/g, '$2')
    .replace(/(^|[\s(])([*_])(?=\S)([^*_]*?\S)\2(?=$|[\s.,!?;:)])/g, '$1$3'));

  const cleanInlineContent = (line) => {
    line = line.replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, '');
    let output = '';
    let position = 0;
    while (position < line.length) {
      const opening = line.indexOf('`', position);
      if (opening < 0) return output + cleanProse(line.slice(position));
      const delimiter = line.slice(opening).match(/^`+/)[0];
      let closing = opening + delimiter.length;
      while (closing < line.length) {
        closing = line.indexOf(delimiter, closing);
        if (closing < 0) break;
        if (line[closing - 1] !== '`' && line[closing + delimiter.length] !== '`') break;
        closing += delimiter.length;
      }
      if (closing < 0 || closing >= line.length) return output + cleanProse(line.slice(position));
      output += cleanProse(line.slice(position, opening));
      output += line.slice(opening + delimiter.length, closing);
      position = closing + delimiter.length;
    }
    return output;
  };

  const cleanContent = (content) => {
    let fence = null;
    const lines = String(content || '').split(/\r?\n/).map((line) => {
      const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (delimiter && delimiter[1][0] === fence.character
          && delimiter[1].length >= fence.length && !delimiter[2].trim()) {
          fence = null;
          return '';
        }
        return line;
      }
      if (delimiter) {
        fence = { character: delimiter[1][0], length: delimiter[1].length };
        return '';
      }
      if (/^(?: {4}|\t)/.test(line)) return line;
      return cleanInlineContent(line);
    });
    return lines.join(' ').replace(/\s+/g, ' ').trim();
  };

  // Query text is matched literally; only text nodes and explicit marks enter the DOM.
  const appendHighlighted = (target, text, query) => {
    const needle = query.toLocaleLowerCase();
    if (!needle) {
      target.appendChild(document.createTextNode(text));
      return;
    }
    const haystack = text.toLocaleLowerCase();
    let position = 0;
    let index = haystack.indexOf(needle);
    while (index > -1) {
      target.appendChild(document.createTextNode(text.slice(position, index)));
      target.appendChild(createElement('mark', '', text.slice(index, index + query.length)));
      position = index + query.length;
      index = haystack.indexOf(needle, position);
    }
    target.appendChild(document.createTextNode(text.slice(position)));
  };

  const makeSnippet = (content, query, limit = 220, contextLength = 24) => {
    const index = content.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    const start = index > -1 ? Math.max(0, index - contextLength) : 0;
    const prefix = start > 0 ? '…' : '';
    const end = Math.min(content.length, start + limit - prefix.length - 1);
    return {
      text: `${prefix}${content.slice(start, end)}${end < content.length ? '…' : ''}`,
      matchStart: index < 0 ? -1 : prefix.length + index - start,
      matchLength: index < 0 ? 0 : Math.min(query.length, end - index),
    };
  };

  const appendSnippet = (target, content, query, limit = 220, contextLength = 24) => {
    const snippet = makeSnippet(content, query, limit, contextLength);
    if (snippet.matchStart < 0 || snippet.matchLength === query.length) {
      appendHighlighted(target, snippet.text, query);
      return;
    }
    // Even a query longer than the excerpt has its visible matching text marked.
    const end = snippet.matchStart + snippet.matchLength;
    target.appendChild(document.createTextNode(snippet.text.slice(0, snippet.matchStart)));
    target.appendChild(createElement('mark', '', snippet.text.slice(snippet.matchStart, end)));
    target.appendChild(document.createTextNode(snippet.text.slice(end)));
  };

  const matchContext = (post, query) => {
    const needle = query.toLocaleLowerCase();
    if (post.content.toLocaleLowerCase().includes(needle)) return '';
    const titleMatches = post.title.toLocaleLowerCase().includes(needle);
    const tagsMatch = post.tags.toLocaleLowerCase().includes(needle);
    if (tagsMatch) return `${titleMatches ? '标题、标签' : '标签'}匹配：${post.tags}`;
    return titleMatches ? '标题匹配' : '';
  };

  // The same promise serves autocomplete and the full search page, including errors.
  const fetchSearchData = () => {
    if (!searchDataPromise) {
      searchDataPromise = fetch(new URL('search.json', rootURL), { cache: 'no-cache' })
        .then((response) => {
          if (!response.ok) throw new Error('Search index could not be loaded');
          return response.json();
        })
        .then((posts) => {
          if (!Array.isArray(posts)) throw new Error('Invalid search index');
          return posts.flatMap((post) => {
            if (!post || typeof post.url !== 'string' || !post.url.trim()) return [];
            let url;
            try {
              url = new URL(post.url, rootURL);
            } catch {
              return [];
            }
            if (!['http:', 'https:', 'file:'].includes(url.protocol)) return [];
            const title = String(post.title || '未命名文章');
            const content = cleanContent(post.content);
            const tags = Array.isArray(post.tags) ? post.tags.join(' ') : String(post.tags || '');
            return [{
              title,
              url: url.href,
              date: String(post.date || ''),
              content,
              tags,
              searchable: [title, content, tags].map((text) => text.toLocaleLowerCase()),
            }];
          });
        });
    }
    return searchDataPromise;
  };

  const findResults = (posts, query) => {
    const normalizedQuery = query.toLocaleLowerCase();
    return posts.filter((post) => post.searchable.some((text) => text.includes(normalizedQuery)));
  };

  const closeSuggestions = () => {
    suggestionVersion += 1;
    resultsContainer.hidden = true;
    resultsContainer.setAttribute('aria-busy', 'false');
    searchInput.setAttribute('aria-expanded', 'false');
  };

  const showSuggestions = () => {
    resultsContainer.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  };

  const showSuggestionStatus = (message) => {
    const status = createElement('p', 'search-no-results search-status', message);
    status.setAttribute('role', 'status');
    resultsContainer.replaceChildren(status);
    showSuggestions();
  };

  const renderSuggestions = (results, query) => {
    if (!results.length) {
      showSuggestionStatus('没有找到相关文章，试试其他关键词。');
      return;
    }

    const list = createElement('ul');
    results.slice(0, suggestionLimit).forEach((post) => {
      const item = createElement('li');
      const link = createElement('a');
      link.href = post.url;
      const title = createElement('span', 'search-result-title');
      appendHighlighted(title, post.title, query);
      link.appendChild(title);
      const context = matchContext(post, query);
      if (context) {
        const label = createElement('span', 'search-match-context');
        appendHighlighted(label, context, query);
        link.appendChild(label);
      } else if (post.content) {
        const snippet = createElement('span', 'search-result-snippet');
        appendSnippet(snippet, post.content, query, 100, 10);
        link.appendChild(snippet);
      }
      if (post.date) link.appendChild(createElement('span', 'search-result-date', post.date));
      item.appendChild(link);
      list.appendChild(item);
    });
    resultsContainer.replaceChildren(list);
    showSuggestions();
  };

  const updateSuggestions = async () => {
    const version = ++suggestionVersion;
    const query = searchInput.value.trim();
    if (!query) {
      closeSuggestions();
      resultsContainer.replaceChildren();
      return;
    }

    resultsContainer.setAttribute('aria-busy', 'true');
    showSuggestionStatus('正在搜索…');
    try {
      const posts = await fetchSearchData();
      if (version !== suggestionVersion || !searchScope.contains(document.activeElement)) return;
      resultsContainer.setAttribute('aria-busy', 'false');
      renderSuggestions(findResults(posts, query), query);
    } catch {
      if (version !== suggestionVersion || !searchScope.contains(document.activeElement)) return;
      resultsContainer.setAttribute('aria-busy', 'false');
      showSuggestionStatus('搜索暂时无法加载，请刷新页面后重试。');
    }
  };

  const createCalendarIcon = () => {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(namespace, 'use');
    const calendarURL = new URL(iconSpriteURL);
    calendarURL.hash = 'calendar';
    use.setAttribute('href', calendarURL.href);
    svg.appendChild(use);
    return svg;
  };

  const renderFullResults = (results, query) => {
    const fragment = document.createDocumentFragment();
    results.slice(0, fullResultLimit).forEach((post) => {
      const article = createElement('article', 'post-preview');
      const title = createElement('h2', 'post-preview-title');
      const titleLink = createElement('a');
      titleLink.href = post.url;
      appendHighlighted(titleLink, post.title, query);
      title.appendChild(titleLink);
      article.appendChild(title);

      if (post.date) {
        const metadata = createElement('div', 'post-preview-meta');
        const date = createElement('span');
        date.append(createCalendarIcon(), document.createTextNode(post.date));
        metadata.appendChild(date);
        article.appendChild(metadata);
      }

      const context = matchContext(post, query);
      if (context) {
        const label = createElement('p', 'search-match-context');
        appendHighlighted(label, context, query);
        article.appendChild(label);
      }
      if (post.content) {
        const snippet = createElement('p', 'post-preview-desc');
        appendSnippet(snippet, post.content, query);
        article.appendChild(snippet);
      }
      const footer = createElement('div', 'post-preview-footer');
      const readMore = createElement('a', 'post-preview-more', '阅读全文');
      readMore.href = post.url;
      readMore.setAttribute('aria-label', `阅读全文：${post.title}`);
      footer.appendChild(readMore);
      article.appendChild(footer);
      fragment.appendChild(article);
    });
    fullResultsContainer.replaceChildren(fragment);
  };

  const handleSearchPage = async () => {
    if (!fullResultsContainer) return;
    const version = ++fullSearchVersion;
    const query = (new URLSearchParams(window.location.search).get('q') || '').trim();
    if (queryDisplay) queryDisplay.textContent = query;
    searchInput.value = query;
    fullResultsContainer.replaceChildren();
    fullResultsContainer.setAttribute('aria-busy', 'false');

    if (!query) {
      if (resultCount) resultCount.textContent = '输入关键词，查找感兴趣的文章。';
      return;
    }

    if (resultCount) resultCount.textContent = '正在查找相关文章…';
    fullResultsContainer.setAttribute('aria-busy', 'true');
    try {
      const posts = await fetchSearchData();
      if (version !== fullSearchVersion) return;
      const results = findResults(posts, query);
      fullResultsContainer.setAttribute('aria-busy', 'false');
      if (resultCount) {
        resultCount.textContent = results.length > fullResultLimit
          ? `共找到 ${results.length} 篇文章，显示前 ${fullResultLimit} 篇`
          : `共找到 ${results.length} 篇文章`;
      }
      if (!results.length) {
        fullResultsContainer.appendChild(createElement('p', 'search-no-results', '没有找到相关文章，试试其他关键词。'));
        return;
      }
      renderFullResults(results, query);
    } catch {
      if (version !== fullSearchVersion) return;
      fullResultsContainer.setAttribute('aria-busy', 'false');
      if (resultCount) resultCount.textContent = '搜索暂时无法加载';
      fullResultsContainer.appendChild(createElement('p', 'search-no-results', '无法加载搜索索引，请刷新页面后重试。'));
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) {
      closeSuggestions();
      searchInput.focus();
      return;
    }
    const target = new URL(searchPageURL);
    target.searchParams.set('q', query);
    closeSuggestions();
    if (fullResultsContainer && window.location.pathname === target.pathname) {
      window.history.pushState({}, '', target);
      handleSearchPage();
    } else {
      window.location.assign(target.href);
    }
  };

  searchInput.addEventListener('input', updateSuggestions);
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) updateSuggestions();
  });
  if (searchForm) searchForm.addEventListener('submit', submitSearch);

  searchScope.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      // Focusing first avoids the input's focus handler reopening the suggestions.
      searchInput.focus();
      closeSuggestions();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (resultsContainer.hidden) {
      if (searchInput.value.trim()) {
        event.preventDefault();
        updateSuggestions();
      }
      return;
    }
    const links = [...resultsContainer.querySelectorAll('a')];
    if (!links.length) return;
    event.preventDefault();
    const currentIndex = links.indexOf(document.activeElement);
    const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
    if (currentIndex === -1) {
      links[event.key === 'ArrowDown' ? 0 : links.length - 1].focus();
    } else if (nextIndex < 0 || nextIndex >= links.length) {
      searchInput.focus();
    } else {
      links[nextIndex].focus();
    }
  });

  searchScope.addEventListener('focusout', (event) => {
    if (!searchScope.contains(event.relatedTarget)) closeSuggestions();
  });
  document.addEventListener('click', (event) => {
    if (!searchScope.contains(event.target)) closeSuggestions();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.isContentEditable || activeElement.closest('input, textarea, select, [role="textbox"]'))) return;
    event.preventDefault();
    searchInput.focus();
  });
  window.addEventListener('popstate', () => {
    closeSuggestions();
    handleSearchPage();
  });

  handleSearchPage();
});
