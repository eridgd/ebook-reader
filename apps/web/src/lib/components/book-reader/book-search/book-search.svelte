<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { nextChapter$, sectionList$ } from '$lib/components/book-reader/book-toc/book-toc';
  import { SECTION_CHANGE } from '$lib/data/events';

  export let fontColor: string = '#fff';
  export let backgroundColor: string = 'rgba(31, 41, 55, 0.95)';

  const dispatch = createEventDispatcher<{ close: void }>();

  let query = '';
  let caseSensitive = false;
  let results: HTMLElement[] = [];
  let currentIndex = -1;
  let inputEl: HTMLInputElement | null = null;
  export let fullHtml: string | undefined;
  let idPrefix = `ttu-search-${Date.now()}-`;
  let pendingNavDirection: 1 | -1 | 0 = 0;
  let allSections: Element[] = [];
  let totalMatchCount = 0;

  const highlightClass = 'ttu-search-highlight';
  const currentClass = 'ttu-search-current';

  // Reactive variable for counter - updates whenever currentIndex or results changes
  $: globalIndex = getGlobalMatchIndex();

  onMount(() => {
    // Autofocus input when opening
    setTimeout(() => inputEl?.focus(), 0);

    if (fullHtml) {
      const temp = document.createElement('div');
      temp.innerHTML = fullHtml;
      allSections = Array.from(temp.children);
    }

    const onSectionChange = () => {
      if (!query.trim()) return;
      // After navigation, re-highlight in the newly rendered section and jump
      setTimeout(() => {
        highlightAll();
        if (results.length) {
          currentIndex = pendingNavDirection === -1 ? results.length - 1 : 0;
          updateCurrent();
          scrollToCurrent(true);
        }
        pendingNavDirection = 0;
      }, 0);
    };
    document.addEventListener(SECTION_CHANGE, onSectionChange, false);
    cleanupFns.push(() => document.removeEventListener(SECTION_CHANGE, onSectionChange, false));
  });

  onDestroy(() => {
    clearHighlights();
  });

  function getContentRoot(): HTMLElement | null {
    return (
      document.querySelector('.book-content-container') || document.querySelector('.book-content')
    );
  }

  function clearHighlights() {
    const root = getContentRoot();
    if (!root) return;

    const highlighted = root.querySelectorAll(`.${highlightClass}`);
    highlighted.forEach((span) => {
      const parent = span.parentNode as Node | null;
      while (span.firstChild) {
        parent?.insertBefore(span.firstChild, span);
      }
      parent?.removeChild(span);
    });
    results = [];
    currentIndex = -1;
  }

  function buildRegex(text: string) {
    if (!text) return null;
    try {
      return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    } catch (_) {
      return null;
    }
  }

  function countAllMatches(): number {
    const regex = buildRegex(query.trim());
    if (!regex || !allSections.length) return 0;

    let count = 0;
    for (const section of allSections) {
      const text = section.textContent || '';
      regex.lastIndex = 0;
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  function isSkippable(node: Node) {
    const parent = (node as any).parentElement as HTMLElement | null;
    if (!parent) return false;
    if (parent.closest('rt')) return true;
    if (parent.closest('.ttu-illustration-container')) return true;
    const tag = parent.tagName.toLowerCase();
    return tag === 'script' || tag === 'style';
  }

  function highlightAll() {
    clearHighlights();
    const root = getContentRoot();
    const regex = buildRegex(query.trim());
    if (!root || !regex) {
      totalMatchCount = 0;
      return;
    }

    // Count all matches across all sections for accurate total
    totalMatchCount = countAllMatches();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node: Node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isSkippable(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    } as any);

    type MatchEntry = { node: Text; text: string; matches: { start: number; end: number }[] };
    const entries: MatchEntry[] = [];

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const text = textNode.nodeValue || '';
      regex.lastIndex = 0;
      const matches: { start: number; end: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text))) {
        matches.push({ start: m.index, end: m.index + m[0].length });
      }
      if (matches.length) {
        entries.push({ node: textNode, text, matches });
      }
    }

    const spans: HTMLElement[] = [];

    for (let i = 0, { length } = entries; i < length; i += 1) {
      const { node, text, matches } = entries[i];
      let lastIndex = 0;
      const fragments: (Node | string)[] = [];
      for (let j = 0, { length: l } = matches; j < l; j += 1) {
        const { start, end } = matches[j];
        if (start > lastIndex) {
          fragments.push(text.slice(lastIndex, start));
        }
        const span = document.createElement('span');
        span.className = highlightClass;
        span.textContent = text.slice(start, end);
        fragments.push(span);
        spans.push(span);
        lastIndex = end;
      }
      if (lastIndex < text.length) {
        fragments.push(text.slice(lastIndex));
      }
      const frag = document.createDocumentFragment();
      fragments.forEach((part) => {
        if (typeof part === 'string') {
          frag.appendChild(document.createTextNode(part));
        } else {
          frag.appendChild(part);
        }
      });
      node.parentNode?.replaceChild(frag, node);
    }

    // Assign stable ids for cue navigation
    for (let i = 0, { length } = spans; i < length; i += 1) {
      spans[i].id = `${idPrefix}${i}`;
    }
    results = spans;
    if (results.length) {
      currentIndex = 0;
      updateCurrent();
      scrollToCurrent(false);
    }
  }

  function updateCurrent() {
    results.forEach((el, idx) => {
      if (idx === currentIndex) {
        el.classList.add(currentClass);
      } else {
        el.classList.remove(currentClass);
      }
    });
  }

  function scrollToCurrent(smooth = true) {
    if (currentIndex < 0 || currentIndex >= results.length) return;
    const el = results[currentIndex];
    if (el.id) {
      const detail: any = { type: 'cue', selector: `#${el.id}` };
      // Let the reader own scrolling to avoid fighting its layout management
      document.dispatchEvent(new CustomEvent('ttu-action', { detail }));
      return;
    }
    el.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: smooth ? 'smooth' : 'instant'
    });
  }

  function next() {
    if (results.length) {
      const wasLast = currentIndex === results.length - 1;
      currentIndex = (currentIndex + 1) % results.length;
      updateCurrent();
      if (!wasLast) {
        scrollToCurrent();
        return;
      }
    }
    // Try next section if any
    if (navigateToSectionWithMatch(1)) {
      pendingNavDirection = 1;
    }
  }

  function prev() {
    if (results.length) {
      const wasFirst = currentIndex === 0;
      currentIndex = (currentIndex - 1 + results.length) % results.length;
      updateCurrent();
      if (!wasFirst) {
        scrollToCurrent();
        return;
      }
    }
    if (navigateToSectionWithMatch(-1)) {
      pendingNavDirection = -1;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function close() {
    dispatch('close');
  }

  const cleanupFns: (() => void)[] = [];

  function getCurrentSectionId() {
    const container = document.querySelector('.book-content-container');
    return container && container instanceof HTMLElement ? container.id || '' : '';
  }

  function getGlobalMatchIndex(): number {
    if (!allSections.length || results.length === 0 || currentIndex < 0) return 0;

    const currentSectionId = getCurrentSectionId();
    const regex = buildRegex(query.trim());
    if (!regex) return 0;

    let globalIndex = 0;

    // Count matches in sections before the current section
    for (const section of allSections) {
      if (section.id === currentSectionId) {
        break;
      }
      const text = section.textContent || '';
      regex.lastIndex = 0;
      const matches = text.match(regex);
      if (matches) {
        globalIndex += matches.length;
      }
    }

    // Add the current index within this section
    return globalIndex + currentIndex + 1;
  }

  function navigateToSectionWithMatch(direction: 1 | -1) {
    if (!fullHtml || !query.trim() || !allSections.length) return false;
    const currentId = getCurrentSectionId();
    const indexes = allSections.map((el) => el.id || '');
    let idx = Math.max(0, indexes.indexOf(currentId));

    const matcher = buildRegex(query.trim());
    if (!matcher) return false;

    const inRange = (i: number) => i >= 0 && i < allSections.length;
    let step = idx + direction;
    while (inRange(step)) {
      const el = allSections[step];
      const text = el?.textContent || '';
      matcher.lastIndex = 0;
      if (matcher.test(text)) {
        const ref = el.id;
        if (ref) {
          nextChapter$.next(ref);
          return true;
        }
      }
      step += direction;
    }
    return false;
  }
</script>

<div
  class="fixed inset-x-0 top-0 z-[60] flex items-center gap-2 px-3 py-2 writing-horizontal-tb"
  style:color={fontColor}
  style:background-color={backgroundColor}
>
  <input
    bind:this={inputEl}
    class="min-w-0 flex-1 rounded px-2 py-1 outline-none border"
    placeholder="Search in book"
    bind:value={query}
    on:input={highlightAll}
    on:keydown|stopPropagation={onKeydown}
    style="background-color: transparent; border-color: currentColor;"
  />
  <label class="flex items-center gap-1 text-sm">
    <input type="checkbox" bind:checked={caseSensitive} on:change={highlightAll} />
    Match case
  </label>
  <!-- removed Find button: search runs as you type -->
  <button
    class="rounded px-2 py-1 border"
    style="background-color: transparent; border-color: currentColor;"
    on:click={prev}
    title="Previous"
  >
    Prev
  </button>
  <button
    class="rounded px-2 py-1 border"
    style="background-color: transparent; border-color: currentColor;"
    on:click={next}
    title="Next"
  >
    Next
  </button>
  <div class="text-sm opacity-75">
    {totalMatchCount > 0 ? `${globalIndex} / ${totalMatchCount}` : ''}
  </div>
  <button
    class="rounded px-2 py-1 border"
    style="background-color: transparent; border-color: currentColor;"
    on:click={() => {
      query = '';
      clearHighlights();
    }}
    title="Clear"
  >
    Clear
  </button>
  <button
    class="rounded px-2 py-1 border"
    style="background-color: transparent; border-color: currentColor;"
    on:click={close}
    title="Close"
  >
    Close
  </button>
</div>

<style>
  :global(.ttu-search-highlight) {
    background: rgba(250, 204, 21, 0.6);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }
  :global(.ttu-search-current) {
    outline: 2px solid rgba(59, 130, 246, 0.9);
    background: rgba(250, 204, 21, 0.9);
  }
  /* buttons and input use transparent backgrounds with currentColor borders */
</style>
