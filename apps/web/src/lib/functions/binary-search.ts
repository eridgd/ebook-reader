/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

function binarySearchImpl(notFoundValue: -1 | undefined) {
  const binarySearchRecursive = (arr: number[], l: number, r: number, x: number): number => {
    if (r < l) return notFoundValue ?? r;

    const mid = Math.floor((l + r) / 2);
    if (arr[mid] === x) return mid;
    if (arr[mid] > x) return binarySearchRecursive(arr, l, mid - 1, x);
    return binarySearchRecursive(arr, mid + 1, r, x);
  };

  return (arr: number[], x: number) => binarySearchRecursive(arr, 0, arr.length - 1, x);
}

function binarySearchNodeInRangeImpl() {
  const binarySearchRecursive = (arr: Node[], l: number, r: number, x: Range): number => {
    if (r < l) return -1;

    const mid = Math.floor((l + r) / 2);
    const node = arr[mid];

    // Skip detached nodes (can happen when search highlights are added)
    if (!node.parentNode) {
      // Try searching in the left half first
      const leftResult = binarySearchRecursive(arr, l, mid - 1, x);
      if (leftResult !== -1) return leftResult;
      // Then try the right half
      return binarySearchRecursive(arr, mid + 1, r, x);
    }

    try {
      if (x.intersectsNode(node)) {
        return mid;
      }

      if (x.comparePoint(node, 0) > 0) {
        return binarySearchRecursive(arr, l, mid - 1, x);
      }
      return binarySearchRecursive(arr, mid + 1, r, x);
    } catch {
      // Node is not in the same tree as the range (detached)
      // Try searching in both halves
      const leftResult = binarySearchRecursive(arr, l, mid - 1, x);
      if (leftResult !== -1) return leftResult;
      return binarySearchRecursive(arr, mid + 1, r, x);
    }
  };

  return (arr: Node[], x: Range) => binarySearchRecursive(arr, 0, arr.length - 1, x);
}

export const binarySearchNodeInRange = binarySearchNodeInRangeImpl();
export const binarySearch = binarySearchImpl(-1);
export const binarySearchNoNegative = binarySearchImpl(undefined);
