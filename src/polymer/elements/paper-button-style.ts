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
import {treeAdapters} from 'parse5';
import {Document, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../../html/rule';
import {getIndentationInside, prependContentInto} from '../../html/util';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';
import {deepQuery} from './utils';

const p = dom5.predicates;

const cssRule = `<style id="linter-paper-button-style">
  /**
   * This style reverts the vertical/horizontal alignment done
   * in https://github.com/PolymerElements/paper-button/pull/115
   * as this can break some tests.
   * Remove this style node to apply the change.
   */
  paper-button {
    display: inline-block;
    text-align: center;
  }
</style>`;

class PaperButtonStyle extends HtmlRule {
  code = 'paper-button-style';
  description = stripIndentation(
      `Checks if paper-button is used and adds a stylesheet to reset its display and text align.`);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, document: Document,
      warnings: Warning[]) {
    for (const domModule of document.getFeatures({kind: 'dom-module'})) {
      const template = dom5.query(domModule.astNode, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const templateContent = treeAdapters.default.getTemplateContent(template);
      if (dom5.query(
              templateContent,
              p.hasAttrValue('id', 'linter-paper-button-style'))) {
        continue;
      }
      const buttonNode = deepQuery(templateContent, 'paper-button');
      if (!buttonNode) {
        continue;
      }
      const indent = getIndentationInside(templateContent);
      const insertion = `\n${indent}${cssRule.replace(/\n/g, '\n' + indent)}`;
      warnings.push(new Warning({
        code: 'paper-button-style',
        message:
            `paper-button style changed to display: inline-flex. Force its display to inline-block to have previous rendering.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForNode(buttonNode)!,
        fix: [prependContentInto(parsedDocument, template, insertion)]
      }));
    }
  }
}

registry.register(new PaperButtonStyle());
