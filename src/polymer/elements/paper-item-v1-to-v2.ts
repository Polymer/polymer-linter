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

import {nodeIsTemplateExtension} from './utils';

class PaperItemV1ToV2 extends HtmlRule {
  code = 'paper-item-v1-to-v2';
  description = stripIndent(`
    Warns when child elements of <paper-icon-item> with an \`item-icon\`
    attribute do not have a \`slot="item-icon"\` attribute. <paper-icon-item>'s
    contained \`<content select="[item-icon]">\` has been replaced with
    \`<slot name="item-icon">\`.

    Example usage of <paper-icon-item> v1:

      <paper-icon-item>
        <iron-icon icon="home" item-icon></iron-icon>
      </paper-icon-item>

    After updating to <paper-icon-item> v2:

      <paper-icon-item>
        <iron-icon icon="home" slot="item-icon"></iron-icon>
      </paper-icon-item>
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument) {
    const warnings: Warning[] = [];

    const paperIconItems = dom5.nodeWalkAll(
      parsedDocument.ast,
      dom5.predicates.hasTagName('paper-icon-item'),
      undefined,
      dom5.childNodesIncludeTemplate
    );

    const checkNode = (node: dom5.Node) => {
      if (node.tagName !== undefined &&
        !dom5.hasAttribute(node, 'slot') &&
        dom5.hasAttribute(node, 'item-icon')
      ) {
        const startTagSourceRange =
          parsedDocument.sourceRangeForStartTag(node)!;
        const [startOffset, endOffset]
          = parsedDocument.sourceRangeToOffsets(startTagSourceRange);
        const startTagText =
          parsedDocument.contents.slice(startOffset, endOffset);
        const isSelfClosing = startTagText.endsWith('/>');

        warnings.push(new Warning({
          parsedDocument,
          code: this.code,
          message: 'Elements meant to be used as the icon for a ' +
            '<paper-icon-item> must now have a `slot="item-icon"` attribute ' +
            'instead of an `item-icon` attribute to be distributed correctly.',
          severity: Severity.WARNING,
          sourceRange: startTagSourceRange,
          fix: [{
            range: startTagSourceRange,
            replacementText:
              startTagText.slice(0, isSelfClosing ? -2 : -1) +
              ` slot="item-icon"` +
              (isSelfClosing ? '/' : '') + '>',
          }],
        }));
      }
    };

    for (const paperIconItem of paperIconItems) {
      let suspectNodes = Array.from(paperIconItem.childNodes!);

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

registry.register(new PaperItemV1ToV2());
