/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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
// import {PolymerElement} from 'polymer-analyzer/lib/polymer/polymer-element';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document} from 'polymer-analyzer/lib/model/model';
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';

import * as expressions from '../expressions';
import * as matchers from '../matchers';
import {Rule} from '../rule';

export const a11yAttributes: Set<string> = new Set([
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-controls',
  'aria-describedby',
  'aria-disabled',
  'aria-dropeffect',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'role'
]);

export const nativeAttributes: Set<string> = new Set([
  'accesskey',
  'class',
  'contenteditable',
  'contextmenu',
  'dir',
  'draggable',
  'dropzone',
  'hidden',
  'href',
  'id',
  'itemprop',
  'lang',
  'spellcheck',
  'style',
  'style',
  'tabindex',
  'title'
]);

const expressionParser = new expressions.ExpressionParser();

export class NativeAttributeBinding implements Rule {
  public async check(document: Document): Promise<Warning[]> {
    const warnings: Warning[] = [];
    const templates = dom5.queryAll(
        document.parsedDocument.ast,
        dom5.predicates.OR(
            matchers.isDomBindTemplate, matchers.isDomModuleTemplate));

    for (const template of templates) {
      for (const element of dom5.queryAll(
               parse5.treeAdapters.default.getTemplateContent(template),
               (e) => true)) {
        for (const attr of element.attrs) {
          if (this._isBindingExpression(attr.value) &&
              !this._canAttributeUseNativeBinding(element, attr)) {
            const parsedHtml = document.parsedDocument;
            if (!(parsedHtml instanceof ParsedHtmlDocument)) {
              continue;
            }
            warnings.push({
              code: 'native-attribute-binding',
              message: `The expression ${attr.value} bound to attribute ` +
                  `'${attr.name}' should use $= instead of =`,
              severity: Severity.ERROR,
              sourceRange:
                  parsedHtml.sourceRangeForAttribute(element, attr.name)!
            });
          }
        }
      }
    }
    return warnings;
  }

  private _canAttributeUseNativeBinding(
      element: parse5.ASTNode,
      attr: parse5.ASTAttribute): boolean {
    const name: string = attr.name.toLowerCase();
    if (name === 'for' && dom5.predicates.hasTagName('label')(element)) {
      return false;
    }
    if (nativeAttributes.has(name)) {
      return false;
    }
    if (name.indexOf('data-') === 0 && attr.name[name.length - 1] !== '$') {
      return false;
    }
    return true;
  }

  private _isBindingExpression(expression: string): boolean {
    const bindingMatch = expressionParser.extractBindingExpression(expression);
    return !!bindingMatch || false;
  }
}
