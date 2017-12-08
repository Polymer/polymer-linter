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

const p = dom5.predicates;

const cssRule = `<style id="linter-paper-button-style">
  paper-button {
    display: inline-block;
    text-align: center;
  }
</style>`;

class PaperMaterialUsage extends HtmlRule {
  code = 'paper-button-style';
  description = stripIndentation(`Checks if paper-material is used and imported.`);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
    parsedDocument: ParsedHtmlDocument, document: Document, warnings: Warning[]) {
    for (const domModule of document.getFeatures({ kind: 'dom-module' })) {
      const template = dom5.query(domModule.astNode, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const templateContent = treeAdapters.default.getTemplateContent(template);
      if (dom5.query(templateContent, p.hasAttrValue('id', 'linter-paper-button-style'))) {
        continue;
      }
      const buttonNode = this.getPaperButton(templateContent);
      if (!buttonNode) {
        continue;
      }
      const indent = getIndentationInside(templateContent);
      const insertion = `\n${indent}${cssRule.replace(/\n/g, '\n' + indent)}`;
      warnings.push(new Warning({
        code: 'paper-button-style',
        message: `paper-button style changed to display: inline-flex. Force its display to inline-block to have previous rendering.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange:
            parsedDocument.sourceRangeForNode(buttonNode)!,
        fix: [prependContentInto(parsedDocument, template, insertion)]
      }));
    }
  }

  getPaperButton(rootNode: dom5.Node): dom5.Node | null {
    let buttonNode = dom5.query(rootNode, p.hasTagName('paper-button'));
    if (buttonNode) {
      return buttonNode;
    }
    const templates = dom5.queryAll(rootNode, p.hasTagName('template'));
    for (const template of templates) {
      const templateContent = treeAdapters.default.getTemplateContent(template);
      buttonNode = this.getPaperButton(templateContent);
      if (buttonNode) {
        break;
      }
    }
    return buttonNode;
  }
}

registry.register(new PaperMaterialUsage());
