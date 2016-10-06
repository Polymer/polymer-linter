/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

'use strict';

import * as parse5 from 'parse5';
import * as analyzerModel from 'polymer-analyzer/lib/model/model';

// TODO(usergenic): Patch polymer-analyzer
// ParsedHtmlDocument._sourceRangeForNode to properly represent source ranges
// for multi-line text nodes so we don't need this function.
export function getSourceRangeForTextNode(
    file: string, textNode: parse5.ASTNode): analyzerModel.SourceRange|
    undefined {
  if (typeof textNode.value !== 'string' ||
      !isLocationInfo(textNode.__location)) {
    return;
  }

  const lines = textNode.value.split(/\n/);
  const lastLine = lines[lines.length - 1];
  const location: parse5.LocationInfo = textNode.__location;
  const endColumn =
      lines.length === 1 ? lastLine.length + location.col : lastLine.length + 1;
  const endLine = location.line + lines.length - 1;

  // SourceRange is 0 indexed but parse5 returns 1 indexed numbers.
  return {
    end: {column: endColumn - 1, line: endLine - 1},
    file: file,
    start: {column: location.col - 1, line: location.line - 1}
  };
}

export function isLocationInfo(location: any): location is parse5.LocationInfo {
  return typeof location.line === 'number' &&
      typeof location.col === 'number' &&
      typeof location.startOffset === 'number' &&
      typeof location.endOffset === 'number';
}
