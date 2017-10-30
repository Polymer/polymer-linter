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

import * as clone from 'clone';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {Document, ParsedHtmlDocument, Severity, SourceRange} from 'polymer-analyzer';

import {registry} from '../registry';
import {FixableWarning, Replacement} from '../warning';

import {HtmlRule} from './rule';

import stripIndent = require('strip-indent');

const p = dom5.predicates;
const styleMustBeInside = p.OR(
    p.hasTagName('style'),
    p.AND(p.hasTagName('link'), p.hasAttrValue('rel', 'stylesheet')));

const mustBeOutsideTemplate =
    p.AND(p.hasTagName('link'), p.hasAttrValue('rel', 'import'));

// Discoveries:
//   <style> does not work outside of template. Polymer 2.0 logs a warning.
//   <link rel="stylesheet"> does not work outside of template.
//       No runtime warning.
//   <link rel="import" type="css"> *only* works outside of template.
//       Polymer 2.0 logs a warning when you place one inside.

class MoveStyleIntoTemplate extends HtmlRule {
  code = 'style-into-template';
  description = stripIndent(`
      Warns about \`style\` tags in dom-modules but not in templates.

      This:

          <dom-module>
            <style></style>
            <template>foo</template>
          <dom-module>

      Should instead be written as:

          <dom-module>
            <template>
              <style></style>
              foo
            </template>
          <dom-module>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];
    const domModules = document.getFeatures({kind: 'dom-module'});
    for (const domModule of domModules) {
      const template = (domModule.astNode.childNodes ||
                        []).find((n) => n.tagName === 'template');
      if (!template) {
        continue;
      }
      const moduleChildren = domModule.astNode.childNodes || [];
      for (const child of moduleChildren) {
        if (!styleMustBeInside(child)) {
          continue;
        }
        const warning = new FixableWarning({
          parsedDocument,
          code: this.code,
          message:
              `Style tags should not be direct children of <dom-module>, they should be moved into the <template>`,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForStartTag(child)!
        });
        warnings.push(warning);

        const templateContentStart =
            parsedDocument.sourceRangeForStartTag(template)!.end;

        const styleIndentation = getIndentationInside(child);
        const templateIndentation = getIndentationInside(
            parse5.treeAdapters.default.getTemplateContent(template));
        const clonedStyle = clone(child);
        const contents = clonedStyle.childNodes;
        if (styleIndentation === templateIndentation && contents != null &&
            contents.every(dom5.isTextNode)) {
          const additionalIndentation = '  ';
          for (const textNode of contents) {
            const text = dom5.getTextContent(textNode);
            const indentedText = text.split('\n')
                                     .map((line) => {
                                       return line.match(/^\s/) ?
                                           additionalIndentation + line :
                                           line;
                                     })
                                     .join('\n');
            dom5.setTextContent(textNode, indentedText);
          }
        }

        const docFrag = parse5.treeAdapters.default.createDocumentFragment();
        dom5.append(docFrag, clonedStyle);
        const serializedStyle = parse5.serialize(docFrag);

        const edit: Replacement[] = [];

        // Delete trailing whitespace that we would leave behind.
        const prevNode = moduleChildren[moduleChildren.indexOf(child)! - 1];
        if (prevNode && dom5.isTextNode(prevNode)) {
          const whitespaceReplacement =
              removeTrailingWhitespace(prevNode, parsedDocument);
          if (whitespaceReplacement) {
            edit.push(whitespaceReplacement);
          }
        }

        // Delete the existing location for the node
        edit.push({
          range: parsedDocument.sourceRangeForNode(child)!,
          replacementText: ''
        });

        // Insert that same text inside the template element
        const whitespaceBefore = templateIndentation ?
            `\n${templateIndentation}` :
            templateIndentation;
        edit.push({
          range: {
            file: parsedDocument.url,
            start: templateContentStart,
            end: templateContentStart
          },
          replacementText: whitespaceBefore + serializedStyle
        });

        warning.fix = edit;
      }

      const linksInShadowDom = dom5.nodeWalkAll(
          template, mustBeOutsideTemplate, [], dom5.childNodesIncludeTemplate);
      for (const linkInShadowDom of linksInShadowDom) {
        let message;
        let code;
        if (dom5.getAttribute(linkInShadowDom, 'type') === 'css') {
          code = 'css-import-in-shadow';
          message = 'CSS imports inside shadow roots are ignored. ' +
              'This should be placed inside the <dom-module>, ' +
              'not in the <template>.';
        } else {
          code = 'import-in-shadow';
          message = 'Imports inside shadow roots are ignored.';
        }
        warnings.push(new FixableWarning({
          code,
          message,
          severity: Severity.WARNING, parsedDocument,
          sourceRange: parsedDocument.sourceRangeForNode(linkInShadowDom)!
        }));
      }
    }

    // Reverse here so that when we apply the fixes we move multiple
    // styles into the template we preserve their order.
    return warnings.reverse();
  }
}

function removeTrailingWhitespace(
    textNode: dom5.Node, parsedDocument: ParsedHtmlDocument) {
  const prevText = dom5.getTextContent(textNode);
  const match = prevText.match(/\n?[ \t]+$/);
  if (!match) {
    return;
  }
  const range = parsedDocument.sourceRangeForNode(textNode)!;
  const lengthOfPreviousLine =
      parsedDocument.newlineIndexes[range.end.line - 1] -
      (parsedDocument.newlineIndexes[range.end.line - 2] || -1) - 1;
  const newRange: SourceRange = {
    ...range,
    start: {
      column: lengthOfPreviousLine,
      line: range.end.line - 1,
    }
  };
  return {range: newRange, replacementText: ''};
}

function getIndentationInside(parentNode: dom5.Node) {
  if (!parentNode.childNodes || parentNode.childNodes.length === 0) {
    return '';
  }
  const firstChild = parentNode.childNodes[0];
  if (!dom5.isTextNode(firstChild)) {
    return '';
  }
  const text = dom5.getTextContent(firstChild);
  const match = text.match(/(^|\n)([ \t]+)/);
  if (!match) {
    return '';
  }
  // If the it's an empty node with just one line of whitespace, like this:
  //     <div>
  //     </div>
  // Then the indentation of actual content inside is one level deeper than
  // the whitespace on that second line.
  if (parentNode.childNodes.length === 1 && text.match(/^\n[ \t]+$/)) {
    return match[2] + '  ';
  }
  return match[2];
}

registry.register(new MoveStyleIntoTemplate());
