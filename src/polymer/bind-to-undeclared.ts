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
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document, Element} from 'polymer-analyzer/lib/model/model';
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {stripWhitespace} from '../util';

import stripIndent = require('strip-indent');

const sharedAttributes = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tabindex',
  'accesskey',
  'draggable',
  'spellcheck',
  'innertext',
  'contextmenu',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'contenteditable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'class',
  'slot',


  // https://html.spec.whatwg.org/multipage/dom.html#global-attributes
  'itemid',
  'itemprop',
  'itemref',
  'itemscope',
  'itemtype',
  'is',
  'style',

  // aria-* http://www.w3.org/TR/wai-aria/states_and_properties#state_prop_def
  // role: http://www.w3.org/TR/wai-aria/host_languages#host_general_role
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
  'role',
]);

const sharedProperties = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tab-index',
  'access-key',
  'draggable',
  'spellcheck',
  'inner-text',
  'context-menu',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'content-editable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'class-name',
  'slot',


  'is',
]);


export class BindToUndeclaredAttributes extends HtmlRule {
  code = 'polymer-attribute';
  description = stripIndent(`
      Warns setting undeclared properties or attributes in Polymer templates.

      This rule will warn when setting an attribute or property on a custom
      element.
  `).trim();

  constructor() {
    super();
  }

  async checkDocument(parsedDoc: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];
    const domModules = document.getByKind('dom-module');
    for (const domModule of domModules) {
      if (!domModule.template) {
        continue;
      }
      // TODO(rictic): querying for local features is O(N). We should add a
      // cache to Document but until then, build one here.
      const elementsByTagName = new Map<string, Element|null>();
      const duplicates = new Set();
      for (const element of document.getByKind('element')) {
        const tagName = element.tagName;
        if (!tagName) {
          continue;
        }
        if (duplicates.has(tagName)) {
          continue;
        }
        if (elementsByTagName.has(tagName)) {
          duplicates.add(tagName);
          elementsByTagName.delete(tagName);
          continue;
        }
        elementsByTagName.set(tagName, element);
      }

      dom5.nodeWalk(domModule.template, (node) => {
        const element = elementsByTagName.get(node.tagName!);
        if (!element) {
          return false;
        }
        for (const attr of node.attrs || []) {
          let name = attr.name;
          let isAttribute = true;
          const isDataBinding = /^(({{.*}})|(\[\[.*\]\]))$/.test(attr.value);
          if (isDataBinding) {
            if (name.endsWith('$')) {
              name = name.slice(0, name.length - 1);
            } else {
              isAttribute = false;
            }
          }
          // This is an open namespace.
          if (name.startsWith('data-')) {
            if (!isAttribute) {
              warnings.push({
                code: this.code,
                message: stripWhitespace(`
                  The data-* attributes must be accessed as attributes.
                  i.e. you must write:  ${name}$="${attr.value}"`),
                severity: Severity.ERROR,
                sourceRange:
                    parsedDoc.sourceRangeForAttributeName(node, attr.name)!
              });
            }
            continue;
          }
          if (name.startsWith('on')) {
            // TODO(rictic): handle these.
            continue;
          }

          // TODO(rictic): The `for` attribute on <label> must be
          // attribute-bound.


          // TODO(rictic): if binding to a property, and the user hasn't
          // performed the hyphenization, we should give them a specialized
          // warning message.
          // Likewise if there is an attribute but not a property or vice versa.

          const allowedBindings =
              isAttribute ? element.attributes : element.properties;
          const shared = isAttribute ? sharedAttributes : sharedProperties;
          const found = shared.has(name) ||
              !!allowedBindings.find((b) => b.name === name);
          if (!found) {
            const bindingType = isAttribute ? 'an attribute' : 'a property';
            warnings.push({
              code: this.code,
              message: stripWhitespace(
                  `${node.tagName} elements do not have ${bindingType}
                   named ${name}`),
              severity: Severity.WARNING,
              sourceRange:
                  parsedDoc.sourceRangeForAttributeName(node, attr.name)!
            });
          }
        }
        return false;
      }, dom5.childNodesIncludeTemplate);
    }
    return warnings;
  }
}


registry.register(new BindToUndeclaredAttributes());
