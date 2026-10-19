(() => {
  const initialize = () => {
    const article = document.querySelector('.article-main .post');
    const content = article && article.querySelector('.post-content');
    const sidebar = document.querySelector('.article-sidebar .sidebar-box');
    const widget = document.getElementById('article-toc-widget');
    if (!article || !content || !sidebar || !widget) return;

    const recent = document.getElementById('article-recent-widget');
    const mobile = window.matchMedia('(max-width: 800px)');
    let nav = widget.querySelector('.article-toc');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'article-toc';
      nav.setAttribute('aria-label', '文章目录');
      widget.appendChild(nav);
    }

    const details = document.createElement('details');
    details.className = 'toc-details';
    const summary = document.createElement('summary');
    summary.className = 'toc-summary';
    summary.textContent = '文章目录';
    details.append(summary, nav);
    widget.appendChild(details);

    let sections = [];
    let activeLink = null;
    let frame = 0;
    let previousMobile = null;
    let mobileOpen = false;

    const isArticleHeading = (heading) => heading
      && /^H[1-6]$/.test(heading.tagName)
      && content.contains(heading)
      && !heading.closest('#password-form, .password-lock');

    const setActive = (link) => {
      if (activeLink === link) return;
      if (activeLink) {
        activeLink.classList.remove('is-active');
        activeLink.removeAttribute('aria-current');
      }
      activeLink = link;
      if (activeLink) {
        activeLink.classList.add('is-active');
        activeLink.setAttribute('aria-current', 'location');
      }
    };

    const updateActive = () => {
      frame = 0;
      if (widget.hidden || !sections.length) return;
      const threshold = Math.min(120, window.innerHeight * 0.2);
      let current = sections[0];
      for (const section of sections) {
        if (section.heading.getBoundingClientRect().top > threshold) break;
        current = section;
      }
      const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight
        >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = sections[sections.length - 1];
      setActive(current.link);
    };

    const scheduleActive = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActive);
    };

    const positionWidget = () => {
      const focused = widget.contains(document.activeElement) ? document.activeElement : null;
      const isMobile = mobile.matches && !widget.hidden;
      let moved = false;
      if (isMobile) {
        const header = article.querySelector('.article-header');
        const next = header ? header.nextElementSibling : content;
        if (widget.parentElement !== article || next !== widget) {
          content.before(widget);
          moved = true;
        }
      } else if (widget.parentElement !== sidebar || sidebar.firstElementChild !== widget) {
        sidebar.prepend(widget);
        moved = true;
      }

      if (isMobile !== previousMobile) {
        if (previousMobile) mobileOpen = details.open;
        details.open = !isMobile || mobileOpen || Boolean(focused && nav.contains(focused));
        previousMobile = isMobile;
      }
      if (focused && moved) {
        const target = !isMobile && focused === summary ? nav.querySelector('a') : focused;
        if (target && target !== document.activeElement) target.focus({ preventScroll: true });
      }
      scheduleActive();
    };

    const activateSections = (nextSections) => {
      setActive(null);
      sections = nextSections;
      const enabled = sections.length >= 3;
      widget.hidden = !enabled;
      if (recent) recent.hidden = enabled;
      positionWidget();
    };

    const readExistingSections = () => {
      const seen = new Set();
      return [...nav.querySelectorAll('a[href^="#"]')].flatMap((link) => {
        let id;
        try {
          id = decodeURIComponent(link.getAttribute('href').slice(1));
        } catch {
          return [];
        }
        const heading = document.getElementById(id);
        if (!isArticleHeading(heading) || seen.has(heading)) return [];
        seen.add(heading);
        return [{ heading, link }];
      });
    };

    const populateUnlockedSections = () => {
      const headings = [...content.querySelectorAll('h1, h2, h3, h4, h5, h6')]
        .filter(isArticleHeading);
      if (headings.length < 3) {
        activateSections([]);
        return;
      }

      const list = document.createElement('ol');
      const stack = [];
      const nextSections = [];
      headings.forEach((heading, index) => {
        if (!heading.id || document.getElementById(heading.id) !== heading) {
          const baseId = `article-section-${index + 1}`;
          let id = baseId;
          let suffix = 2;
          while (document.getElementById(id)) id = `${baseId}-${suffix++}`;
          heading.id = id;
        }
        const level = Number(heading.tagName[1]);
        while (stack.length && level <= stack[stack.length - 1].level) stack.pop();
        let parentList = list;
        if (stack.length) {
          const parentItem = stack[stack.length - 1].item;
          parentList = parentItem.lastElementChild;
          if (!parentList || parentList.tagName !== 'OL') {
            parentList = document.createElement('ol');
            parentItem.appendChild(parentList);
          }
        }
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.setAttribute('href', `#${encodeURIComponent(heading.id)}`);
        link.textContent = heading.textContent.trim();
        item.appendChild(link);
        parentList.appendChild(item);
        stack.push({ level, item });
        nextSections.push({ heading, link });
      });
      nav.replaceChildren(list);
      activateSections(nextSections);
    };

    details.addEventListener('toggle', () => {
      if (mobile.matches && !widget.hidden) mobileOpen = details.open;
    });
    nav.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link && nav.contains(link)) setActive(link);
    });
    window.addEventListener('scroll', scheduleActive, { passive: true });
    window.addEventListener('hashchange', scheduleActive);
    // Some embedded browsers do not deliver the media-query change reliably.
    // A resize also reconciles placement; unchanged layouts keep focus untouched.
    window.addEventListener('resize', positionWidget, { passive: true });
    if (mobile.addEventListener) mobile.addEventListener('change', positionWidget);
    else mobile.addListener(positionWidget);
    document.addEventListener('article:unlocked', populateUnlockedSections);
    activateSections(readExistingSections());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
