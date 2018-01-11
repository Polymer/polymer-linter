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

import * as clone from 'clone';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {Document, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

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

const ironFormProperties = ['allow-redirect', 'headers', 'with-credentials'];

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
      // Create a wrapper <iron-form>
      const ironForm =
          parse5.treeAdapters.default.createElement('iron-form', '', []);

      // Clone the <form> and move its attributes to <iron-form>
      const clonedForm = clone(form);
      dom5.removeAttribute(clonedForm, 'is');
      this.copyAttribute(clonedForm, ironForm, 'id');
      clonedForm.attrs.forEach((attr) => {
        if (attr.name.startsWith('on-iron-form-') ||
            ironFormProperties.indexOf(attr.name) >= 0) {
          this.copyAttribute(clonedForm, ironForm, attr.name);
        }
      });
      dom5.append(ironForm, clonedForm);
      const fragment = parse5.treeAdapters.default.createDocumentFragment();
      dom5.append(fragment, ironForm);
      // Formatting fun.
      const indentation = getIndentationInside(form.parentNode!);
      const newline = indentation ? '\n' : '';
      const serializedForm =
          parse5.serialize(fragment)
              .replace('<form', `${newline + indentation}<form`)
              .replace(/^/mg, '  ')
              .replace('</form>', `</form>${newline + indentation}`)
              .trim();
      warnings.push(new Warning({
        parsedDocument,
        code: this.code,
        message:
            `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForStartTag(form)!,
        fix: [{
          range: parsedDocument.sourceRangeForNode(form)!,
          replacementText: serializedForm
        }]
      }));
    }

    return warnings;
  }

  copyAttribute(from: dom5.Node, to: dom5.Node, attr: string) {
    if (dom5.hasAttribute(from, attr)) {
      dom5.setAttribute(to, attr, dom5.getAttribute(from, attr)!);
      dom5.removeAttribute(from, attr);
    }
  }
}

registry.register(new IronFormV1ToV2());