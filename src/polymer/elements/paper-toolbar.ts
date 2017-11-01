/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import stripIndent = require('strip-indent');

import {registry} from '../../registry';
import {HtmlRule} from '../../html/rule';
import {ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';
import {FixableWarning} from '../../warning';

class PaperToolbar extends HtmlRule {
  code = 'paper-toolbar';
  description = stripIndent(`
    (description paper-toolbar)
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument) {
    const warnings: Warning[] = [];

    const paperToolbars = dom5.nodeWalkAll(
      parsedDocument.ast,
      dom5.predicates.hasTagName('paper-toolbar'),
      undefined,
      dom5.childNodesIncludeTemplate
    );

    const checkNode = (node: dom5.Node) => {
      // Elements without a slot attribute, which were previously distributed
      // into a default slot, now need to have `slot="top"`.
      if (node.tagName !== undefined && !dom5.hasAttribute(node, 'slot')) {
        const startTagSourceRange =
          parsedDocument.sourceRangeForStartTag(node)!;
        const warning = new FixableWarning({
          parsedDocument,
          code: this.code,
          message: '<paper-toolbar> no longer has a default slot: this ' +
            'element will not appear in the composed tree. Add `slot="top"` ' +
            'to distribute to the same position as the previous default ' +
            'content.',
          severity: Severity.WARNING,
          sourceRange: startTagSourceRange
        });

        const [startOffset, endOffset]
          = parsedDocument.sourceRangeToOffsets(startTagSourceRange);

        const startTagText =
          parsedDocument.contents.slice(startOffset, endOffset);
        const isSelfClosing = startTagText.endsWith('/>');

        warning.fix = [{
          range: startTagSourceRange,
          replacementText: startTagText.slice(0, isSelfClosing ? -2 : -1) +
            ` slot="top"` + (isSelfClosing ? '/' : '') + '>',
        }];

        warnings.push(warning);
      }

      // Non-whitespace-only text nodes, which were previously distributed into
      // a default slot, now need to be wrapped in `<span slot="top">...</span>`.
      if (node.nodeName === '#text' && node.value!.trim() !== '') {
        const textNodeSourceRange = parsedDocument.sourceRangeForNode(node)!;

        const warning = new FixableWarning({
          parsedDocument,
          code: this.code,
          message: '<paper-toolbar> no longer has a default slot: this ' +
            'text node will not appear in the composed tree. Wrap with ' +
            '`<span slot="top">...</span>` to distribute to the same ' +
            'position as the previous default content.',
          severity: Severity.WARNING,
          sourceRange: textNodeSourceRange
        });

        const fullText = node.value!;
        const trimmedText = fullText.trim();
        const trimmedOffset = fullText.indexOf(trimmedText);

        const replacementText =
          fullText.substring(0, trimmedOffset) +
          '<span slot="top">' +
          trimmedText +
          '</span>' +
          fullText.substring(trimmedOffset + trimmedText.length);

        warning.fix = [{
          range: textNodeSourceRange,
          replacementText,
        }];

        warnings.push(warning);
      }
    };

    for (const paperToolbar of paperToolbars) {
      let suspectNodes = Array.from(paperToolbar.childNodes!);

      const nodeIsTemplateExtension = (node: dom5.Node) => {
        if (!node.attrs) return false;

        const isAttr = node.attrs.find(attr => attr.name === 'is');
        return (
          node.tagName === 'template' &&
          isAttr &&
          ['dom-bind', 'dom-if', 'dom-repeat'].includes(isAttr.value)
        );
      };

      while (suspectNodes.some(nodeIsTemplateExtension)) {
        suspectNodes = suspectNodes
          .map(node => {
            if (nodeIsTemplateExtension(node)) {
              return Array.from(dom5.childNodesIncludeTemplate(node)!);
            }

            return [node];
          })
          .reduce((a, b) => a.concat(b), []);
      }

      for (const node of suspectNodes) {
        checkNode(node);
      }
    }

    return warnings;
  }
}

registry.register(new PaperToolbar());
