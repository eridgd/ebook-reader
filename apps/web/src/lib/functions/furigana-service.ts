/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import * as kuromoji from '@patdx/kuromoji';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';

// Singleton pattern to ensure the tokenizer is built only once.
let tokenizer: Awaited<ReturnType<kuromoji.TokenizerBuilder['build']>> | null = null;
let isInitializing = false;

// Custom loader for browser that uses CDN with uncompressed dictionary files
const browserLoader: kuromoji.LoaderConfig = {
  async loadArrayBuffer(url: string): Promise<ArrayBufferLike> {
    // Strip off .gz from the URL as we're using uncompressed files from CDN
    url = url.replace('.gz', '');
    const cdnUrl = `https://cdn.jsdelivr.net/npm/@aiktb/kuromoji@1.0.2/dict/${url}`;

    console.log('Furigana service: Loading dictionary file:', cdnUrl);

    const res = await fetch(cdnUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}, status: ${res.status}`);
    }
    return res.arrayBuffer();
  }
};

const furiganaService = {
  // Initializes the tokenizer by loading the dictionary.
  async init(): Promise<void> {
    if (tokenizer || isInitializing) {
      console.log('Furigana service: Skipping init (tokenizer exists or initializing)');
      return;
    }
    isInitializing = true;
    console.log('Furigana service: Starting initialization...');

    try {
      console.log('Furigana service: Building tokenizer with @patdx/kuromoji...');

      tokenizer = await new kuromoji.TokenizerBuilder({
        loader: browserLoader
      }).build();

      console.log('Furigana service: ✅ Tokenizer built successfully!');
      isInitializing = false;
    } catch (error) {
      console.error('Furigana service: ❌ Failed to build tokenizer:', error);
      isInitializing = false;
      throw error;
    }
  },

  // Adds furigana to HTML content by processing Japanese text.
  async addFuriganaToHtml(html: string): Promise<string> {
    console.log('Furigana service: addFuriganaToHtml called, HTML length:', html.length);

    // Initialize tokenizer if not already done
    if (!tokenizer) {
      console.log('Furigana service: No tokenizer, initializing...');
      await this.init();
    }

    if (!tokenizer) {
      console.error('Furigana service: Tokenizer still not available after initialization');
      return html;
    }

    try {
      // Parse HTML to extract text content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Process text nodes that contain Japanese characters
      const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const text = node.textContent || '';
          // Check if text contains Japanese characters (Hiragana, Katakana, or Kanji)
          return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      });

      const textNodes: Text[] = [];
      let node;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      // Process each text node
      for (const textNode of textNodes) {
        const originalText = textNode.textContent || '';
        const processedHTML = this.processTextWithFurigana(originalText, tokenizer);

        if (processedHTML !== originalText) {
          // Create a temporary element to hold the processed HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = processedHTML;

          // Replace the text node with the processed content
          const parent = textNode.parentNode;
          if (parent) {
            while (tempDiv.firstChild) {
              parent.insertBefore(tempDiv.firstChild, textNode);
            }
            parent.removeChild(textNode);
          }
        }
      }

      return doc.body.innerHTML;
    } catch (error) {
      console.error('Furigana service: Error processing HTML:', error);
      return html;
    }
  },

  // Processes text and adds furigana markup
  processTextWithFurigana(
    text: string,
    tokenizer: Awaited<ReturnType<kuromoji.TokenizerBuilder['build']>>
  ): string {
    try {
      const tokens = tokenizer.tokenize(text);
      let result = '';

      for (const token of tokens) {
        // Check if token has kanji and reading information
        if (token.reading && token.reading !== '*' && /[一-龯]/.test(token.surface_form)) {
          // Convert katakana reading to hiragana
          const hiragana = token.reading.replace(/[\u30A1-\u30F6]/g, (match: string) => {
            const chr = match.charCodeAt(0) - 0x60;
            return String.fromCharCode(chr);
          });

          // Add ruby markup for furigana
          result += `<ruby>${token.surface_form}<rt>${hiragana}</rt></ruby>`;
        } else {
          // No furigana needed, use original text
          result += token.surface_form;
        }
      }

      return result;
    } catch (error) {
      console.error('Furigana service: Error tokenizing text:', error);
      return text;
    }
  },

  // Checks if HTML content already contains furigana markup
  hasExistingFurigana(html: string): boolean {
    const hasRuby = /<ruby[^>]*>/i.test(html);
    const hasRt = /<rt[^>]*>/i.test(html);

    if (hasRuby || hasRt) {
      // Find the actual ruby/rt tags to see what they contain
      const rubyMatches = html.match(/<ruby[^>]*>.*?<\/ruby>/gis) || [];
      const rtMatches = html.match(/<rt[^>]*>.*?<\/rt>/gis) || [];

      console.log('Furigana service: Found existing furigana markup:', {
        hasRuby,
        hasRt,
        rubyCount: rubyMatches.length,
        rtCount: rtMatches.length,
        sampleRuby: rubyMatches.slice(0, 3),
        sampleRt: rtMatches.slice(0, 3),
        sampleText: html.substring(0, 200) + '...'
      });
    }

    return hasRuby || hasRt;
  },

  // Adds furigana to an existing book by ID
  async addFuriganaToBook(bookId: number): Promise<void> {
    try {
      // Import database dynamically to avoid circular dependencies
      const { database } = await import('$lib/data/store');

      // Get the book data
      const bookData = await database.getData(bookId);
      if (!bookData) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      // Check if furigana already exists
      if (this.hasExistingFurigana(bookData.elementHtml)) {
        const message = `Book "${bookData.title}" already has furigana, skipping`;
        console.log(`Furigana service: ${message}`);
        const error = new Error(message);
        (error as any).isSkip = true; // Mark as skip for UI handling
        throw error;
      }

      console.log(
        `Furigana service: Processing book "${bookData.title}" (${bookData.elementHtml.length} chars)`
      );

      // Process the HTML content
      const processedHtml = await this.addFuriganaToHtml(bookData.elementHtml);

      // Create updated book data
      const updatedBookData = {
        ...bookData,
        elementHtml: processedHtml,
        lastBookModified: Date.now()
      };

      // Remove the ID for upsertData
      const { id: _id, ...dataWithoutId } = updatedBookData;

      // Save the updated book data
      await database.upsertData(dataWithoutId, ReplicationSaveBehavior.Overwrite, false, false);

      console.log(`Furigana service: ✅ Successfully added furigana to "${bookData.title}"`);
    } catch (error) {
      console.error(`Furigana service: ❌ Failed to add furigana to book ${bookId}:`, error);
      throw error;
    }
  }
};

export default furiganaService;
