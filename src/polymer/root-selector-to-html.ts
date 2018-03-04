/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import * as dom5 from 'dom5';
import {Document, ParsedCssDocument, Severity, Warning} from 'polymer-analyzer';
import * as shady from 'shady-css-parser';

import {registry} from '../registry';
import {Rule} from '../rule';
import {getDocumentContaining, stripIndentation, stripWhitespace} from '../util';

const p = dom5.predicates;
const isCustomStyle = p.AND(
    p.hasTagName('style'),
    p.OR(
        p.hasAttrValue('is', 'custom-style'),
        (node: dom5.Node) => !!(
            node.parentNode && p.hasTagName('custom-style')(node.parentNode))));
const isElementStyle = p.AND(
    p.hasTagName('style'),
    (node: dom5.Node) => !!(
        node.parentNode && node.parentNode.nodeName === '#document-fragment'));

class RootSelectorToHtml extends Rule {
  code = 'root-selector-to-html';
  description = stripIndentation(`
      Warns when using :root inside an element's template or custom-style
  `);

  async check(document: Document) {
    return [
      ...this.generateWarnings(
          document, isCustomStyle, 'html'),  // Check custom styles
      ...this.generateWarnings(
          document, isElementStyle, ':host > *'),  // Check element styles
    ];
  }

  private generateWarnings(
      document: Document, predicate: dom5.Predicate, replacementText: string) {
    const warnings: Warning[] = [];

    const styleTags = dom5.queryAll(
        document.parsedDocument.ast,
        predicate,
        [],
        dom5.childNodesIncludeTemplate);
    if (styleTags.length === 0) {
      return warnings;
    }

    for (const style of styleTags) {
      const sourceRange =
          document.parsedDocument.sourceRangeForNode(style.childNodes[0]);
      if (sourceRange === undefined) {
        continue;
      }
      const containingDoc =
          getDocumentContaining(sourceRange, document) as ParsedCssDocument;
      if (containingDoc === undefined) {
        continue;
      }

      for (const node of containingDoc) {
        if (node.type !== shady.nodeType.ruleset) {
          continue;
        }

        const deprecatedRegex = /:root/;
        const match = node.selector.match(deprecatedRegex);
        if (match === null) {
          continue;
        }

        const start = node.range.start + match.index!;
        const sourceRange = containingDoc.sourceRangeForShadyRange(
            {start, end: start + match[0].length});

        warnings.push(new Warning({
          parsedDocument: document.parsedDocument,
          code: this.code,
          severity: Severity.WARNING, sourceRange,
          message: stripWhitespace(`
            Root should no longer be used
          `),
          fix: [{range: sourceRange, replacementText}]
        }));
      }
    }

    return warnings;
  }
}

registry.register(new RootSelectorToHtml());
