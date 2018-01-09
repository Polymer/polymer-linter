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
import {Document, ParsedCssDocument, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../../html/rule';
import {getIndentationInside, prependContentInto} from '../../html/util';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';

const p = dom5.predicates;

const outsideStyle = p.AND(
    p.hasTagName('link'),
    p.hasAttrValue('rel', 'import'),
    p.hasAttrValue('type', 'css'));

const displayRegex = new RegExp(
    // In the element itself or the mixin
    '(paper-button|--paper-button:)' +
    // spaces + open {
    '\\s*{[^}]*' +
    // sets display: or @apply --layout
    '(display:|@apply[\\(\\s]--layout)' +
    // close }
    '[^}]*}');
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
 *
 * Returns the match.
 */
const setsDisplayInStylesheet = (styleDoc: Document) =>
    displayRegex.exec(styleDoc.parsedDocument.contents);

const setsDisplayFlex = (style: string) =>
    /(display:\s?(inline)?[-\s]?flex|@apply[\\(\\s]--layout)/.test(style);

const cssRule = `/**
 * This style preserves the styling previous to
 * https://github.com/PolymerElements/paper-button/pull/115
 * This change can break the layout of paper-button content.
 * Remove this style to apply the change, more details at b/70528356.
 */
paper-button {
  display: inline-block;
  text-align: center;
  font-family: inherit;
  align-items: stretch;
  justify-content: flex-start;
}`;

const cssFlexRule = `/**
 * This style preserves the styling previous to
 * https://github.com/PolymerElements/paper-button/pull/115
 * This change can break the layout of paper-button content.
 * Remove this style to apply the change, more details at b/70528356.
 */
paper-button {
  align-items: stretch;
  justify-content: flex-start;
}`;

class PaperButtonStyle extends HtmlRule {
  code = 'paper-button-style';
  description = stripIndentation(
      `Checks if paper-button is used and adds a stylesheet to reset its display and text align.`);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

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

      let ruleToInject = cssRule;

      // Search if paper-button display is already set in template styles.
      const template = dom5.query(domModule.astNode, p.hasTagName('template'))!;
      const templateContent = treeAdapters.default.getTemplateContent(template);
      let setsDisplayInStyles: RegExpExecArray|null = null;
      dom5.query(
          templateContent, p.AND(p.hasTagName('style'), (node: dom5.Node) => {
            const i = styleDocs.findIndex((doc) => doc.astNode === node);
            if (i === -1) {
              return false;
            }
            // Remove style from the docs to speed up next queries.
            const styleDoc = styleDocs.splice(i, 1)[0];
            setsDisplayInStyles = setsDisplayInStylesheet(styleDoc);
            return setsDisplayInStyles !== null;
          }));
      if (setsDisplayInStyles) {
        if (!setsDisplayFlex(setsDisplayInStyles[0])) {
          continue;
        }
        ruleToInject = cssFlexRule;
      }

      // Search if paper-button display is already set in outside styles.
      let linkCssDoc: ParsedCssDocument|null = null;
      let setsDisplayInLinks: RegExpExecArray|null = null;
      dom5.query(domModule.astNode, p.AND(outsideStyle, (node: dom5.Node) => {
        const i = linkDocs.findIndex((doc) => doc.astNode === node);
        if (i === -1) {
          return false;
        }
        // Remove link from the docs to speed up next queries.
        for (const cssDocument of linkDocs.splice(i, 1)[0].document.getFeatures(
                 {kind: 'css-document'})) {
          if (!(cssDocument.parsedDocument instanceof ParsedCssDocument)) {
            continue;
          }
          if (!linkCssDoc) {
            linkCssDoc = cssDocument.parsedDocument;
          }
          setsDisplayInLinks = setsDisplayInStylesheet(cssDocument);
          if (setsDisplayInLinks) {
            break;
          }
        }
        return setsDisplayInLinks !== null;
      }));
      if (setsDisplayInLinks) {
        if (!setsDisplayFlex(setsDisplayInLinks[0])) {
          continue;
        }
        ruleToInject = cssFlexRule;
      }

      // Insert the fix in the css file.
      if (linkCssDoc) {
        const range = {
          file: linkCssDoc!.sourceRange.file,
          start: {line: 0, column: 0},
          end: {line: 0, column: 0}
        };
        warnings.push(new Warning({
          code: 'paper-button-style',
          message:
              `paper-button v2 changed its style from \`display: inline-block\` to \`display: inline-flex\`.`,
          parsedDocument: linkCssDoc,
          severity: Severity.WARNING,
          sourceRange: range,
          fix: [{replacementText: ruleToInject + '\n\n', range}]
        }));
      } else {
        const indent = getIndentationInside(templateContent);
        const insertion = `
${indent}<style id="linter-paper-button-style">
${indent}  ${ruleToInject.replace(/\n/g, '\n' + indent + '  ')}
${indent}</style>`;
        warnings.push(new Warning({
          code: 'paper-button-style',
          message:
              `paper-button v2 changed its style from \`display: inline-block\` to \`display: inline-flex\`.`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForNode(buttonNode)!,
          fix: [prependContentInto(parsedDocument, template, insertion)]
        }));
      }
    }

    return warnings;
  }
}

registry.register(new PaperButtonStyle());
