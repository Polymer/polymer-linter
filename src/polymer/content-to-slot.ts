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
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {Edit, FixableWarning} from '../warning';

import stripIndent = require('strip-indent');

const p = dom5.predicates;

const config =
    new Map<string, Array<{predicate: dom5.Predicate, slot: string}>>();

function addPredicate(
    tagname: string, slots: Array<{selector: string, slot: string}>) {
  config.set(
      tagname, slots.map((s) => ({
                           predicate: simpleSelectorToPredicate(s.selector),
                           slot: s.slot
                         })));
}

// addPredicate(
//     'paper-header-panel',
//     [{selector: 'paper-toolbar, .paper-header', slot: 'header'}]);

// addPredicate('paper-scroll-header-panel', [
//   {selector: 'paper-toolbar, .paper-header', slot: 'header'},
//   {selector: '*', slot: 'content'}
// ]);

// addPredicate('paper-toolbar', [
//   {selector: '.middle', slot: 'middle'},
//   {selector: '.bottom', slot: 'bottom'},
//   {selector: '*', slot: 'top'}
// ]);

// addPredicate('paper-drawer-panel', [
//   {selector: '[drawer]', slot: 'drawer'},
//   {selector: '[main]', slot: 'main'}
// ]);

// addPredicate('paper-icon-item', [{selector: '[item-icon]', slot:
// 'item-icon'}]);

// addPredicate('paper-menu-button', [
//   {selector: '.dropdown-trigger', slot: 'dropdown-trigger'},
//   {selector: '.dropdown-content', slot: 'dropdown-content'},
// ]);

addPredicate(
    'iron-dropdown',
    [{selector: '.dropdown-content', slot: 'dropdown-content'}]);

class ContentToSlot extends HtmlRule {
  code = 'content-to-slot';
  description = stripIndent(`
      Warns when using <content> instead of Shadow Dom v1's <slot> element.
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    const references = document.getFeatures({kind: 'element-reference'});
    for (const reference of references) {
      const contentDescriptors = config.get(reference.tagName);
      if (!contentDescriptors) {
        continue;
      }
      const fix: Edit = [];
      const matchedSoFar = new Set<dom5.Node>();
      for (const {predicate, slot} of contentDescriptors) {
        const lightContents =
            (reference.astNode.childNodes || []).filter(predicate);
        for (const lightContent of lightContents) {
          if (dom5.hasAttribute(lightContent, 'slot')) {
            continue;
          }
          const range = parsedDocument.sourceRangeForStartTag(lightContent);
          if (!range) {
            continue;
          }
          if (matchedSoFar.has(lightContent)) {
            continue;
          }
          matchedSoFar.add(lightContent);
          const [startOffset, endOffset] =
              parsedDocument.sourceRangeToOffsets(range);
          const originalText =
              parsedDocument.contents.slice(startOffset, endOffset);
          const withSlotAttr = originalText.slice(0, -1) + ` slot="${slot}">`;

          fix.push({range, replacementText: withSlotAttr});
        }
      }
      if (fix.length > 0) {
        const warning = new FixableWarning({
          code: 'content-to-slot-usage-site',
          message: ``, parsedDocument,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForStartTag(reference.astNode)!
        });
        warning.fix = fix;
        warnings.push(warning);
      }
    }

    // rictic: DO NOT MERGE without checking for _declarations_ of <content>
    //     in addition to the _usages_ as above.

    return warnings;
  }
}

// NOTE(rictic): This only works for very, very simple selectors. Do something
//   smarter here.
function simpleSelectorToPredicate(simpleSelector: string): dom5.Predicate {
  simpleSelector = simpleSelector.trim();
  const pieces = simpleSelector.split(',');
  if (pieces.length > 1) {
    return p.OR(...pieces.map(simpleSelectorToPredicate));
  }
  if (simpleSelector[0] === '.') {
    return p.hasClass(simpleSelector.slice(1));
  }
  if (simpleSelector.startsWith('[') && simpleSelector.endsWith(']')) {
    return p.hasAttr(simpleSelector.slice(1, -1));
  }
  if (simpleSelector === '*') {
    return () => true;
  }
  return p.hasTagName(simpleSelector);
}

registry.register(new ContentToSlot());
