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
import {Document, ParsedHtmlDocument, Replacement, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../../html/rule';
import {getIndentationInside} from '../../html/util';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';

const p = dom5.predicates;
const isIronFormV1 = p.AND(
    (node: dom5.Node) =>
        !node.parentNode || !p.hasTagName('iron-form')(node.parentNode),
    p.hasTagName('form'),
    p.hasAttrValue('is', 'iron-form'));

const ironFormProperties = [
  'allow-redirect',
  'headers',
  'with-credentials',
  'allow-redirect$',
  'headers$',
  'with-credentials$'
];

class IronFormV1ToV2 extends HtmlRule {
  code = 'iron-form-v1-to-v2';
  description = stripIndentation(`
      Warns when \`iron-form\` is used as type extension. 

      This:

          <form is="iron-form"
                method="get"
                action="/my-end-point"
                on-iron-form-error="handleError">
            <input type="text">
            <input type="submit">
          </form>

      Should instead be written as:

          <iron-form on-iron-form-error="handleError">
            <form method="get"
                  action="/my-end-point">
              <input type="text">
              <input type="submit">
            </form>
          </iron-form>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, _document: Document) {
    const warnings: Warning[] = [];
    const forms = dom5.queryAll(
        parsedDocument.ast, isIronFormV1, [], dom5.childNodesIncludeTemplate);
    for (const form of forms) {
      // Copy the iron-form attributes and event listeners to <iron-form>.
      const attrs =
          form.attrs
              .filter(
                  (attr) =>
                      (attr.name.startsWith('on-iron-form-') ||
                       ironFormProperties.indexOf(attr.name) >= 0))
              .map(
                  (attr) =>
                      `${attr.name}${attr.value ? `="${attr.value}"` : ''}`)
              .join(' ');
      const indentation = getIndentationInside(form.parentNode!);
      const formRange = parsedDocument.sourceRangeForNode(form)!;
      const fix: Replacement[] = [
        {
          range: {
            file: parsedDocument.url,
            start: formRange.start,
            end: formRange.start
          },
          replacementText: '<iron-form' + (attrs ? ' ' + attrs : '') + '>' +
              (indentation ? '\n' + indentation + '  ' : '')
        },
        {
          range: {
            file: parsedDocument.url,
            start: formRange.end,
            end: formRange.end
          },
          replacementText:
              (indentation ? '\n' + indentation : '') + '</iron-form>'
        }
      ];
      if (indentation && formRange.end.line > formRange.start.line) {
        for (let i = formRange.start.line + 1; i <= formRange.end.line; i++) {
          const position = {line: i, column: 0};
          fix.push({
            range: {file: parsedDocument.url, start: position, end: position},
            replacementText: '  '
          });
        }
      }
      warnings.push(new Warning({
        parsedDocument,
        code: this.code,
        message:
            `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForAttribute(form, 'is')!, fix
      }));
    }

    return warnings;
  }
}

registry.register(new IronFormV1ToV2());