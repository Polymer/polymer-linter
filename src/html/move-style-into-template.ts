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
import * as parse5 from 'parse5';
import {Document, ParsedHtmlDocument, Severity, SourceRange} from 'polymer-analyzer';

import {registry} from '../registry';
import {FixableWarning, Replacement} from '../warning';

import {HtmlRule} from './rule';

import stripIndent = require('strip-indent');

const p = dom5.predicates;
const isStyleTag = p.OR(
    p.hasTagName('style'),
    p.AND(p.hasTagName('link'), p.hasAttrValue('rel', 'stylesheet')));

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
        if (!isStyleTag(child)) {
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

        const [start, end] = parsedDocument.sourceRangeToOffsets(
            parsedDocument.sourceRangeForNode(child)!);
        const serializedStyle = parsedDocument.contents.slice(start, end);
        const edit: Replacement[] = [];

        // Delete trailing whitespace we would leave behind.
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

        let indentation = getIndentationInside(
            parse5.treeAdapters.default.getTemplateContent(template));
        if (indentation) {
          indentation = '\n' + indentation;
        }
        // Insert that same text inside the template element
        edit.push({
          range: {
            file: parsedDocument.url,
            start: templateContentStart,
            end: templateContentStart
          },
          replacementText: indentation + serializedStyle
        });

        warning.fix = edit;
      }
    }

    return warnings;
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
  const match = dom5.getTextContent(firstChild).match(/(^|\n)([ \t]+)/);
  if (!match) {
    return '';
  }
  return match[2];
}

registry.register(new MoveStyleIntoTemplate());
