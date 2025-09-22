<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faMagnifyingGlass,
    faCrosshairs,
    faExpand,
    faFlag,
    faList,
    faRotateLeft,
    type IconDefinition
  } from '@fortawesome/free-solid-svg-icons';
  import { readerImageGalleryPictures$ } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    baseHeaderClasses,
    baseIconClasses,
    nTranslateXHeaderFa,
    translateXHeaderFa
  } from '$lib/css-classes';
  import { customReadingPointEnabled$, viewMode$ } from '$lib/data/store';
  import { ViewMode } from '$lib/data/view-mode';
  import { dummyFn, isMobile$, isOnOldUrl } from '$lib/functions/utils';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import type { ManualBookmark } from '$lib/data/store';

  export let hasChapterData: boolean;
  export let hasText: boolean;
  export let autoScrollMultiplier: number;
  export let hasCustomReadingPoint: boolean;
  export let showFullscreenButton: boolean;
  export let isBookmarkScreen: boolean;
  export let hasBookmarkData: boolean;
  export let manualBookmarks: ManualBookmark[] = [];
  export let autoBookmark: BooksDbBookmarkData | undefined;
  export let bookCharCount: number = 0;
  export let lastBookmarkSavedAt: number = 0;

  const dispatch = createEventDispatcher<{
    tocClick: void;
    bookmarkClick: void;
    addManualBookmark: void;
    scrollToBookmarkClick: void;
    jumpClick: void;
    searchClick: void;
    completeBook: void;
    fullscreenClick: void;
    showCustomReadingPoint: void;
    setCustomReadingPoint: void;
    resetCustomReadingPoint: void;
    statisticsClick: void;
    readerImageGalleryClick: void;
    settingsClick: void;
    domainHintClick: void;
    bookManagerClick: void;
    jumpToManualBookmark: string;
    deleteManualBookmark: string;
  }>();

  const customReadingPointMenuItems: {
    label: string;
    action: any;
  }[] = [
    ...(hasCustomReadingPoint ? [{ label: 'Show Point', action: 'showCustomReadingPoint' }] : []),
    { label: 'Set Point', action: 'setCustomReadingPoint' },
    ...(hasCustomReadingPoint ? [{ label: 'Reset Point', action: 'resetCustomReadingPoint' }] : [])
  ];

  let customReadingPointMenuElm: Popover;
  let bookmarkMenuElm: Popover;

  let menuItems: {
    routeId: string;
    label: string;
    icon: IconDefinition;
    title: string;
  }[] = [];

  $: isOldUrl = browser && isOnOldUrl(window);

  $: {
    const items = [];

    if (isOldUrl) {
      items.push(mergeEntries.DOMAIN_HINT);
    } else {
      items.push(mergeEntries.STATISTICS);
    }

    if (hasText) {
      items.push(mergeEntries.JUMP_TO_POSITION);
    }

    if ($readerImageGalleryPictures$.length) {
      items.push(mergeEntries.READER_IMAGE_GALLERY);
    }

    items.push(mergeEntries.SETTINGS, mergeEntries.MANAGE);

    menuItems = items;
  }

  function dispatchCustomReadingPointAction(action: any) {
    dispatch(action);
    customReadingPointMenuElm.toggleOpen();
  }

  function formatBookmarkLabel(exploredCharCount?: number, progress?: number | string) {
    if (bookCharCount && exploredCharCount) {
      const pct = ((exploredCharCount / bookCharCount) * 100).toFixed(2);
      return `${exploredCharCount}/${bookCharCount} (${pct}%)`;
    }
    if (typeof progress === 'number') {
      return `${(progress * 100).toFixed(2)}%`;
    }
    return exploredCharCount ? `${exploredCharCount}` : '';
  }

  let showSavedPulse = false;
  $: if (lastBookmarkSavedAt) {
    showSavedPulse = true;
    setTimeout(() => (showSavedPulse = false), 1200);
  }
</script>

<div class="flex justify-between bg-gray-700 px-4 md:px-8 {baseHeaderClasses}">
  <div class="flex transform-gpu {nTranslateXHeaderFa}">
    {#if hasChapterData}
      <div
        tabindex="0"
        role="button"
        title="Open Table of Contents"
        class={baseIconClasses}
        on:click={() => dispatch('tocClick')}
        on:keyup={dummyFn}
      >
        <Fa icon={faList} />
      </div>
    {/if}
    <div
      tabindex="0"
      role="button"
      title="Search in Book"
      class={baseIconClasses}
      on:click={() => dispatch('searchClick')}
      on:keyup={dummyFn}
    >
      <Fa icon={faMagnifyingGlass} />
    </div>
    <div class="flex">
      <Popover placement="bottom-start" yOffset={0} bind:this={bookmarkMenuElm}>
        <div slot="icon" title="Bookmarks" class={baseIconClasses}>
          <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} />
        </div>
        <div class="w-64 bg-gray-700 max-h-80 overflow-auto" slot="content">
          <div class="flex items-center justify-between px-3 py-2 border-b border-gray-500">
            <div class="text-sm flex items-center gap-2">
              <span>Bookmarks</span>
              {#if showSavedPulse}
                <span class="text-green-300 text-xs animate-pulse">Saved</span>
              {/if}
            </div>
            <button
              class="px-2 py-1 text-xs border border-white"
              on:click={() => {
                dispatch('addManualBookmark');
              }}
            >
              Add
            </button>
          </div>
          {#if autoBookmark}
            <div class="px-3 py-2 text-xs flex items-center justify-between bg-gray-600">
              <span
                >Auto • {formatBookmarkLabel(
                  autoBookmark.exploredCharCount,
                  autoBookmark.progress
                )}</span
              >
              <button
                class="px-1 border border-white"
                on:click={() => {
                  dispatch('scrollToBookmarkClick');
                  bookmarkMenuElm.toggleOpen();
                }}>Go</button
              >
            </div>
          {/if}
          {#if manualBookmarks.length}
            {#each manualBookmarks as bm (bm.id)}
              <div
                class="px-3 py-2 text-xs flex items-center justify-between hover:bg-white hover:text-gray-700"
              >
                <button
                  class="text-left truncate"
                  title={formatBookmarkLabel(
                    bm.exploredCharCount,
                    typeof bm.progress === 'number' ? bm.progress : undefined
                  )}
                  on:click={() => {
                    dispatch('jumpToManualBookmark', bm.id);
                    bookmarkMenuElm.toggleOpen();
                  }}
                  >{formatBookmarkLabel(
                    bm.exploredCharCount,
                    typeof bm.progress === 'number' ? bm.progress : undefined
                  )}</button
                >
                <button
                  class="ml-2 px-1 border border-white"
                  title="Delete"
                  on:click={() => dispatch('deleteManualBookmark', bm.id)}>×</button
                >
              </div>
            {/each}
          {:else}
            <div class="px-3 py-4 text-xs text-gray-300">No manual bookmarks yet.</div>
          {/if}
        </div>
      </Popover>
    </div>
    {#if hasBookmarkData}
      <div
        tabindex="0"
        role="button"
        title="Return to Bookmark"
        class={baseIconClasses}
        on:click={() => dispatch('scrollToBookmarkClick')}
        on:keyup={dummyFn}
      >
        <Fa icon={faRotateLeft} />
      </div>
    {/if}
    {#if $viewMode$ === ViewMode.Continuous && !$isMobile$}
      <div
        class="flex items-center px-4 text-xl xl:px-3 xl:text-lg"
        title="Current Autoscroll Speed"
      >
        {autoScrollMultiplier}x
      </div>
    {/if}
  </div>

  <div class="flex transform-gpu {translateXHeaderFa}">
    <div
      tabindex="0"
      role="button"
      title="Complete Book"
      class={baseIconClasses}
      on:click={() => dispatch('completeBook')}
      on:keyup={dummyFn}
    >
      <Fa icon={faFlag} />
    </div>
    {#if $customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated}
      <div class="flex">
        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={0}
          bind:this={customReadingPointMenuElm}
        >
          <div slot="icon" title="Open Custom Point Actions" class={baseIconClasses}>
            <Fa icon={faCrosshairs} />
          </div>
          <div class="w-40 bg-gray-700 md:w-32" slot="content">
            {#each customReadingPointMenuItems as actionItem (actionItem.label)}
              <div
                tabindex="0"
                role="button"
                class="px-4 py-2 text-sm hover:bg-white hover:text-gray-700"
                on:click={() => dispatchCustomReadingPointAction(actionItem.action)}
                on:keyup={dummyFn}
              >
                {actionItem.label}
              </div>
            {/each}
          </div>
        </Popover>
      </div>
    {/if}
    {#if showFullscreenButton}
      <div
        tabindex="0"
        role="button"
        title="Toggle Fullscreen"
        class={baseIconClasses}
        on:click={() => dispatch('fullscreenClick')}
        on:keyup={dummyFn}
      >
        <Fa icon={faExpand} />
      </div>
    {/if}
    <MergedHeaderIcon
      disableRouteNavigation
      items={menuItems}
      on:action={({ detail }) => {
        if (detail === mergeEntries.STATISTICS.label) {
          dispatch('statisticsClick');
        } else if (detail === mergeEntries.JUMP_TO_POSITION.label) {
          dispatch('jumpClick');
        } else if (detail === mergeEntries.READER_IMAGE_GALLERY.label) {
          dispatch('readerImageGalleryClick');
        } else if (detail === mergeEntries.SETTINGS.label) {
          dispatch('settingsClick');
        } else if (detail === mergeEntries.DOMAIN_HINT.label) {
          dispatch('domainHintClick');
        } else if (detail === mergeEntries.MANAGE.label) {
          dispatch('bookManagerClick');
        }
      }}
    />
  </div>
</div>
