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
import cssWhat = require('css-what');

// Attributes that are on every HTMLElement.
export const sharedAttributes = new Set([
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


// Properties that are on every HTMLElement
export const sharedProperties = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tabIndex',
  'accessKey',
  'draggable',
  'spellcheck',
  'innerText',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'contentEditable',
  'isContentEditable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'className',
  'slot',


  'is',
]);

/**
 * Converts a css selector into a dom5 predicate.
 *
 * This is intended for handling only selectors that match an individual element
 * in isolation, it does throws if the selector talks about relationships
 * between elements like `.foo .bar` or `.foo > .bar`.
 */
export function elementSelectorToPredicate(simpleSelector: string):
    dom5.Predicate {
  const parsed = cssWhat(simpleSelector);
  // The output of cssWhat is two levels of arrays. The outer level are any
  // selectors joined with a comma, so it matches if any of the inner selectors
  // match. The inner array are simple selectors like `.foo` and `#bar` which
  // must all match.
  return dom5.predicates.OR(...parsed.map((simpleSelectors) => {
    return dom5.predicates.AND(
        ...simpleSelectors.map(simpleSelectorToPredicate));
  }));
}

function simpleSelectorToPredicate(selector: cssWhat.Simple) {
  switch (selector.type) {
    case 'adjacent':
    case 'child':
    case 'descendant':
    case 'parent':
    case 'sibling':
    case 'pseudo':
      throw new Error(`Unsupported CSS operator: ${selector.type}`);
    case 'attribute':
      return attributeSelectorToPredicate(selector);
    case 'tag':
      return dom5.predicates.hasTagName(selector.name);
    case 'universal':
      return () => true;
  }
  const never: never = selector;
  throw new Error(`Unexpected node type from css parser: ${never}`);
}

function attributeSelectorToPredicate(selector: cssWhat.Attribute):
    dom5.Predicate {
  switch (selector.action) {
    case 'exists':
      return dom5.predicates.hasAttr(selector.name);
    case 'equals':
      return dom5.predicates.hasAttrValue(selector.name, selector.value);
    case 'start':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.startsWith(selector.value);
      };
    case 'end':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.endsWith(selector.value);
      };
    case 'element':
      return dom5.predicates.hasSpaceSeparatedAttrValue(
          selector.name, selector.value);
    case 'any':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.includes(selector.value);
      };
  }
  const never: never = selector.action;
  throw new Error(
      `Unexpected type of attribute matcher from CSS parser ${never}`);
}