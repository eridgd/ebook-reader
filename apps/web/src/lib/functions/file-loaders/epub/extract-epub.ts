/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { BlobReader, BlobWriter, TextWriter, ZipReader } from '@zip.js/zip.js';
import { isOPFType, type EpubContent, type EpubOPFContent } from './types';

import type { Entry } from '@zip.js/zip.js';
import { XMLParser } from 'fast-xml-parser';
import initZipSettings from '../utils/init-zip-settings';

// Simple browser-compatible path utility
const path = {
  join: (...parts: string[]) => {
    if (parts.length === 0) return '.';

    // Filter out empty parts and '.' parts, except when it's the only part
    const filteredParts = parts.filter((part, _index) => {
      if (part === '.' && parts.length > 1) return false; // Skip '.' when there are other parts
      return part && part.length > 0;
    });

    if (filteredParts.length === 0) return '.';
    if (filteredParts.length === 1) return filteredParts[0];

    return filteredParts
      .map((part, _index) => {
        // For all parts, remove leading and trailing slashes
        return part.replace(/^\/+|\/+$/g, '');
      })
      .filter((part) => part.length > 0) // Remove any empty parts after cleaning
      .join('/');
  },
  dirname: (filePath: string) => {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
  }
};

initZipSettings();

export default async function extractEpub(blob: Blob) {
  const reader = new ZipReader(new BlobReader(blob));
  // get all entries from the zip
  const entries = await reader.getEntries();

  const result: Record<string, string | Blob> = {};
  let contentsDirectory = '';
  let contents!: EpubContent | EpubOPFContent;
  if (entries.length) {
    const fileMap = entries.reduce<Record<string, Entry>>((acc, cur) => {
      acc[cur.filename] = cur;
      return acc;
    }, {});

    const containerXml = await fileMap['META-INF/container.xml'].getData!(new TextWriter());
    const parser = new XMLParser({
      ignoreAttributes: false
    });
    const container = parser.parse(containerXml);
    const rootFiles = container.container.rootfiles.rootfile;
    const rootFile = Array.isArray(rootFiles) ? rootFiles[0] : rootFiles;

    const contentOpfFilename = rootFile['@_full-path'];

    const contentsXml = await fileMap[contentOpfFilename].getData!(new TextWriter());
    result[contentOpfFilename] = contentsXml;

    contentsDirectory = path.dirname(contentOpfFilename);

    contents = parser.parse(contentsXml);

    await Promise.all(
      (isOPFType(contents)
        ? contents['opf:package']['opf:manifest']['opf:item']
        : contents.package.manifest.item
      ).map(async (item) => {
        const fileRelativePath = item['@_href'];
        const fullPath = path.join(contentsDirectory, fileRelativePath);

        const entry = fileMap[fullPath];

        if (!entry) {
          throw new Error(`item ${fileRelativePath} not found`);
        }

        if (entry.getData && !entry.directory) {
          let value: string | Blob;
          const mediaType: string = item['@_media-type'];
          if (mediaType.startsWith('image/')) {
            value = await entry.getData(new BlobWriter(mediaType));
          } else {
            value = await entry.getData(new TextWriter());
          }
          result[fileRelativePath] = value;
        }
      })
    );
  }

  await reader.close();
  return {
    contentsDirectory,
    contents,
    result
  };
}
