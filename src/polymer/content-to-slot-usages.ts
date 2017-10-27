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
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {FixableWarning, Replacement} from '../warning';

import stripIndent = require('strip-indent');


const p = dom5.predicates;

const staticConfig =
    new Map<string, Array<{predicate: dom5.Predicate, slot: string}>>();

function addPredicate(
    tagname: string, slots: Array<{selector: string, slot: string}>) {
  staticConfig.set(
      tagname, slots.map((s) => ({
                           predicate: simpleSelectorToPredicate(s.selector),
                           slot: s.slot
                         })));
}

addPredicate(
    'paper-header-panel',
    [{selector: 'paper-toolbar, .paper-header', slot: 'header'}]);

addPredicate('paper-scroll-header-panel', [
  {selector: 'paper-toolbar, .paper-header', slot: 'header'},
  {selector: '*', slot: 'content'}
]);

addPredicate('paper-toolbar', [
  {selector: '.middle', slot: 'middle'},
  {selector: '.bottom', slot: 'bottom'},
  {selector: '*', slot: 'top'}
]);

addPredicate('paper-drawer-panel', [
  {selector: '[drawer]', slot: 'drawer'},
  {selector: '[main]', slot: 'main'}
]);

addPredicate('paper-icon-item', [{selector: '[item-icon]', slot: 'item-icon'}]);

addPredicate('paper-menu-button', [
  {selector: '.dropdown-trigger', slot: 'dropdown-trigger'},
  {selector: '.dropdown-content', slot: 'dropdown-content'},
]);

addPredicate(
    'iron-dropdown',
    [{selector: '.dropdown-content', slot: 'dropdown-content'}]);

addPredicate('paper-input', [
  {selector: '[prefix]', slot: 'prefix'},
  {selector: '[suffix]', slot: 'suffix'},
]);

addPredicate('paper-input-container', [
  {selector: '[prefix]', slot: 'prefix'},
  {selector: '[suffix]', slot: 'suffix'},
  {selector: '[add-on]', slot: 'add-on'},
  {selector: '*', slot: 'input'},
]);

addPredicate(
    'paper-dropdown-menu',
    [{selector: '.dropdown-content', slot: 'dropdown-content'}]);

function getContentDescriptors(tagName: string, document: Document):
    Array<{slot: string, predicate: dom5.Predicate}>|undefined {
  const descriptors = [];
  const [element, ] = document.getFeatures({
    kind: 'polymer-element',
    id: tagName,
    imported: true,
    externalPackages: true
  });
  if (element && element.domModule) {
    for (const slot of element.slots) {
      if (slot.astNode) {
        const selector =
            dom5.getAttribute(slot.astNode, 'old-content-selector');
        if (!selector) {
          continue;
        }
        descriptors.push(
            {predicate: simpleSelectorToPredicate(selector), slot: slot.name});
      }
    }
  }

  if (descriptors.length > 0) {
    return descriptors;
  }
  return staticConfig.get(tagName);
}

class ContentToSlot extends HtmlRule {
  code = 'content-to-slot-usages';
  description = stripIndent(`
      Warns when an element should have a \`slot\` attribute but does not.
    `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    // TODO(rictic): rather than just hard coding translation rules as above,
    //    we should also support converting based on the old-content-selector
    //    attribute.
    this.convertUsages(parsedDocument, document, warnings);

    return warnings;
  }

  convertUsages(
      parsedDocument: ParsedHtmlDocument, document: Document,
      warnings: FixableWarning[]) {
    const references = document.getFeatures({kind: 'element-reference'});
    for (const reference of references) {
      const contentDescriptors =
          getContentDescriptors(reference.tagName, document);
      if (!contentDescriptors) {
        continue;
      }
      const fix: Replacement[] = [];
      const matchedSoFar = new Set<dom5.Node>();
      for (const {predicate, slot} of contentDescriptors) {
        const matchingLightContents: dom5.Node[] = [];
        function matchChildNodes(node: dom5.Node) {
          for (const child of node.childNodes || []) {
            if (child.tagName === 'template') {
              const content = treeAdapters.default.getTemplateContent(child);
              matchChildNodes(content);
            } else if (predicate(child)) {
              matchingLightContents.push(child);
            }
          }
        }
        matchChildNodes(reference.astNode);
        for (const lightContent of matchingLightContents) {
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
          if (!originalText.endsWith('>')) {
            // Something weird is going on, don't make any changes.
            continue;
          }
          let justBeforeTagClose = -1;
          let tagCloseSyntax = '>';
          if (originalText.endsWith('/>')) {
            justBeforeTagClose = -2;
            tagCloseSyntax = '/>';
          }

          const withSlotAttr = originalText.slice(0, justBeforeTagClose) +
              ` slot="${slot}"${tagCloseSyntax}`;

          fix.push({range, replacementText: withSlotAttr});
        }
      }
      if (fix.length > 0) {
        const warning = new FixableWarning({
          code: 'content-to-slot-usage-site',
          message: `Deprecated <content>-based distribution into ` +
              `<${reference.tagName}>. ` +
              `Must use the \`slot\` attribute for named distribution."`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForStartTag(reference.astNode)!
        });
        warning.fix = fix;
        warnings.push(warning);
      }
    }
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
