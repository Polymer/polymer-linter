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

const outsideStyle = p.AND(
    p.hasTagName('link'),
    p.hasAttrValue('rel', 'import'),
    p.hasAttrValue('type', 'css'));

/**
 * If a stylesheet sets the display property in the --paper-button mixin. e.g.
 *
 *    paper-button {
 *      --paper-button: { display: inline; }
 *    }
 *
 * Note that we have special knowledge of the iron-flex-layout mixins as they
 * set the display as well e.g.
 *
 *    paper-button {
 *      --paper-button: { @apply --layout; }
 *    }
 */
const setsDisplayInMixin = (styleDoc: Document) =>
    /--paper-button:\s?{[^}]*(display:|@apply[\(\s]--layout)[^}]*}/.test(
        styleDoc.parsedDocument.contents);

const cssRule = `<style id="linter-paper-button-style">
  /**
   * This style preserves the styling previous to
   * https://github.com/PolymerElements/paper-button/pull/115
   * This change can break the layout of paper-button content.
   * Remove this style to apply the change, more details at b/70528356.
   */
  paper-button {
    display: inline-block;
    text-align: center;
  }
</style>`;

const linkRule = `<!--
 This style preserves the styling previous to
 https://github.com/PolymerElements/paper-button/pull/115
 This change can break the layout of paper-button content.
 Remove this style to apply the change, more details at b/70528356.
-->
<link id="linter-paper-button-style" rel="import" type="css"
      href="data:text/css;charset=utf-8,paper-button{display:inline-block;text-align:center}"
>`;

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
    const styleDocs = [...document.getFeatures({kind: 'css-document'})];
    const linkDocs = [...document.getFeatures({kind: 'css-import'})];
    for (const domModule of document.getFeatures({kind: 'dom-module'})) {
      // Already parsed.
      if (dom5.query(
              domModule.astNode,
              p.hasAttrValue('id', 'linter-paper-button-style'),
              dom5.childNodesIncludeTemplate)) {
        continue;
      }
      // paper-button not used.
      const buttonNode = dom5.query(
          domModule.astNode,
          p.hasTagName('paper-button'),
          dom5.childNodesIncludeTemplate);
      if (!buttonNode) {
        continue;
      }

      let linkNode: dom5.Node|null = null;
      const linkNodeUsingMixin = dom5.query(
          domModule.astNode, p.AND(outsideStyle, (node: dom5.Node) => {
            if (!linkNode) {
              linkNode = node;
            }
            const i = linkDocs.findIndex((doc) => doc.astNode === node);
            if (i === -1) {
              return false;
            }
            // Remove link from the docs to speed up next queries.
            const linkDoc = linkDocs.splice(i, 1)[0];
            return [
              ...linkDoc.document.getFeatures({kind: 'css-document'})
            ].some(setsDisplayInMixin);
          }));
      if (linkNodeUsingMixin) {
        continue;
      }

      const template = dom5.query(domModule.astNode, p.hasTagName('template'))!;
      const templateContent = treeAdapters.default.getTemplateContent(template);
      const styleNodeUsingMixin = dom5.query(
          templateContent, p.AND(p.hasTagName('style'), (node: dom5.Node) => {
            const i = styleDocs.findIndex((doc) => doc.astNode === node);
            if (i === -1) {
              return false;
            }
            // Remove style from the docs to speed up next queries.
            const styleDoc = styleDocs.splice(i, 1)[0];
            return setsDisplayInMixin(styleDoc);
          }));
      if (styleNodeUsingMixin) {
        continue;
      }

      const rule = linkNode ? linkRule : cssRule;
      const insertionNode = linkNode ? domModule.astNode : template;
      const indent =
          getIndentationInside(linkNode ? domModule.astNode : templateContent);
      const insertion = `\n${indent}${rule.replace(/\n/g, '\n' + indent)}`;
      warnings.push(new Warning({
        code: 'paper-button-style',
        message:
            `paper-button v2 changed its style from \`display: inline-block\` to \`display: inline-flex\`.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForNode(buttonNode)!,
        fix: [prependContentInto(parsedDocument, insertionNode, insertion)]
      }));
    }
  }
}

registry.register(new PaperButtonStyle());
